import { getPdfTextFast } from '../services/pdfTextExtractor';
import { ocrPdfFromS3ToText } from '../services/ocrTextract';
import { extractWithOpenAI } from '../services/openaiExtract';

const TEXT_SOURCE = (process.env.EXTRACT_TEXT_SOURCE ?? 'fast') as 'fast'|'ocr'|'auto';
const THIN_TEXT_THRESHOLD = Number(process.env.THIN_TEXT_THRESHOLD ?? 500);

async function getPdfTextSelected(s3Key: string, uploadId?: string): Promise<{ text: string; via: 'fast'|'ocr' }> {
  if (TEXT_SOURCE === 'ocr') {
    if (uploadId) {
      const { text } = await ocrPdfFromS3ToText({ uploadId, s3Key });
      return { text, via: 'ocr' };
    } else {
      // Fallback for backward compatibility
      const { text } = await ocrPdfFromS3ToText({ uploadId: 'legacy', s3Key });
      return { text, via: 'ocr' };
    }
  }
  if (TEXT_SOURCE === 'fast') {
    const text = await getPdfTextFast(s3Key);
    return { text, via: 'fast' };
  }
  // auto
  const fast = await getPdfTextFast(s3Key);
  if (!fast || fast.length < THIN_TEXT_THRESHOLD) {
    if (uploadId) {
      const { text: ocr } = await ocrPdfFromS3ToText({ uploadId, s3Key });
      return (ocr?.length ?? 0) > (fast?.length ?? 0) ? { text: ocr, via: 'ocr' } : { text: fast, via: 'fast' };
    } else {
      // Fallback for backward compatibility
      const { text: ocr } = await ocrPdfFromS3ToText({ uploadId: 'legacy', s3Key });
      return (ocr?.length ?? 0) > (fast?.length ?? 0) ? { text: ocr, via: 'ocr' } : { text: fast, via: 'fast' };
    }
  }
  return { text: fast, via: 'fast' };
}

export async function extractFromPdf(upload: { s3_key: string; id?: string }, modelTag: 'primary' | 'secondary') {
  // text timing
  const tText0 = Date.now();
  const { text: pdfText, via } = await getPdfTextSelected(upload.s3_key, upload.id);
  const text_ms = Date.now() - tText0;

  // llm timing
  const tLlm0 = Date.now();
  const data = await extractWithOpenAI({ pdfText, modelTag });
  const llm_ms = Date.now() - tLlm0;

  const meta = {
    via,                         // 'fast' | 'ocr'
    modelTag,                    // 'primary' | 'secondary'
    pdfTextChars: pdfText?.length ?? 0,
    text_ms,                    // time to get text (fast or ocr)
    llm_ms,                     // time to run OpenAI
    total_ms: text_ms + llm_ms, // end-to-end
  };
  return { data, meta };
}


