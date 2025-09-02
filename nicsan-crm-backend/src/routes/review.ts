import { Router } from 'express';
import pool from '../config/database';
import { authenticateToken, requireAnyRole, AuthenticatedRequest } from '../middleware/auth';
import { parsePolicyExtractV1 } from '../extraction/schema';
import { ConfirmSaveSchema } from '../schemas/confirmSave';
import { processUpload } from '../workers/pdfProcessor';

const router = Router();

// Require auth on all review endpoints
router.use(authenticateToken);
router.use(requireAnyRole);

// helper – already have similar for other columns
async function columnExists(pool: any, table: string, column: string) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
    [table, column]
  );
  return r.rowCount > 0;
}

/**
 * POST /uploads/:id/confirm-save
 * Body: { edits?: Partial<{ policy_number, vehicle_number, issue_date, expiry_date, total_premium, idv, insurer, make, model, variant, fuel_type }> }
 */
router.post('/uploads/:id/confirm-save', async (req: AuthenticatedRequest, res, next) => {
  try {
    // 1) resolve upload
    const { getUploadByIdOrUuid } = await import('../db/uploads');
    const u = await getUploadByIdOrUuid(req.params.id, pool);
    if (!u) return res.status(404).json({ error: 'UPLOAD_NOT_FOUND' });
    const uploadUUID: string = u.uuid_text; // <-- this is what goes into policies.upload_id

    // Accept REVIEW or COMPLETED as reviewable (DB may disallow REVIEW)
    if (u.status !== 'REVIEW' && u.status !== 'COMPLETED') {
      return res.status(409).json({ success: false, error: `Upload not in REVIEW/COMPLETED (found: ${u.status})` });
    }

    // 2) validate body (your ConfirmSaveSchema)
    const parsed = ConfirmSaveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'BAD_BODY', issues: parsed.error.issues });
    const d = parsed.data;

    // 3) build dynamic INSERT with column existence checks
    const uploadId = req.params.id; // this is the UUID from /uploads/:uploadId/confirm-save
    const hasUploadIdCol = await columnExists(pool, 'policies', 'upload_id');

    const cols = ['id', 'insurer', 'policy_number', 'vehicle_number', 'issue_date', 'expiry_date', 'total_premium', 'idv'];
    const vals = ['gen_random_uuid()', d.insurer.value, d.policy_number.value, d.vehicle_number.value, d.issue_date.value, d.expiry_date.value, d.total_premium.value, d.idv.value];

    // Add optional columns if they exist
    const optionalColumns = [
      { name: 'product_type', value: d.product_type },
      { name: 'vehicle_type', value: d.vehicle_type },
      { name: 'executive', value: d.manual_extras?.executive ?? 'OPS' },
      { name: 'caller_name', value: d.manual_extras?.caller_name ?? 'NA' },
      { name: 'mobile', value: d.manual_extras?.mobile ?? '0000000000' },
      { name: 'ncb', value: d.ncb ?? 0 },
      { name: 'make', value: (d.make ?? 'UNKNOWN').trim() },
    ];

    for (const col of optionalColumns) {
      const exists = await columnExists(pool, 'policies', col.name);
      if (exists) {
        cols.push(col.name);
        vals.push(col.value);
      }
    }

    // Add upload_id if column exists (with backward compatibility)
    const bodyUploadUuid = (req.body && (req.body.upload_uuid || req.body.uploadId)) as string | undefined;
    const effectiveUploadId = uploadId ?? bodyUploadUuid; // prefer path param
    if (hasUploadIdCol && effectiveUploadId) {
      cols.push('upload_id');
      vals.push(effectiveUploadId);
    }

    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `INSERT INTO policies (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
      vals
    );

    // (optional) bump upload status → REVIEW/SAVED
    await pool.query(`UPDATE pdf_uploads SET status='REVIEW' WHERE upload_uuid=$1 AND status <> 'REVIEW'`, [uploadUUID]);

    return res.json({ ok: true, policy_id: rows[0].id, upload_id: uploadUUID });
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


