import { Router } from 'express';
import pool from '../config/database';

const router = Router();

// GET /upload/pdf - List uploads with pagination and status filtering
router.get('/upload/pdf', async (req, res) => {
  try {
    const page  = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(Math.max(1, Number(req.query.limit ?? 50)), 100);
    const offset = (page - 1) * limit;

    // allow overriding statuses; default to "pending" set
    const statuses = (req.query.statuses
      ? String(req.query.statuses).split(',').map(s => s.trim().toUpperCase())
      : ['UPLOADED', 'PROCESSING', 'REVIEW']
    );

    const { rows } = await pool.query(
      `
      SELECT id::text AS id, filename, status, s3_key, created_at
      FROM pdf_uploads
      WHERE status = ANY($1::text[])
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [statuses, limit, offset]
    );

    // IMPORTANT: never throw on empty
    return res.json({ items: rows, page, limit, count: rows.length });
  } catch (e) {
    console.error('UPLOAD_LIST_FAILED', e);
    // still respond gracefully
    return res.status(200).json({ items: [], page: 1, limit: 50, count: 0 });
  }
});

export default router;
