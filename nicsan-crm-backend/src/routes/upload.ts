import { Router } from 'express';
import multer from 'multer';
import pool from '../config/database';
import { authenticateToken, requireAnyRole, AuthenticatedRequest } from '../middleware/auth';
import { s3, s3Config, validateFile } from '../config/aws';
import { putPdf, S3_BUCKET } from '../lib/s3';
import { createError } from '../middleware/errorHandler';
import { PDFUpload, ApiResponse } from '../types';
import PDFProcessor from '../services/pdf-processor';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: s3Config.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    if (s3Config.allowedFileTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF files are allowed.'));
    }
  },
});

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireAnyRole);

// Generate presigned URL for secure upload
router.post('/presigned-url', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { filename } = req.body;
    const userId = req.user?.userId;

    if (!filename) {
      return next(createError('Filename is required', 400));
    }

    const presignedUrl = await PDFProcessor.generatePresignedUploadUrl(filename, userId!);
    
    res.json({
      success: true,
      message: 'Presigned URL generated successfully',
      data: {
        presignedUrl,
        expiresIn: 3600, // 1 hour
        fields: {
          'Content-Type': 'application/pdf'
        }
      }
    } as ApiResponse<any>);

  } catch (error) {
    next(error);
  }
});

// Upload PDF
router.post('/pdf', upload.single('pdf'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return next(createError('User not authenticated', 401));
    }

    const file = req.file;
    if (!file) {
      return next(createError('PDF file is required', 400));
    }

    const { insurer } = req.body;
    if (!insurer || !['TATA_AIG', 'DIGIT'].includes(insurer)) {
      return next(createError('Valid insurer is required (TATA_AIG or DIGIT)', 400));
    }

    // Extract manual extras from request body
    const manualExtras: any = {};
    Object.keys(req.body).forEach(key => {
      if (key.startsWith('manual_')) {
        const fieldName = key.replace('manual_', '');
        manualExtras[fieldName] = req.body[key];
      }
    });

    // Validate file type
    if (file.mimetype !== 'application/pdf') {
      return next(createError('Only PDF files are allowed', 400));
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return next(createError('File size must be less than 10MB', 400));
    }

    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^\w.\-]+/g, '_');
    const s3Key = `uploads/${userId}/${timestamp}_${safeName}`;

    // Upload to S3
    try {
      await putPdf(s3Key, file.buffer);
    } catch (e: any) {
      const code = e?.$metadata?.httpStatusCode;
      const name = e?.name || 'Error';
      const msg = e?.message || String(e);
      console.error('S3 put failed:', { code, name, msg, bucket: S3_BUCKET, key: s3Key });
      return next(createError('Failed to upload file to S3', 500));
    }

    // Store in database
    const uploadResult = await pool.query(
      `INSERT INTO pdf_uploads (
        filename, original_name, s3_key, s3_url, file_size, mime_type, status, uploaded_by, extracted_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        file.originalname,
        file.originalname,
        s3Key,
        `https://${S3_BUCKET}.s3.amazonaws.com/${s3Key}`,
        file.size,
        file.mimetype,
        'UPLOADED',
        userId,
        JSON.stringify({ 
          insurer, 
          status: 'UPLOADED',
          manual_extras: manualExtras,
          uploaded_at: new Date().toISOString()
        })
      ]
    );

    const pdfUpload = uploadResult.rows[0];

    // For now, keep status as UPLOADED to satisfy DB constraint
    await pool.query(
      `UPDATE pdf_uploads SET status = $1 WHERE id = $2`,
      ['UPLOADED', pdfUpload.id]
    );

    res.json({
      success: true,
      message: 'PDF uploaded successfully. Processing is disabled.',
      data: {
        uploadId: pdfUpload.id,
        s3Key: s3Key,
        status: 'REVIEW'
      }
    } as ApiResponse<any>);

  } catch (error) {
    console.error('PDF upload error:', error);
    next(createError('Internal server error', 500));
  }
});

// INTERNAL ENDPOINTS FOR LAMBDA COMMUNICATION
// These endpoints are protected by internal token, not JWT

// Middleware to validate internal token
const validateInternalToken = (req: any, res: any, next: any) => {
  const internalToken = req.headers['x-internal-token'];
  
  if (!internalToken || internalToken !== process.env.INTERNAL_TOKEN) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid internal token' 
    });
  }
  
  next();
};

