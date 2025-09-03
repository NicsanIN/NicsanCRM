import AWS from 'aws-sdk';
import { getCachedOcrText, putCachedOcrText } from "./s3TextCache";

const textract = new AWS.Textract({ region: process.env.AWS_REGION || 'ap-south-1' });
const S3_BUCKET = process.env.S3_BUCKET || 'nicsan-crm-pdfs';

// --- add near top ---
const OCR_MAX_WAIT_MS =
  Number(process.env.OCR_MAX_WAIT_MS || 120_000); // 120s default
const OCR_POLL_MS =
  Number(process.env.OCR_POLL_MS || 2_000);       // 2s default
// --- end add ---

/** Starts Textract text detection for an S3 PDF and returns JobId (no SNS channel) */
async function startOcrJob(s3Key: string): Promise<string> {
  const res = await textract.startDocumentTextDetection({
    DocumentLocation: { S3Object: { Bucket: S3_BUCKET, Name: s3Key } },
    // DO NOT include NotificationChannel at all
  }).promise();

  if (!res.JobId) throw new Error('Textract: startDocumentTextDetection returned no JobId');
  return res.JobId;
}

/** Polls Textract until COMPLETED/FAILED, returns concatenated text */
async function waitForOcr(JobId: string): Promise<string> {
  let nextToken: string | undefined = undefined;

  // First wait for job to reach COMPLETED
  const started = Date.now();
  while (true) {
    const res = await textract.getDocumentTextDetection({ JobId }).promise();
    const status = res.JobStatus;
    if (status === 'SUCCEEDED') break;
    if (status === 'FAILED' || status === 'PARTIAL_SUCCESS') throw new Error(`Textract ${status}`);
    if (Date.now() - started > OCR_MAX_WAIT_MS) {
      throw new Error('Textract timeout waiting for completion');
    }
    await new Promise(r => setTimeout(r, OCR_POLL_MS));
  }

  // Then page through results
  let out: string[] = [];
  while (true) {
    const res = await textract.getDocumentTextDetection({ JobId, NextToken: nextToken }).promise();
    for (const b of res.Blocks || []) {
      if (b.BlockType === 'LINE' && b.Text) out.push(b.Text);
    }
    if (!res.NextToken) break;
    nextToken = res.NextToken;
  }
  return out.join('\n');
}

export async function ocrPdfFromS3ToText({ uploadId, s3Key }: { uploadId: string; s3Key: string }): Promise<{ text: string; fromCache: boolean }> {
  // 0) Try cache first
  const cached = await getCachedOcrText(uploadId);
  if (cached) {
    if (process.env.DEBUG_VALIDFROM === "1") {
      const lines = cached.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (/Valid\s*From/i.test(lines[i])) {
          const start = Math.max(0, i - 5);
          const end = Math.min(lines.length, i + 5);
          console.log("[DEBUG ValidFrom block] >>>");
          console.log(lines.slice(start, end).join("\n"));
          console.log("<<< [DEBUG ValidFrom block]");
        }
      }
    }
    return { text: cached, fromCache: true };
  }

  // 1) Start Textract (your existing start code)
  const jobId = await startOcrJob(s3Key);

  // 2) Poll with env knobs (you already added OCR_MAX_WAIT_MS/OCR_POLL_MS)
  const text = await waitForOcr(jobId);

  // 3) Save to cache for all future runs
  await putCachedOcrText(uploadId, text);

  if (process.env.DEBUG_VALIDFROM === "1") {
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (/Valid\s*From/i.test(lines[i])) {
        const start = Math.max(0, i - 5);
        const end = Math.min(lines.length, i + 5);
        console.log("[DEBUG ValidFrom block] >>>");
        console.log(lines.slice(start, end).join("\n"));
        console.log("<<< [DEBUG ValidFrom block]");
      }
    }
  }

  return { text, fromCache: false };
}
