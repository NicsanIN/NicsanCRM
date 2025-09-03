import { runOpenAIExtractFast, type ExtractResult } from "./openaiExtractCore";
import { getPdfTextFast } from "./pdfTextExtractor";
import type { PolicyExtractV1 } from "../extraction/schema";
import { toInsurerHint, type InsurerHint } from "../extraction/insurerMap";
import { applyRegexAssist } from "../extractors/regexAssist";

export type ModelTag = "primary" | "secondary";

// ========= Evidence enforcement helpers =========
const RX = {
  policy_number: /policy\s*(no\.?|number)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
  vehicle_number: /(registration|regn)\s*(no\.?|number)\s*[:\-]?\s*([A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,2}\s*\d{3,4})/i,
  idv: /\b(IDV|Insured\s*Declared\s*Value)\b[\s:₹]*([0-9][0-9,\.]*)/i,
  total_premium: /(total|gross|final)\s*(premium|payable)\s*[:\-]?\s*(₹?\s*[0-9][0-9,\.]*)/i,
  issue_date: /(issue|issued)\s*(date)?\s*[:\-]?\s*([0-9]{4}\-[0-9]{2}\-[0-9]{2}|[0-9]{2}\/[0-9]{2}\/[0-9]{4}|[0-9]{1,2}[^\S\r\n]?[A-Z]{3}[^\S\r\n]?[0-9]{2,4})/i,
  expiry_date: /(expiry|valid\s*up\s*to|to)\s*(date)?\s*[:\-]?\s*([0-9]{4}\-[0-9]{2}\-[0-9]{2}|[0-9]{2}\/[0-9]{2}\/[0-9]{4}|[0-9]{1,2}[^\S\r\n]?[A-Z]{3}[^\S\r\n]?[0-9]{2,4})/i,
};

const normalizeRegNo = (s: string) => s.replace(/\s|-/g, '').toUpperCase();

export function hardGateAgainstPdfText(data: any, pdfText: string) {
  const t = pdfText || "";
  const up = t.toUpperCase();
  const out = { ...data };

  // Regex-first extraction (overrides LLM if concrete evidence exists)
  const mPol = t.match(RX.policy_number);
  if (mPol?.[2]) out.policy_number = { value: mPol[2].trim(), confidence: 0.9, source: "text" };

  const mVeh = t.match(RX.vehicle_number);
  if (mVeh?.[3]) out.vehicle_number = { value: normalizeRegNo(mVeh[3]), confidence: 0.9, source: "text" };

  const mIdv = t.match(RX.idv);
  if (mIdv?.[2]) out.idv = { value: mIdv[2].trim(), confidence: 0.9, source: "text" };

  const mPrem = t.match(RX.total_premium);
  if (mPrem?.[3]) out.total_premium = { value: mPrem[3].trim(), confidence: 0.9, source: "text" };

  const mIssue = t.match(RX.issue_date);
  if (mIssue?.[3]) out.issue_date = { value: mIssue[3].trim(), confidence: 0.9, source: "text" };

  const mExpiry = t.match(RX.expiry_date);
  if (mExpiry?.[3]) out.expiry_date = { value: mExpiry[3].trim(), confidence: 0.9, source: "text" };

  // Belt-and-suspenders: if a value doesn't literally appear in pdfText, null it.
  const keepIfPresent = (k: keyof typeof out, projector?: (v: string)=>string) => {
    const v = out?.[k]?.value ?? null;
    if (!v) { out[k] = { value: null, confidence: 0, source: "none" }; return; }
    let needle = String(v).toUpperCase();
    let hay = up;
    if (k === 'vehicle_number') { needle = normalizeRegNo(needle); hay = hay.replace(/\s|-/g, ''); }
    if (!(hay.includes(needle))) out[k] = { value: null, confidence: 0, source: "none" };
    else out[k] = { value: String(v), confidence: 0.9, source: "text" };
  };

  for (const k of ["policy_number","vehicle_number","issue_date","expiry_date","total_premium","idv"] as const) {
    keepIfPresent(k);
  }

  return out;
}

