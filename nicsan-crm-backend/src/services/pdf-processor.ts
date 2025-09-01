import AWS from 'aws-sdk';
import { s3, s3Config } from '../config/aws';
import pool from '../config/database';
import { PDFUpload, Policy } from '../types';

export class PDFProcessor {
  private static instance: PDFProcessor;

  private constructor() {}

  static getInstance(): PDFProcessor {
    if (!PDFProcessor.instance) {
      PDFProcessor.instance = new PDFProcessor();
    }
    return PDFProcessor.instance;
  }

  /**
   * Generate presigned URL for secure PDF upload
   */
  async generatePresignedUploadUrl(filename: string, userId: string): Promise<string> {
    const timestamp = Date.now();
    const s3Key = `uploads/${timestamp}_${filename}`;
    
    const presignedUrl = s3.getSignedUrl('putObject', {
      Bucket: s3Config.bucketName,
      Key: s3Key,
      Expires: 3600, // 1 hour
      ContentType: 'application/pdf',
      Metadata: {
        originalName: filename,
        uploadedBy: userId,
        timestamp: timestamp.toString()
      }
    });

    return presignedUrl;
  }

  /**
   * Extract policy data from parsed text (placeholder for new extraction method)
   */
  extractPolicyData(blocks: any[]): Partial<Policy> {
    const extractedData: Partial<Policy> = {};
    
    if (!blocks) return extractedData;

    // Extract text from blocks (generic parsing placeholder)
    const textBlocks = Array.isArray(blocks) ? blocks.filter((block: any) => block.BlockType === 'LINE') : [];
    const text = textBlocks.map((block: any) => block.Text).join(' ');

    // Extract key-value pairs
    const keyValueBlocks = Array.isArray(blocks) ? blocks.filter((block: any) => block.BlockType === 'KEY_VALUE_SET') : [];
    
    keyValueBlocks.forEach(block => {
      if (block.EntityType === 'KEY') {
        const key = block.Key?.Text?.toLowerCase();
        const value = block.Value?.Text;
        
        if (key && value) {
          // Map extracted text to ALL manual form fields
          switch (key) {
            // Basic Policy Info
            case 'policy number':
            case 'policy no':
            case 'policy no.':
            case 'policy':
              extractedData.policy_number = value;
              break;
            case 'vehicle number':
            case 'vehicle no':
            case 'registration no':
            case 'reg no':
            case 'registration number':
              extractedData.vehicle_number = value;
              break;
            case 'insurer':
            case 'insurance company':
            case 'company':
              extractedData.insurer = value;
              break;
            case 'product type':
            case 'product':
              extractedData.product_type = value;
              break;
            case 'vehicle type':
            case 'type':
              extractedData.vehicle_type = value;
              break;
            
            // Vehicle Details
            case 'make':
            case 'brand':
              extractedData.make = value;
              break;
            case 'model':
              extractedData.model = value;
              break;
            case 'cc':
            case 'engine cc':
            case 'engine capacity':
              extractedData.cc = value;
              break;
            case 'manufacturing year':
            case 'year':
            case 'mfg year':
              extractedData.manufacturing_year = value;
              break;
            
            // Policy Dates
            case 'issue date':
            case 'start date':
            case 'inception date':
            case 'policy start':
              extractedData.issue_date = this.parseDate(value);
              break;
            case 'expiry date':
            case 'end date':
            case 'policy end':
              extractedData.expiry_date = this.parseDate(value);
              break;
            
            // Financial Details
            case 'idv':
            case 'insured declared value':
            case 'sum insured':
              extractedData.idv = parseFloat(value.replace(/[^\d.]/g, ''));
              break;
            case 'ncb':
            case 'no claim bonus':
            case 'ncb discount':
              extractedData.ncb = parseFloat(value.replace(/[^\d.]/g, ''));
              break;
            case 'discount':
            case 'additional discount':
              extractedData.discount = parseFloat(value.replace(/[^\d.]/g, ''));
              break;
            case 'net od':
            case 'net own damage':
            case 'own damage net':
              extractedData.net_od = parseFloat(value.replace(/[^\d.]/g, ''));
              break;
            case 'ref':
            case 'refund':
              extractedData.ref = value; // Keep as string as per type definition
              break;
            case 'total od':
            case 'total own damage':
            case 'own damage total':
              extractedData.total_od = parseFloat(value.replace(/[^\d.]/g, ''));
              break;
            case 'net premium':
            case 'premium net':
              extractedData.net_premium = parseFloat(value.replace(/[^\d.]/g, ''));
              break;
            case 'total premium':
            case 'premium amount':
            case 'premium':
              extractedData.total_premium = parseFloat(value.replace(/[^\d.]/g, ''));
              break;
            case 'cashback percentage':
            case 'cashback %':
            case 'cb %':
              extractedData.cashback_percentage = parseFloat(value.replace(/[^\d.]/g, ''));
              break;
            case 'cashback amount':
            case 'cashback':
            case 'cb amount':
              extractedData.cashback_amount = parseFloat(value.replace(/[^\d.]/g, ''));
              break;
            case 'customer paid':
            case 'amount paid':
            case 'paid amount':
              extractedData.customer_paid = parseFloat(value.replace(/[^\d.]/g, ''));
              break;
            case 'customer cheque no':
            case 'cheque no':
            case 'cheque number':
              extractedData.customer_cheque_no = value;
              break;
            case 'our cheque no':
            case 'our cheque':
              extractedData.our_cheque_no = value;
              break;
            
            // Personnel Details
            case 'executive':
            case 'agent':
            case 'sales rep':
              extractedData.executive = value;
              break;
            case 'caller name':
            case 'customer name':
            case 'insured name':
              extractedData.caller_name = value;
              break;
            case 'mobile':
            case 'phone':
            case 'contact':
              extractedData.mobile = value;
              break;
            
            // Additional Details
            case 'rollover':
            case 'roll over':
              extractedData.rollover = value;
              break;
            case 'remark':
            case 'remarks':
            case 'notes':
              extractedData.remark = value;
              break;
            case 'brokerage':
            case 'brokerage amount':
              extractedData.brokerage = parseFloat(value.replace(/[^\d.]/g, ''));
              break;
            case 'cashback':
            case 'cashback total':
              extractedData.cashback = parseFloat(value.replace(/[^\d.]/g, ''));
              break;
          }
        }
      }
    });

    // Also try to extract from general text using regex patterns
    this.extractFromText(text, extractedData);

    // Calculate confidence score based on extracted fields
    const extractedFields = Object.keys(extractedData).filter(key => extractedData[key] !== undefined && extractedData[key] !== '').length;
    const confidenceScore = Math.min(0.95, 0.3 + (extractedFields * 0.05));

    return {
      ...extractedData,
      source: 'PDF_UPLOAD',
      confidence_score: confidenceScore
    };
  }

