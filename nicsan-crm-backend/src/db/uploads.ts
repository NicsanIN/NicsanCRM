import { Pool } from 'pg';

export async function getUploadByIdOrUuid(idOrUuid: string, pool: Pool) {
  const q = `
    SELECT id, id::text AS uuid_text, id AS numeric_id,
           filename, status, s3_key, extracted_data, created_at
    FROM pdf_uploads
    WHERE id::text = $1
    LIMIT 1`;
  const { rows } = await pool.query(q, [idOrUuid]);
  return rows[0] ?? null;
}
