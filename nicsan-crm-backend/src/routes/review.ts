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

    // 2) Prefer incoming Zod-shaped payload; otherwise fall back to DB extract + legacy edits
    const raw = upload.extracted_data;
    // Accept either top-level Zod payload or legacy { edits }
    const incoming = (req.body && (req.body as any).schema_version === '1.0')
      ? (req.body as Record<string, any>)
      : ((req.body?.edits ?? {}) as Record<string, any>);

         // 1) helper: parse money-like inputs safely → number (default 0)
     const toMoney = (field?: { value?: string | number } | string | number | null) => {
       // reason: accept both wrapped {value} and raw
       const raw = (field && typeof field === 'object' && 'value' in field) ? (field as any).value : field;
       if (raw === undefined || raw === null || raw === '') return 0;           // reason: blank → 0
       const cleaned = String(raw).replace(/[₹,\s]/g, '');                       // reason: strip currency & commas
       const n = Number(cleaned);
       return Number.isFinite(n) ? n : 0;                                        // reason: bad numbers → 0
     };

     // 1) helper: unwrap {value} or raw → trimmed string with fallback
     const toText = (
       f?: { value?: string } | string | null | undefined,
       fallback = 'UNKNOWN'
     ) => {
       const raw = (f && typeof f === 'object' && 'value' in f) ? (f as any).value : f;
       const s = (raw ?? '').toString().trim();
       return s.length ? s : fallback;
     };

     // 2) use it only for the columns you have
     const idv           = toMoney(req.body.idv);
     const netOd         = toMoney(req.body.net_od);
     const netPremium    = toMoney(req.body.net_premium);
     const totalOd       = toMoney(req.body.total_od);
     const totalPremium  = toMoney(req.body.total_premium);
     const customerPaid  = toMoney(req.body.customer_paid);

     // 2) compute safe values for NOT NULL text columns you have
     const insurer       = toText(req.body.insurer,        'UNKNOWN');   // enum upstream; keep fallback safe
     const policyNumber  = toText(req.body.policy_number,  'NA');
     const vehicleNumber = toText(req.body.vehicle_number, 'NA');
     const productType   = toText(req.body.product_type,   'MOTOR');
     const vehicleType   = toText(req.body.vehicle_type,   'PRIVATE');
     const source        = toText(req.body.source,         'PDF_UPLOAD');
     const executive     = toText(req.body.executive,      'OPS');
     const callerName    = toText(req.body.caller_name,    'NA');
     const mobile        = toText(req.body.mobile,         '0000000000');
     const make          = toText(req.body.make,           'UNKNOWN');

     // TEMP sanity log
     try {
       console.log('ptype:', (req as any).body?.product_type, 'vtype:', (req as any).body?.vehicle_type);
       console.log('make =>', (req as any).body?.make);
       console.log('ncb =>', (req as any).body?.ncb);
       console.log('money fields =>', { idv, netOd, netPremium, totalOd, totalPremium, customerPaid });
       console.log('text fields =>', { insurer, policyNumber, vehicleNumber, productType, vehicleType, source, executive, callerName, mobile, make });
     } catch {}

    // Try parsing from DB, but tolerate failures (older rows)
    let parsedFromDb: any = null;
    try {
      if (raw) parsedFromDb = parsePolicyExtractV1(raw);
    } catch (_) {
      parsedFromDb = null;
    }

    // If incoming is Zod-shaped, validate it now
    const isZodIncoming = typeof incoming === 'object' && incoming != null && (incoming as any).schema_version === '1.0';
    let parsedIncoming: any = null;
    if (isZodIncoming) {
      // Validate extraction fields
      parsedIncoming = parsePolicyExtractV1(incoming);
      // Validate product_type and vehicle_type separately as plain strings
      ConfirmSaveSchema.pick({ schema_version: true, product_type: true, vehicle_type: true }).parse({
        schema_version: (incoming as any).schema_version,
        product_type: (incoming as any).product_type,
        vehicle_type: (incoming as any).vehicle_type,
      });
    }

    const getIncoming = (key: string) => {
      const v = (incoming as any)[key];
      if (v && typeof v === 'object' && 'value' in v) return (v as any).value;
      return v ?? null;
    };
    const getDb = (k: string) => (parsedFromDb ? (parsedFromDb as any)[k]?.value ?? null : null);

    const merged: any = {
      insurer: parsedIncoming ? (parsedIncoming as any).insurer?.value ?? null : getIncoming('insurer') ?? getDb('insurer'),
      policy_number: parsedIncoming ? (parsedIncoming as any).policy_number?.value ?? null : getIncoming('policy_number') ?? getDb('policy_number'),
      vehicle_number: parsedIncoming ? (parsedIncoming as any).vehicle_number?.value ?? null : getIncoming('vehicle_number') ?? getDb('vehicle_number'),
      issue_date: parsedIncoming ? (parsedIncoming as any).issue_date?.value ?? null : getIncoming('issue_date') ?? getDb('issue_date'),
      expiry_date: parsedIncoming ? (parsedIncoming as any).expiry_date?.value ?? null : getIncoming('expiry_date') ?? getDb('expiry_date'),
      total_premium: parsedIncoming ? (parsedIncoming as any).total_premium?.value ?? null : getIncoming('total_premium') ?? getDb('total_premium'),
      idv: parsedIncoming ? (parsedIncoming as any).idv?.value ?? null : getIncoming('idv') ?? getDb('idv'),
      make: parsedIncoming ? (parsedIncoming as any).make?.value ?? null : getIncoming('make') ?? (parsedFromDb as any)?.make?.value ?? null,
      model: parsedIncoming ? (parsedIncoming as any).model?.value ?? null : getIncoming('model') ?? (parsedFromDb as any)?.model?.value ?? null,
      variant: parsedIncoming ? (parsedIncoming as any).variant?.value ?? null : getIncoming('variant') ?? (parsedFromDb as any)?.variant?.value ?? null,
      fuel_type: parsedIncoming ? (parsedIncoming as any).fuel_type?.value ?? null : getIncoming('fuel_type') ?? (parsedFromDb as any)?.fuel_type?.value ?? null,
    };

         // Optional product_type from payload (already sanitized above)
     const productTypeValue = parsedIncoming
       ? (parsedIncoming as any).product_type?.value ?? null
       : getIncoming('product_type');

     // Optional vehicle_type from payload (already sanitized above)
     const vehicleTypeValue = getIncoming('vehicle_type');

    // 3) Basic guards
    const required = ['insurer', 'policy_number', 'vehicle_number', 'issue_date', 'expiry_date', 'total_premium'];
    for (const k of required) {
      if (!merged[k]) return res.status(400).json({ success: false, error: `Missing ${k}` });
    }

    // 4) Insert into policies (map to our schema and use safe defaults where required)
    const userId = req.user?.userId || null;
    // Conditionally include product_type / vehicle_type / make if columns exist
    const hasProductTypeCol = ((
      await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'product_type' LIMIT 1`
      )
    ).rowCount ?? 0) > 0;
    const hasVehicleTypeCol = ((
      await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'vehicle_type' LIMIT 1`
      )
    ).rowCount ?? 0) > 0;
         const hasMakeCol = ((
       await pool.query(
         `SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'make' LIMIT 1`
       )
     ).rowCount ?? 0) > 0;
     const hasNcbCol = ((
       await pool.query(
         `SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'ncb' LIMIT 1`
       )
     ).rowCount ?? 0) > 0;
     const hasNetOdCol = ((
       await pool.query(
         `SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'net_od' LIMIT 1`
       )
     ).rowCount ?? 0) > 0;
     const hasNetPremiumCol = ((
       await pool.query(
         `SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'net_premium' LIMIT 1`
       )
     ).rowCount ?? 0) > 0;
     const hasTotalOdCol = ((
       await pool.query(
         `SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'total_od' LIMIT 1`
       )
     ).rowCount ?? 0) > 0;
     const hasCustomerPaidCol = ((
       await pool.query(
         `SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'customer_paid' LIMIT 1`
       )
     ).rowCount ?? 0) > 0;
     const hasExecCol = ((
       await pool.query(
         `SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'executive' LIMIT 1`
       )
     ).rowCount ?? 0) > 0;
     const hasCallerNameCol = ((
       await pool.query(
         `SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'caller_name' LIMIT 1`
       )
     ).rowCount ?? 0) > 0;
     const hasMobileCol = ((
       await pool.query(
         `SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'mobile' LIMIT 1`
       )
     ).rowCount ?? 0) > 0;
     const hasSourceCol = ((
       await pool.query(
         `SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'source' LIMIT 1`
       )
     ).rowCount ?? 0) > 0;

    // Build dynamic column list and values
    const cols: string[] = [
      'insurer', 'policy_number', 'vehicle_number', 'issue_date', 'expiry_date', 'total_premium', 'idv'
    ];
         const vals: any[] = [
       insurer,       // reason: use sanitized value (never NULL)
       policyNumber,  // reason: use sanitized value (never NULL)
       vehicleNumber, // reason: use sanitized value (never NULL)
       String(merged.issue_date ?? ''),
       String(merged.expiry_date ?? ''),
       totalPremium,  // reason: use sanitized value (never NULL)
       idv,           // reason: use sanitized value (never NULL)
     ];
         if (hasProductTypeCol) {
       cols.push('product_type');
       vals.push(productType);
     }
     if (hasVehicleTypeCol) {
       cols.push('vehicle_type');
       vals.push(vehicleType);
     }
     if (hasMakeCol) {
       cols.push('make');
       vals.push(make);
     }
     if (hasSourceCol) {
       cols.push('source');
       vals.push(source);
     }
     if (hasNcbCol) {
       // ncb is guaranteed to be a number (0-100) from Zod schema
       const ncbValue = (incoming as any)?.ncb ?? 0;
       cols.push('ncb');
       vals.push(Number(ncbValue));
     }
     if (hasNetOdCol) {
       cols.push('net_od');
       vals.push(netOd);  // reason: use sanitized value (never NULL)
     }
     if (hasNetPremiumCol) {
       cols.push('net_premium');
       vals.push(netPremium);  // reason: use sanitized value (never NULL)
     }
     if (hasTotalOdCol) {
       cols.push('total_od');
       vals.push(totalOd);  // reason: use sanitized value (never NULL)
     }
     if (hasCustomerPaidCol) {
       cols.push('customer_paid');
       vals.push(customerPaid);  // reason: use sanitized value (never NULL)
     }
     if (hasExecCol) {
       cols.push('executive');
       vals.push(executive);
     }
     if (hasCallerNameCol) {
       cols.push('caller_name');
       vals.push(callerName);
     }
     if (hasMobileCol) {
       cols.push('mobile');
       vals.push(mobile);
     }

    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const insertQuery = `INSERT INTO policies (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`;
    const insert = await pool.query(insertQuery, vals);

    const policyId = (insert as any)?.rows?.[0]?.id;
    if (!policyId) {
      throw new Error('Policy insert did not return an id');
    }

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