  /**
   * Extract additional data from text using regex patterns
   */
  private extractFromText(text: string, extractedData: Partial<Policy>): void {
    // Policy number patterns
    if (!extractedData.policy_number) {
      const policyMatch = text.match(/(?:policy|policy\s+no|policy\s+number)[:\s]*([A-Z0-9\-]+)/i);
      if (policyMatch) extractedData.policy_number = policyMatch[1];
    }

    // Vehicle number patterns
    if (!extractedData.vehicle_number) {
      const vehicleMatch = text.match(/(?:vehicle|registration|reg)[:\s]*([A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4})/i);
      if (vehicleMatch) extractedData.vehicle_number = vehicleMatch[1];
    }

    // Premium patterns
    if (!extractedData.total_premium) {
      const premiumMatch = text.match(/(?:total\s+premium|premium|amount)[:\s]*₹?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
      if (premiumMatch) extractedData.total_premium = parseFloat(premiumMatch[1].replace(/,/g, ''));
    }

    // IDV patterns
    if (!extractedData.idv) {
      const idvMatch = text.match(/(?:idv|insured\s+declared\s+value|sum\s+insured)[:\s]*₹?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
      if (idvMatch) extractedData.idv = parseFloat(idvMatch[1].replace(/,/g, ''));
    }

    // NCB patterns
    if (!extractedData.ncb) {
      const ncbMatch = text.match(/(?:ncb|no\s+claim\s+bonus)[:\s]*([0-9]+(?:\.[0-9]+)?)\s*%/i);
      if (ncbMatch) extractedData.ncb = parseFloat(ncbMatch[1]);
    }

    // Date patterns
    if (!extractedData.issue_date) {
      const issueMatch = text.match(/(?:issue|start|inception)[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i);
      if (issueMatch) extractedData.issue_date = this.parseDate(issueMatch[1]);
    }

    if (!extractedData.expiry_date) {
      const expiryMatch = text.match(/(?:expiry|end|valid\s+upto)[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i);
      if (expiryMatch) extractedData.expiry_date = this.parseDate(expiryMatch[1]);
    }

    // Make/Model patterns
    if (!extractedData.make) {
      const makeMatch = text.match(/(?:make|brand)[:\s]*([A-Za-z]+)/i);
      if (makeMatch) extractedData.make = makeMatch[1];
    }

    if (!extractedData.model) {
      const modelMatch = text.match(/(?:model)[:\s]*([A-Za-z0-9\s]+)/i);
      if (modelMatch) extractedData.model = modelMatch[1].trim();
    }

    // Cashback patterns
    if (!extractedData.cashback_amount) {
      const cashbackMatch = text.match(/(?:cashback|cb)[:\s]*₹?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
      if (cashbackMatch) extractedData.cashback_amount = parseFloat(cashbackMatch[1].replace(/,/g, ''));
    }

    // Brokerage patterns
    if (!extractedData.brokerage) {
      const brokerageMatch = text.match(/(?:brokerage|commission)[:\s]*₹?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
      if (brokerageMatch) extractedData.brokerage = parseFloat(brokerageMatch[1].replace(/,/g, ''));
    }
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;
    
    try {
      // Try different date formats
      const formats = [
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, // DD/MM/YYYY or DD-MM-YYYY
        /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, // YYYY/MM/DD or YYYY-MM-DD
      ];
      
      for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
          if (match[1].length === 4) {
            // YYYY-MM-DD format
            return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
          } else {
            // DD-MM-YYYY format (assuming Indian date format)
            return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
          }
        }
      }
      
      // If no format matches, try direct parsing
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
      
      return undefined;
    } catch (error) {
      console.warn(`Failed to parse date: ${dateStr}`, error);
      return undefined;
    }
  }

  // Background job status handling for external extraction can be added here

  /**
   * Calculate confidence score from parsed text
   */
  private calculateConfidenceScore(blocks: any[]): number {
    if (!blocks || blocks.length === 0) return 0;
    
    const textBlocks = blocks.filter(block => block.BlockType === 'LINE');
    if (textBlocks.length === 0) return 0;
    
    const totalConfidence = textBlocks.reduce((sum, block) => sum + (block.Confidence || 0), 0);
    return Math.round((totalConfidence / textBlocks.length) * 100) / 100;
  }

  /**
   * Clean up processed PDF files
   */
  async cleanupProcessedPDF(s3Key: string): Promise<void> {
    try {
      await s3.deleteObject({
        Bucket: s3Config.bucketName,
        Key: s3Key
      }).promise();
      
      console.log(`PDF cleaned up: ${s3Key}`);
    } catch (error) {
      console.error('Failed to cleanup PDF:', error);
      // Don't throw error for cleanup failures
    }
  }

  /**
   * Complete PDF processing workflow
   */
  async completeProcessing(uploadId: string, policyData: Partial<Policy>): Promise<void> {
    try {
      // Update upload status
      await pool.query(
        'UPDATE pdf_uploads SET status = $1, extracted_data = $2 WHERE id = $3',
        ['COMPLETED', policyData, uploadId]
      );

      // Create policy record if confidence is high enough
      if (policyData.confidence_score && policyData.confidence_score > 0.7) {
        await pool.query(
          `INSERT INTO policies (
            policy_number, vehicle_number, insurer, product_type, vehicle_type,
            make, model, issue_date, expiry_date, idv, ncb, net_od,
            total_od, net_premium, total_premium, cashback_amount,
            customer_paid, executive, caller_name, mobile, source,
            confidence_score, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
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
      }

    } catch (error) {
      console.error('Failed to complete processing:', error);
      throw error;
    }
  }
}

export default PDFProcessor.getInstance();
