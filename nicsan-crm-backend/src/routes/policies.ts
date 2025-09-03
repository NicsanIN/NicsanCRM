import { Router } from 'express';
import pool from '../config/database';

const router = Router();

router.get('/recent', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 6), 25); // cap to 25

    // pick best available ordering without breaking if cols missing
    const { rows: cols } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='policies'
    `);
    const names = new Set(cols.map(c => c.column_name));
    const hasUploadId = names.has('upload_id');

    const orderBy = names.has('created_at')
      ? 'created_at DESC NULLS LAST'
      : names.has('issue_date')
      ? 'issue_date DESC NULLS LAST, id DESC'
      : 'id DESC'; // fallback

    const selectCols = `
      id, policy_number, vehicle_number, insurer,
      issue_date, expiry_date, total_premium, idv,
      executive, caller_name, product_type, vehicle_type
    ` + (hasUploadId ? `, upload_id` : ``);

    const { rows } = await pool.query(
      `
      SELECT ${selectCols}
      FROM policies
      ORDER BY ${orderBy}
      LIMIT $1
      `,
      [limit]
    );

    res.json({ ok: true, data: rows, hasUploadId });
  } catch (err) {
    console.error('GET /policies/recent error', err);
    res.status(500).json({ ok: false, error: 'RECENT_FETCH_FAILED' });
  }
});

export default router;
