import { Router } from 'express';
import { extractFromPdf } from '../extraction';
import { authenticateToken } from '../middleware/auth';
import pool from '../config/database';
import { getUploadById } from '../services/uploads';
import { ocrPdfFromS3ToText } from '../services/ocrTextract';
import { extractWithOpenAI } from '../services/openaiExtract';

const router = Router();

// Extract with specific model
router.post('/pdf/:uploadId', authenticateToken, async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    
    // Get upload details from database
    const uploadResult = await pool.query(
      'SELECT id, s3_key, extracted_data, uploaded_by FROM pdf_uploads WHERE id = $1',
      [uploadId]
    );
    
    if (uploadResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Upload not found' });
    }
    
    const upload = uploadResult.rows[0];
    
    // right after you load the upload row from DB:
    console.log("[EXTRACT] uploadId=%s s3_key(DB)=%s userId=%s",
      upload.id, upload.s3_key, upload.uploaded_by);

    // guard: key must contain the user folder
    if (!upload.s3_key?.includes(`/${upload.uploaded_by}/`)) {
      console.error("[EXTRACT] BAD S3 KEY (missing user folder). Fix the DB row.", {
        uploadId: upload.id, s3_key: upload.s3_key, userId: upload.uploaded_by,
      });
    }
    
    const insurerHint = upload.extracted_data?.insurer;
    
    console.log("[extract/route] body:", req.body);
    const model = req.body?.model === "secondary" ? "secondary" : "primary";

    const { data, meta } = await extractFromPdf({ s3_key: upload.s3_key }, model);
    
    res.json({ ok: true, data, meta });
    
  } catch (error) {
    console.error('Extraction error:', error);
    next(error);
  }
});

// Manual OCR route for scanned PDFs
router.post('/pdf/:uploadId/ocr', authenticateToken, async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    const modelTag = req.body?.model === 'secondary' ? 'secondary' : 'primary';
    const upload = await getUploadById(uploadId);
    if (!upload?.s3_key) return res.status(404).json({ ok:false, code:'upload_not_found' });

    // OCR timing
    const tText0 = Date.now();
    const pdfText = await ocrPdfFromS3ToText(upload.s3_key);
    const text_ms = Date.now() - tText0;
    if (!pdfText || pdfText.length < 20) return res.status(422).json({ ok:false, code:'pdf_text_empty' });

    // LLM timing
    const tLlm0 = Date.now();
    const data = await extractWithOpenAI({ pdfText, modelTag });
    const llm_ms = Date.now() - tLlm0;

    const meta = {
      via: 'ocr' as const,
      modelTag,
      pdfTextChars: pdfText.length,
      text_ms,
      llm_ms,
      total_ms: text_ms + llm_ms,
    };
    return res.json({ ok:true, data, meta });
  } catch (err) {
    return next(err);
  }
});

export default router;

