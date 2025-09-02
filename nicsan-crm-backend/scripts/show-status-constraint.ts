import "dotenv/config";
import { Client } from "pg";

function pgConfig() {
  // Prefer backend server envs (DB_*) first to match running server
  if (process.env.DB_HOST && process.env.DB_USER) {
    return {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER,
      password: String(process.env.DB_PASSWORD || ""),
      database: process.env.DB_NAME || "postgres",
    };
  }
  // Then explicit PG* vars
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD) {
    return {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER,
      password: String(process.env.PGPASSWORD),
      database: process.env.PGDATABASE || "postgres",
    };
  }
  // Finally DATABASE_URL
  if (process.env.DATABASE_URL) return { connectionString: String(process.env.DATABASE_URL) };
  throw new Error("No PG envs set");
}

async function main() {
  const pg = new Client(pgConfig());
  await pg.connect();
  console.log("✅ Connected to PostgreSQL database");

  const sql = `
    SELECT c.conname AS name, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'pdf_uploads' AND c.conname ILIKE '%status%'
  `;
  const res = await pg.query(sql);
  console.log(res.rows);

  await pg.end();
}

main().catch((e) => {
  console.error("❌ Failed to read constraint:", e?.name || e, e?.message || "");
  process.exit(1);
});


