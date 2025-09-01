import pool from "../config/database";
import { extractFromPdf } from "../extraction";
import { parsePolicyExtractV1 } from "../extraction/schema";

const Allowed = new Set(["UPLOADED","PROCESSING","REVIEW","SAVED","COMPLETED"]);
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
      `SELECT id::text, s3_key, extracted_data FROM pdf_uploads WHERE id = $1 LIMIT 1`,
      [uploadId]
    );
    if (res.rows.length === 0) {
      throw new Error("Upload not found");
    }
    const upload = res.rows[0];
    const insurerHint: string | null = upload.extracted_data?.insurer ?? null;

    // 3) run extractor
    const resultJson = await extractFromPdf({
      s3Key: upload.s3_key,
      insurerHint,
    });

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

    await setStatus(uploadId, "REVIEW");

  } catch (e: any) {
    console.error("PROCESSOR_ERROR", { uploadId, name: e?.name, msg: e?.message });
    await setStatus(uploadId, "UPLOADED");
    throw e;
  }
}


