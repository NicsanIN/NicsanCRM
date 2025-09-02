import { Pool } from 'pg';

export async function getUploadByIdOrUuid(idOrUuid: string, pool: Pool) {
  const q = `
    SELECT upload_uuid, upload_uuid::text AS uuid_text, id AS numeric_id,
           filename, status, insurer, s3_key, extracted_data, has_extracted_data, created_at
    FROM pdf_uploads
    WHERE upload_uuid::text = $1 OR id::text = $1
    LIMIT 1`;
  const { rows } = await pool.query(q, [idOrUuid]);
  return rows[0] ?? null;
}