// Update upload status by S3 key (called by Lambda)
router.patch('/internal/by-s3key', validateInternalToken, async (req, res, next) => {
  try {
    const { s3Key, status, ...data } = req.body;
    
    if (!s3Key || !status) {
      return next(createError('s3Key and status are required', 400));
    }
    
    // Find upload by S3 key
    const uploadResult = await pool.query(
      'SELECT * FROM pdf_uploads WHERE s3_key = $1',
      [s3Key]
    );
    
    if (uploadResult.rows.length === 0) {
      return next(createError('Upload not found', 404));
    }
    
    const upload = uploadResult.rows[0];
    
    // Update status and additional data
    const updateResult = await pool.query(
      `UPDATE pdf_uploads SET 
        status = $1, 
        extracted_data = COALESCE(extracted_data, '{}'::jsonb) || $2::jsonb,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [status, JSON.stringify(data), upload.id]
    );
    
    res.json({
      success: true,
      message: 'Upload status updated successfully',
      data: updateResult.rows[0]
    } as ApiResponse<any>);
    
  } catch (error) {
    next(error);
  }
});

// Create policy from extracted data (called by Lambda)
router.post('/internal/by-s3key/parsed', validateInternalToken, async (req, res, next) => {
  try {
    const { s3Key, policyData, status } = req.body;
    
    if (!s3Key || !policyData) {
      return next(createError('s3Key and policyData are required', 400));
    }
    
    // Find upload by S3 key
    const uploadResult = await pool.query(
      'SELECT * FROM pdf_uploads WHERE s3_key = $1',
      [s3Key]
    );
    
    if (uploadResult.rows.length === 0) {
      return next(createError('Upload not found', 404));
    }
    
    const upload = uploadResult.rows[0];
    
    // Create policy record if confidence is high enough
    let policyId = null;
    if (policyData.confidence_score && policyData.confidence_score > 0.7) {
      const policyResult = await pool.query(
        `INSERT INTO policies (
          policy_number, vehicle_number, insurer, product_type, vehicle_type,
          make, model, issue_date, expiry_date, idv, ncb, net_od,
          total_od, net_premium, total_premium, cashback_amount,
          customer_paid, executive, caller_name, mobile, source,
          confidence_score, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) RETURNING id`,
        [
          policyData.policy_number || 'AUTO-' + Date.now(),
          policyData.vehicle_number || 'UNKNOWN',
          policyData.insurer || 'UNKNOWN',
          'AUTO', 'CAR',
          'UNKNOWN', 'UNKNOWN',
          policyData.issue_date || new Date(),
          policyData.expiry_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          policyData.idv || 0,
          policyData.ncb || 0,
          policyData.net_od || 0,
          policyData.total_od || 0,
          policyData.net_premium || 0,
          policyData.total_premium || 0,
          policyData.cashback_amount || 0,
          policyData.customer_paid || 0,
          'SYSTEM', 'PDF_EXTRACT', '0000000000',
          'PDF_UPLOAD',
          policyData.confidence_score,
          'system'
        ]
      );
      
      policyId = policyResult.rows[0].id;
    }
    
    // Update upload with policy ID and status
    await pool.query(
      `UPDATE pdf_uploads SET 
        status = $1,
        extracted_data = COALESCE(extracted_data, '{}'::jsonb) || $2::jsonb,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [status || 'REVIEW', JSON.stringify({ policyId, ...policyData }), upload.id]
    );
    
    res.json({
      success: true,
      message: 'Policy created from extracted data successfully',
      data: {
        uploadId: upload.id,
        policyId,
        status: status || 'REVIEW',
        extractedData: policyData
      }
    } as ApiResponse<any>);
    
  } catch (error) {
    next(error);
  }
});

// Internal route for Lambda to update upload status and data
router.post('/internal/by-s3key/:s3Key', async (req, res, next) => {
  try {
    const { s3Key } = req.params;
    const { extracted_data, status, error } = req.body;
    
    if (!s3Key) {
      return next(createError('S3 key is required', 400));
    }
    
    // Find the upload record by S3 key
    const uploadResult = await pool.query(
      'SELECT * FROM pdf_uploads WHERE s3_key = $1',
      [s3Key]
    );
    
    if (uploadResult.rows.length === 0) {
      return next(createError('Upload record not found', 404));
    }
    
    const upload = uploadResult.rows[0];
    const currentData = upload.extracted_data || {};
    
    // Merge extracted data with existing manual extras
    const updatedData = {
      ...currentData,
      status: status,
      updated_at: new Date().toISOString()
    };
    
    if (extracted_data) {
      updatedData.extracted_data = extracted_data;
    }
    
    if (error) {
      updatedData.error = error;
    }
    
    // Update the database
    const updateResult = await pool.query(
      `UPDATE pdf_uploads SET 
        status = $1, 
        extracted_data = $2,
        updated_at = CURRENT_TIMESTAMP
       WHERE s3_key = $3 RETURNING *`,
      [status, JSON.stringify(updatedData), s3Key]
    );
    
    res.json({
      success: true,
      message: 'Upload status updated successfully',
      data: updateResult.rows[0]
    });
    
  } catch (error) {
    console.error('Internal route error:', error);
    next(createError('Internal server error', 500));
  }
});

