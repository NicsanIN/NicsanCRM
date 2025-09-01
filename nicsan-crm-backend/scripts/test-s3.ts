// backend/scripts/test-s3.ts
import { S3Client, PutObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  S3_BUCKET_NAME,
} = process.env;

async function main() {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !S3_BUCKET_NAME) {
    throw new Error("Missing env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME");
  }

  const s3 = new S3Client({
    region: AWS_REGION,
    credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
  });

  // 1) Bucket exists & in this region?
  await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET_NAME }));

  // 2) Try a tiny put
  const key = `sanity/s3-test-${Date.now()}.txt`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
    Body: "hello-s3",
    ContentType: "text/plain",
  }));

  console.log("✅ S3 sanity OK:", { bucket: S3_BUCKET_NAME, key });
}

main().catch((e) => {
  console.error("❌ S3 sanity FAILED");
  // show useful AWS details if present
  const code = (e as any)?.$metadata?.httpStatusCode;
  console.error("Status:", code);
  console.error("Name:", (e as any)?.name);
  console.error("Message:", e instanceof Error ? e.message : e);
  console.error("Raw:", e); // keep for debugging
  process.exit(1);
});
