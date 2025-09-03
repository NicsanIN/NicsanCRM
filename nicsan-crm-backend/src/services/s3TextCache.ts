import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION || "ap-south-1";
const BUCKET = process.env.S3_BUCKET;
const s3 = new S3Client({ region: REGION });

export async function getCachedOcrText(uploadId: string): Promise<string|null> {
  if (!BUCKET || process.env.DISABLE_OCR_CACHE === '1') return null;
  try {
    const Key = `ocr_texts/${uploadId}.txt`;
    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key }));
    const body = await obj.Body?.transformToString?.("utf-8");
    return body ?? null;
  } catch {
    return null;
  }
}

export async function putCachedOcrText(uploadId: string, text: string): Promise<void> {
  if (!BUCKET || process.env.DISABLE_OCR_CACHE === '1') return; // skip silently
  try {
    const Key = `ocr_texts/${uploadId}.txt`;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key,
      Body: text, ContentType: "text/plain; charset=utf-8",
      CacheControl: "max-age=31536000",
    }));
  } catch {
    // swallow cache write errors (don't block extraction)
  }
}