// Get upload by S3 key (for Lambda and internal use)
router.get('/internal/by-s3key/:s3Key', async (req, res, next) => {
  try {
    const { s3Key } = req.params;
    
    if (!s3Key) {
      return next(createError('S3 key is required', 400));
    }
    
    const uploadResult = await pool.query(
      'SELECT * FROM pdf_uploads WHERE s3_key = $1',
      [s3Key]
    );
    
    if (uploadResult.rows.length === 0) {
      return next(createError('Upload record not found', 404));
    }
    
    const upload = uploadResult.rows[0];
    
    res.json({
      success: true,
      message: 'Upload retrieved successfully',
      data: upload
    });
    
  } catch (error) {
    console.error('Get upload by S3 key error:', error);
    next(createError('Internal server error', 500));
  }
});

// Check upload status
router.get('/status/:uploadId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { uploadId } = req.params;
    const userId = req.user?.userId;

    // Get upload record
    const uploadResult = await pool.query(
      'SELECT * FROM pdf_uploads WHERE id = $1 AND uploaded_by = $2',
      [uploadId, userId]
    );

    if (uploadResult.rows.length === 0) {
      return next(createError('Upload not found', 404));
    }

    const upload = uploadResult.rows[0];
    
    res.json({
      success: true,
      message: 'Upload status retrieved',
      data: {
        status: upload.status,
        extractedData: upload.extracted_data,
        policyId: upload.extracted_data?.policyId
      }
    } as ApiResponse<any>);

  } catch (error) {
    next(error);
  }
});

// Get upload status
router.get('/pdf/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM pdf_uploads WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return next(createError('Upload not found', 404));
    }

    const upload = result.rows[0];
    
    // No background processing; simply return current status

    res.json({
      success: true,
      message: 'Upload status retrieved successfully',
      data: upload
    } as ApiResponse<any>);

  } catch (error) {
    next(error);
  }
});

// Detailed job status endpoint removed

// Get all uploads for user
router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.userId;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM pdf_uploads WHERE uploaded_by = $1';
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC LIMIT $' + paramIndex + ' OFFSET $' + (paramIndex + 1);
    params.push(parseInt(limit as string).toString(), parseInt(offset as string).toString());

    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      message: 'Uploads retrieved successfully',
      data: result.rows
    } as ApiResponse<PDFUpload[]>);

  } catch (error) {
    next(error);
  }
});

// Retry failed processing
router.post('/:uploadId/retry', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { uploadId } = req.params;
    const userId = req.user?.userId;

    // Get upload record
    const uploadResult = await pool.query(
      'SELECT * FROM pdf_uploads WHERE id = $1 AND uploaded_by = $2',
      [uploadId, userId]
    );

    if (uploadResult.rows.length === 0) {
      return next(createError('Upload not found', 404));
    }

    const upload = uploadResult.rows[0];

    // Only allow retry for failed uploads
    if (upload.status !== 'FAILED') {
      return next(createError('Only failed uploads can be retried', 400));
    }

    // Reset status to UPLOADED to trigger reprocessing
    await pool.query(
      'UPDATE pdf_uploads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['UPLOADED', uploadId]
    );

    res.json({
      success: true,
      message: 'Upload queued for reprocessing',
      data: {
        uploadId: upload.id,
        status: 'UPLOADED'
      }
    } as ApiResponse<any>);

  } catch (error) {
    next(error);
  }
});

// Delete upload (admin only)
router.delete('/:uploadId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { uploadId } = req.params;
    const userId = req.user?.userId;

    // Get upload record
    const uploadResult = await pool.query(
      'SELECT * FROM pdf_uploads WHERE id = $1 AND uploaded_by = $2',
      [uploadId, userId]
    );

    if (uploadResult.rows.length === 0) {
      return next(createError('Upload not found', 404));
    }

    const upload = uploadResult.rows[0];

    // Delete from S3
    try {
      await s3.deleteObject({
        Bucket: s3Config.bucketName,
        Key: upload.s3_key
      }).promise();
    } catch (s3Error) {
      console.error('Failed to delete from S3:', s3Error);
    }

    // Delete from database
    await pool.query('DELETE FROM pdf_uploads WHERE id = $1', [uploadId]);

    res.json({
      success: true,
      message: 'Upload deleted successfully'
    } as ApiResponse<any>);

  } catch (error) {
    next(error);
  }
});

export default router;
