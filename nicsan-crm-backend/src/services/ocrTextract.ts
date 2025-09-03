import AWS from 'aws-sdk';

const textract = new AWS.Textract({ region: process.env.AWS_REGION || 'ap-south-1' });
const S3_BUCKET = process.env.S3_BUCKET || 'nicsan-crm-pdfs';

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
async function waitForOcr(JobId: string, timeoutMs = 60000, intervalMs = 1500): Promise<string> {
  const t0 = Date.now();
  let nextToken: string | undefined = undefined;

  // First wait for job to reach COMPLETED
  while (true) {
    const { JobStatus } = await textract.getDocumentTextDetection({ JobId }).promise();
    if (JobStatus === 'SUCCEEDED' || JobStatus === 'COMPLETED') break;
    if (JobStatus === 'FAILED' || JobStatus === 'PARTIAL_SUCCESS') throw new Error(`Textract job status: ${JobStatus}`);
    if (Date.now() - t0 > timeoutMs) throw new Error('Textract timeout waiting for completion');
    await new Promise(r => setTimeout(r, intervalMs));
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

export async function ocrPdfFromS3ToText(s3Key: string): Promise<string> {
  const jobId = await startOcrJob(s3Key);
  const text = await waitForOcr(jobId);
  return text;
}
