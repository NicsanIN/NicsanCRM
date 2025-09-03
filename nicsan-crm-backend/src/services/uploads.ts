import { GetObjectCommand, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3, S3_BUCKET } from "../lib/s3";

const S3_PREFIX = (process.env.S3_PREFIX || "").trim();

function clean(seg: string) { return seg.replace(/^\/+|\/+$/g, ""); }
function joinKey(prefix: string, key: string) {
  const p = clean(prefix), k = key.replace(/^\/+/, "");
  return p && k.toLowerCase().startsWith((p + "/").toLowerCase()) ? k : (p ? `${p}/${k}` : k);
}
function parseS3Uri(uri: string) {
  const no = uri.replace(/^s3:\/\//, "");
  const i = no.indexOf("/");
  return { Bucket: no.slice(0, i), Key: no.slice(i + 1).replace(/^\/+/, "") };
}
async function headOk(Bucket: string, Key: string) {
  try { await s3.send(new HeadObjectCommand({ Bucket, Key })); return true; } catch { return false; }
}
async function getBuffer(Bucket: string, Key: string) {
  const r = await s3.send(new GetObjectCommand({ Bucket, Key }));
  if (!r.Body) throw new Error(`Empty S3 body for ${Bucket}/${Key}`);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    (r.Body as any).on("data", (c: Buffer) => chunks.push(c));
    (r.Body as any).on("end", () => resolve(Buffer.concat(chunks)));
    (r.Body as any).on("error", reject);
  });
}

/**
 * Smart fetch:
 * - Accepts raw key (e.g., "uploads/a.pdf") or full s3 URI.
 * - Tries with S3_PREFIX, without prefix, spaces<->underscores variants.
 * - If all fail, lists nearby keys to help debug.
 */
import { getUploadByIdOrUuid } from '../db/uploads';
import pool from '../config/database';

export async function getUploadById(uploadId: string) {
  return getUploadByIdOrUuid(uploadId, pool);
}

export async function getPdfBufferFromS3(inputKeyOrUri: string): Promise<Buffer> {
  let Bucket = S3_BUCKET;
  let KeyRaw = inputKeyOrUri;

  if (inputKeyOrUri.startsWith("s3://")) {
    const parsed = parseS3Uri(inputKeyOrUri);
    Bucket = parsed.Bucket;
    KeyRaw = parsed.Key;
  }
  const candidates: string[] = [];
  const base = KeyRaw.replace(/^\/+/, "");

  // 1) with prefix
  candidates.push(joinKey(S3_PREFIX, base));
  // 2) without prefix
  candidates.push(base);

  // 3) underscore/space variants
  const withSpaces = base.replace(/_/g, " ");
  const withUnderscores = base.replace(/ /g, "_");
  if (withSpaces !== base) {
    candidates.push(joinKey(S3_PREFIX, withSpaces));
    candidates.push(withSpaces);
  }
  if (withUnderscores !== base) {
    candidates.push(joinKey(S3_PREFIX, withUnderscores));
    candidates.push(withUnderscores);
  }

  // De-dupe while preserving order
  const tried = Array.from(new Set(candidates));

  console.log(`[S3] fetch start -> Bucket="${Bucket}", input="${inputKeyOrUri}", prefix="${S3_PREFIX}"`);
  for (const Key of tried) {
    console.log(`[S3] try HeadObject -> ${Bucket}/${Key}`);
    if (await headOk(Bucket, Key)) {
      console.log(`[S3] HIT -> ${Bucket}/${Key}`);
      return getBuffer(Bucket, Key);
    }
  }

  // If none found, try to suggest neighbors from same "dir"
  const dir = (() => {
    const k = tried[0];
    const cut = k.lastIndexOf("/");
    return cut > 0 ? k.slice(0, cut + 1) : "";
  })();

  let suggestions: string[] = [];
  try {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket,
      Prefix: dir,
      MaxKeys: 50,
    }));
    suggestions = (list.Contents || [])
      .map(o => o.Key!)
      .filter(Boolean)
      .slice(0, 10);
  } catch (e) {
    // ignore list errors; not critical
  }

  const msg =
    `NoSuchKey: Tried keys (in order):\n` +
    tried.map(k => ` - ${Bucket}/${k}`).join("\n") +
    (suggestions.length
      ? `\nNearby keys under ${Bucket}/${dir}:\n` + suggestions.map(s => ` * ${s}`).join("\n")
      : ``);

  console.error(msg);
  throw new Error(msg);
}

/**
 * Upload a PDF file to S3 with proper prefix handling and logging.
 * Supports the same key normalization as getPdfBufferFromS3.
 */
export async function putPdfToS3(key: string, buf: Buffer, contentType = "application/pdf") {
  const Key = joinKey(S3_PREFIX, key);
  console.log(`[S3 PUT] Bucket="${S3_BUCKET}" Key="${Key}" bytes=${buf.length}`);
  
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key,
    Body: buf,
    ContentType: contentType,
  }));
  
  // optional quick HEAD to confirm it exists
  await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key }));
  console.log(`[S3 OK]   Stored ${Key}`);
  
  return { bucket: S3_BUCKET, key: Key };
}