export async function extractFromPdfWithOpenAI(params: {
  s3Key: string;
  insurerHint?: "TATA_AIG" | "DIGIT" | null;
  uploadId: string;
  model?: ModelTag;
}) {
  const { s3Key, insurerHint, uploadId, model = "primary" } = params;
  console.log("[openaiExtract] model from caller:", model);

  const pdfText = await getPdfTextFast(s3Key); // your existing fast extractor

  // NO AUTO-RETRY — Option B
  return runOpenAIExtractFast({
    uploadId,
    modelTag: model,    // <-- respect caller's choice
    insurerHint: insurerHint ?? null,
    pdfText,
  });
}

// Function that accepts pdfText directly (for OCR use case)
export async function extractWithOpenAI(input: { pdfText: string; modelTag: 'primary' | 'secondary' }) {
  const { pdfText, modelTag } = input;

  // 1) Call your OpenAI core with the text you ALREADY have (no S3 fetch here)
  const llmJson = await runOpenAIExtractFast({ 
    uploadId: 'temp', // placeholder since we don't need real uploadId for text-first
    modelTag, 
    insurerHint: null,
    pdfText 
  });

  if (!llmJson.ok) {
    throw new Error(`Extraction failed: ${llmJson.code} - ${llmJson.hint}`);
  }

  // 2) Wrap into { value, confidence, source } as you already do
  const wrapped = {
    schema_version: '1.0' as const,
    policy_number: { value: llmJson.data.policy_number ?? null, confidence: 0.6, source: 'llm' as const },
    vehicle_number:{ value: llmJson.data.vehicle_number ?? null, confidence: 0.6, source: 'llm' as const },
    issue_date:    { value: llmJson.data.issue_date ?? null, confidence: 0.6, source: 'llm' as const },
    expiry_date:   { value: llmJson.data.expiry_date ?? null, confidence: 0.6, source: 'llm' as const },
    total_premium: { value: llmJson.data.total_premium ?? null, confidence: 0.6, source: 'llm' as const },
    idv:           { value: llmJson.data.idv ?? null, confidence: 0.6, source: 'llm' as const },
    insurer:       { value: llmJson.data.insurer ?? null, confidence: 0.6, source: 'llm' as const },
    make:          { value: null, confidence: 0, source: 'llm' as const },
    model:         { value: null, confidence: 0, source: 'llm' as const },
    variant:       { value: null, confidence: 0, source: 'llm' as const },
    fuel_type:     { value: null, confidence: 0, source: 'llm' as const },
    __debug__:     { evidence_snippet: 'openai:windowed' },
  };

  // 3) **Regex Assist**: fill missing fields with regex patterns
  if (process.env.DEBUG_REGEX === "1") {
    console.log("[assist] text length:", pdfText.length); // should be ~24000 here, not a tiny window
  }
  const assisted = applyRegexAssist(pdfText, wrapped);
  
  // 4) **Gatekeeper**: zero-out anything not literally present in pdfText (your function)
  const hardened = hardGateAgainstPdfText(assisted, pdfText);
  return hardened;
}

type Field<T> = { value: T | null; confidence: number; source: "llm" | "regex" | "manual" | "merged"; note?: string };

export function adaptOpenAIToFieldWrapper(d: ExtractResult, pdfText?: string): PolicyExtractV1 {
  const wrap = <T>(v: T | null, c = 0.8): Field<T> => ({
    value: v ?? null,
    confidence: v == null ? 0 : c,
    source: "llm",
  });

  // Create initial wrapped data
  const initialData = {
    schema_version: "1.0" as const,

    // 🔧 Narrow to the schema union BEFORE wrapping
    insurer:        wrap<InsurerHint>(toInsurerHint(d.insurer), 0.9),

    policy_number:  wrap(d.policy_number,  0.95),
    vehicle_number: wrap(d.vehicle_number, 0.9),
    issue_date:     wrap(d.issue_date,     0.9),
    expiry_date:    wrap(d.expiry_date,    0.9),
    total_premium:  wrap(d.total_premium,  0.9),

    // Updated to match new schema
    idv:            wrap(d.idv,            0.85),

    // optional UI fields (keep keys stable even if null)
    make:           wrap(null,             0),
    model:          wrap(null,             0),
    variant:        wrap(null,             0),
    fuel_type:      wrap(null,             0),

    __debug__: { evidence_snippet: "openai:windowed" },
  };

  // Apply evidence enforcement if pdfText is provided
  if (pdfText) {
    return hardGateAgainstPdfText(initialData, pdfText);
  }

  return initialData;
}
