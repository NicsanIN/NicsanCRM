/**
 * PDF text extractor with coordinate information
 * Uses pdf-parse for real text extraction
 */

import * as pdfParse from 'pdf-parse';

export interface TextLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextPage {
  pageNumber: number;
  lines: TextLine[];
}

export interface PdfTextResult {
  pages: TextPage[];
}

/**
 * Extract text from PDF buffer with coordinate information
 * Uses pdf-parse for real text extraction
 */
export async function getPdfTextWithCoords(
  buffer: Buffer, 
  options: { pageLimit?: number } = {}
): Promise<PdfTextResult> {
  try {
    console.log('🔍 PDF Text Extraction Debug:', {
      bufferLength: buffer?.length,
      bufferType: typeof buffer,
      isBuffer: Buffer.isBuffer(buffer)
    });
    
    // Use pdf-parse to extract text from the PDF
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;
    
    console.log('🔍 PDF Parse Result:', {
      textLength: text?.length,
      textPreview: text?.substring(0, 200),
      hasText: !!text
    });
    
    // Split text into lines and create a simple structure
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    console.log('🔍 Extracted Lines:', {
      lineCount: lines.length,
      firstFewLines: lines.slice(0, 3)
    });
    
    const pages: TextPage[] = [{
      pageNumber: 1,
      lines: lines.map((line, index) => ({
        text: line.trim(),
        x: 0,
        y: index * 20, // Simple vertical positioning
        width: line.length * 8, // Rough width estimate
        height: 16
      }))
    }];
    
    return { pages };
  } catch (error) {
    console.error('PDF parsing error:', error);
    // Fallback to empty result if parsing fails
    return { pages: [] };
  }
}


