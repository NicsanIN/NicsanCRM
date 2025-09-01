import "dotenv/config";
import { Client } from "pg";
import { processUpload } from "../src/workers/pdfProcessor";

function pgConfig() {
  // Prefer explicit PG* vars if a password is present
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD) {
    return {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER,
      password: String(process.env.PGPASSWORD),
      database: process.env.PGDATABASE || "postgres",
    };
  }
  if (process.env.DATABASE_URL) return { connectionString: String(process.env.DATABASE_URL) };
  throw new Error("No PG envs set");
}

async function main() {
  const pg = new Client(pgConfig());
  await pg.connect();
  console.log("✅ Connected to PostgreSQL database");

  // Pick latest pending by created_at (no MAX on uuid)
  const pick = await pg.query(`
    SELECT id::text AS id, status
    FROM pdf_uploads
    WHERE status IN ('UPLOADED','PROCESSING')
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (!pick.rows.length) {
    console.log("No pending uploads.");
    await pg.end();
    return;
  }

  const id = pick.rows[0].id as string; // UUID
  console.log("Processing upload (uuid):", id, "current status:", pick.rows[0].status);

  // Let the worker handle status transitions (PROCESSING → REVIEW)
  await processUpload(id);

  const out = await pg.query(
    `SELECT id::text AS id, status, (extracted_data IS NOT NULL) AS has_extracted_data
     FROM pdf_uploads WHERE id = $1`,
    [id]
  );
  console.log("✅ After worker:", out.rows[0]);

  await pg.end();
}

main().catch((e) => {
  console.error("❌ Processor failed:", e?.name || e, e?.message || "");
  process.exit(1);
});


