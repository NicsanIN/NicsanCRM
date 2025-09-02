import { Router } from 'express';
import pool from '../config/database';
import { authenticateToken, requireAnyRole, AuthenticatedRequest } from '../middleware/auth';
import { parsePolicyExtractV1 } from '../extraction/schema';
import { processUpload } from '../workers/pdfProcessor';

const router = Router();

// Require auth on all review endpoints
router.use(authenticateToken);
router.use(requireAnyRole);

/**
 * POST /uploads/:id/confirm-save
 * Body: { edits?: Partial<{ policy_number, vehicle_number, issue_date, expiry_date, total_premium, idv, insurer, make, model, variant, fuel_type }> }
 */
router.post('/uploads/:id/confirm-save', async (req: AuthenticatedRequest, res, next) => {
  const uploadId = req.params.id; // UUID
  try {
    // 1) Load upload row
    const upRes = await pool.query(`SELECT * FROM pdf_uploads WHERE id = $1 LIMIT 1`, [uploadId]);
    if (upRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Upload not found' });
    }
    const upload = upRes.rows[0];

    // Accept REVIEW or COMPLETED as reviewable (DB may disallow REVIEW)
    if (upload.status !== 'REVIEW' && upload.status !== 'COMPLETED') {
      return res.status(409).json({ success: false, error: `Upload not in REVIEW/COMPLETED (found: ${upload.status})` });
    }

    // 2) Merge extracted_data with any UI edits (flat fields only)
    const raw = upload.extracted_data;
    if (!raw) {
      return res.status(400).json({ success: false, error: 'No extracted_data to save' });
    }

    const parsed = parsePolicyExtractV1(raw); // validates shape
    const edits = (req.body?.edits ?? {}) as Record<string, any>;
    const getV = (k: keyof typeof parsed) => (parsed as any)[k]?.value ?? null;

    const merged: any = {
      insurer: edits.insurer ?? getV('insurer'),
      policy_number: edits.policy_number ?? getV('policy_number'),
      vehicle_number: edits.vehicle_number ?? getV('vehicle_number'),
      issue_date: edits.issue_date ?? getV('issue_date'),
      expiry_date: edits.expiry_date ?? getV('expiry_date'),
      total_premium: edits.total_premium ?? getV('total_premium'),
      idv: edits.idv ?? getV('idv'),
      make: edits.make ?? (parsed as any).make?.value ?? null,
      model: edits.model ?? (parsed as any).model?.value ?? null,
      variant: edits.variant ?? (parsed as any).variant?.value ?? null,
      fuel_type: edits.fuel_type ?? (parsed as any).fuel_type?.value ?? null,
    };

    // 3) Basic guards
    const required = ['insurer', 'policy_number', 'vehicle_number', 'issue_date', 'expiry_date', 'total_premium'];
    for (const k of required) {
      if (!merged[k]) return res.status(400).json({ success: false, error: `Missing ${k}` });
    }

    // 4) Insert into policies (map to our schema and use safe defaults where required)
    const userId = req.user?.userId || null;
    const insert = await pool.query(
      `INSERT INTO policies (
        policy_number, vehicle_number, insurer, product_type, vehicle_type, make,
        issue_date, expiry_date, idv, ncb, discount, net_od, ref, total_od,
        net_premium, total_premium, cashback_percentage, cashback_amount,
        customer_paid, executive, caller_name, mobile, source, brokerage, cashback, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, $26
      ) RETURNING id`,
      [
        String(merged.policy_number),
        String(merged.vehicle_number),
        String(merged.insurer),
        'Private Car', // product_type
        'Private Car', // vehicle_type
        merged.make ?? 'Unknown',
        String(merged.issue_date),
        String(merged.expiry_date),
        merged.idv != null ? Number(merged.idv) : 0,
        0, // ncb
        0, // discount
        0, // net_od
        null, // ref
        0, // total_od
        Number(merged.total_premium) || 0, // net_premium
        Number(merged.total_premium) || 0, // total_premium
        0, // cashback_percentage
        0, // cashback_amount
        Number(merged.total_premium) || 0, // customer_paid
        'OPS', // executive (placeholder, NOT NULL)
        'OPS', // caller_name (placeholder, NOT NULL)
        '0000000000', // mobile (placeholder, NOT NULL)
        'PDF_UPLOAD', // source
        0, // brokerage
        0, // cashback
        userId,
      ]
    );

    const policyId = insert.rows[0].id;

    // 5) Mark upload SAVED, falling back to COMPLETED if constraint disallows SAVED
    try {
      await pool.query(`UPDATE pdf_uploads SET status = 'SAVED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [uploadId]);
    } catch (_e) {
      await pool.query(`UPDATE pdf_uploads SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [uploadId]);
    }

    return res.json({ success: true, data: { policy_id: policyId, upload_id: upload.id } });
  } catch (e: any) {
    console.error('CONFIRM_SAVE_ERROR', { name: e?.name, msg: e?.message });
    return next(e);
  }
});

export default router;

// Optional manual backstop: trigger processing immediately for a given upload id
router.post('/uploads/:id/process-now', async (req, res) => {
  const id = req.params.id;
  processUpload(String(id))
    .then(() => res.json({ success: true }))
    .catch((e: any) => {
      console.error('PROCESS_NOW_ERROR', e);
      res.status(500).json({ success: false, error: e?.message || 'process failed' });
    });
});


