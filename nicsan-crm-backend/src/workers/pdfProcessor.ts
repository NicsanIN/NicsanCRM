import pool from "../config/database";
import { extractFromPdf } from "../extraction";
import { parsePolicyExtractV1 } from "../extraction/schema";
import { toInsurerHint } from "../extraction/insurerMap";

const Allowed = new Set(["UPLOADED","PROCESSING","REVIEW","SAVED","COMPLETED","FAILED"]);
async function setStatus(id: string | number, status: string) {
  const s = String(status).trim().toUpperCase();
  if (!Allowed.has(s)) {
    console.error("STATUS_GUARD: rejecting invalid status", { id, status });
    throw new Error(`Invalid status '${status}'`);
  }
  await pool.query(
    `UPDATE pdf_uploads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [s, id]
  );
}

export async function processUpload(uploadId: string): Promise<void> {
  // 1) mark PROCESSING
  await setStatus(uploadId, "PROCESSING");

  try {
    // 2) load upload row
    const res = await pool.query(
      `SELECT id::text, s3_key, extracted_data, uploaded_by FROM pdf_uploads WHERE id = $1 LIMIT 1`,
      [uploadId]
    );
    if (res.rows.length === 0) {
      throw new Error("Upload not found");
    }
    const upload = res.rows[0];
    
    // right after you load the upload row from DB:
    console.log("[EXTRACT] uploadId=%s s3_key(DB)=%s userId=%s",
      upload.id, upload.s3_key, upload.uploaded_by);

    // guard: key must contain the user folder
    if (!upload.s3_key?.includes(`/${upload.uploaded_by}/`)) {
      console.error("[EXTRACT] BAD S3 KEY (missing user folder). Fix the DB row.", {
        uploadId: upload.id, s3_key: upload.s3_key, userId: upload.uploaded_by,
      });
    }
    
    const rawInsurerHint: string | null = upload.extracted_data?.insurer ?? null;
    const insurerHintSafe = toInsurerHint(rawInsurerHint); // Map to strict union

    // 3) run extractor
    const { data: resultJson, meta } = await extractFromPdf({ s3_key: upload.s3_key }, "primary");

    // Validate shape
    const parsed = parsePolicyExtractV1(resultJson);

    // 5) persist extraction + move to REVIEW; merge into existing jsonb
    const merged = {
      ...(upload.extracted_data || {}),
      status: "REVIEW",
      extracted_data: parsed,
      insurer: upload.extracted_data?.insurer ?? parsed.insurer?.value ?? null,
    };

    await pool.query(
      `UPDATE pdf_uploads
         SET extracted_data = $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(merged), uploadId]
    );

    try {
      await setStatus(uploadId, "REVIEW");
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("pdf_uploads_status_check") || msg.includes("23514")) {
        await setStatus(uploadId, "COMPLETED");
      } else {
        throw err;
      }
    }

  } catch (e: any) {
    console.error("PROCESSOR_ERROR", { uploadId, name: e?.name, msg: e?.message });
    await setStatus(uploadId, "UPLOADED");
    throw e;
  }
}


