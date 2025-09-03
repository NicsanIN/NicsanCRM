import OpenAI from "openai";
import { z } from "zod";
import util from "node:util";

// ========= Strict output schema =========
export const ExtractSchema = z.object({
  schema_version: z.literal("1.0"),
  policy_number: z.string().nullable(),
  vehicle_number: z.string().nullable(),
  insurer: z.string().nullable(),

  issue_date: z.string().nullable(),
  expiry_date: z.string().nullable(),

  total_premium: z.number().nullable(),
  net_od: z.number().nullable(),
  idv: z.number().nullable(),
});
export type ExtractResult = z.infer<typeof ExtractSchema>;

// ---- JSON Schema passed to OpenAI response_format ----
const MotorPolicyJsonSchema = {
  name: "MotorPolicySchema",
  schema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    properties: {
      schema_version: { type: "string", enum: ["1.0"] },

      policy_number:  { type: ["string", "null"] },
      vehicle_number: { type: ["string", "null"] },
      insurer:        { type: ["string", "null"] },

      issue_date:     { type: ["string", "null"], description: "YYYY-MM-DD if known" },
      expiry_date:    { type: ["string", "null"], description: "YYYY-MM-DD if known" },

      total_premium:  { type: ["string", "null"] },
      net_od:         { type: ["string", "null"] },
      idv:            { type: ["string", "null"] },
    },
    // CRITICAL: with strict: true, all properties must be listed here
    required: [
      "schema_version",
      "policy_number",
      "vehicle_number",
      "insurer",
      "issue_date",
      "expiry_date",
      "total_premium",
      "net_od",
      "idv"
    ]
  },
  strict: true
} as const;

// ========= Lightweight cache (in-memory) =========
const cache = new Map<string, { until: number; data: any }>();
function getCache(key: string) {
  const v = cache.get(key); if (!v) return null;
  if (Date.now() > v.until) { cache.delete(key); return null; }
  return v.data;
}
function setCache(key: string, data: any) {
  const ttl = Number(process.env.OPENAI_EXTRACT_CACHE_TTL_SEC || 120) * 1000;
  cache.set(key, { until: Date.now() + ttl, data });
}

// ========= Tiny windowing (fast context) =========
function buildWindows(fullText: string) {
  const text = fullText
    .replace(/\u00A0/g, " ").replace(/\u200B/g, "")
    .replace(/[ ]{2+}/g, " ");

  // Keep only probable sections (no parsing – just slicing for speed)
  const anchors = [
    /Vehicle Details/gi,
    /YOUR VEHICLE IDV/gi,
    /Insured Declared Value.*IDV/gi,
    /Schedule of Premium/gi,
    /Premium/i,
    /Policy No/i,
    /Registration No/i
  ];

  const chunks: string[] = [];
  anchors.forEach(rx => {
    const m = rx.exec(text);
    if (m) {
      const start = Math.max(0, m.index - 800);   // small lead-in
      const end   = Math.min(text.length, m.index + 2200); // short tail
      chunks.push(text.slice(start, end));
    }
  });

  // Fallback: first N chars if nothing hit
  if (chunks.length === 0) chunks.push(text.slice(0, 4000));

  // Dedup & cap total size
  const joined = Array.from(new Set(chunks)).join("\n\n---\n\n");
  return joined.length > 8000 ? joined.slice(0, 8000) : joined;
}

// ========= Model picker =========
function modelFor(tag: "primary" | "secondary") {
  return tag === "secondary"
    ? (process.env.OPENAI_MODEL_SECONDARY || "gpt-4.1-mini")
    : (process.env.OPENAI_MODEL_PRIMARY || "gpt-4o-mini");
}

// ========= Message builder (no guessing allowed) =========
function buildMessages(pdfText: string) {
  const SYSTEM = `
You are an extraction engine. Follow these rules, no exceptions:
- OUTPUT MUST MATCH THE JSON SCHEMA EXACTLY.
- NEVER GUESS. If a field is not explicitly present in pdfText, set it to null.
- Use only characters that appear in pdfText (ignore formatting like spaces and dashes).
- Dates must be YYYY-MM-DD if present, else null.
- Vehicle Reg must match Indian formats like KA01AB1234 or with spaces/dashes found in pdfText.
- If multiple candidates exist, pick the one closest to the labels listed below.
- If confidence < 0.6, return null.

Label hints:
- Policy Number: near "Policy No", "Policy Number"
- Registration Number: near "Registration No", "Regn No"
- Issue Date: near "Issue Date", "Date of Issue"
- Expiry Date: near "Expiry Date", "Valid up to"
- Total Premium: near "Gross/Final/Total Premium", "Total Payable"
- IDV: near "Insured Declared Value", "IDV"
  `.trim();

  // we include the raw text as a user message; the model must only use this
  const USER = [
    { role: "user" as const, content: "pdfText (first 4 pages) follows between <pdf> tags" },
    { role: "user" as const, content: `<pdf>\n${pdfText}\n</pdf>` },
    { role: "user" as const, content: "Extract strictly per schema. If not explicitly found in <pdf>, return null." }
  ];

  return [{ role: "system" as const, content: SYSTEM }, ...USER];
}

// ========= Post-filter helpers (belt-and-suspenders) =========
const FINDERS = {
  policy_number: /policy\s*(no\.?|number)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
  vehicle_number: /(registration|regn)\s*(no\.?|number)\s*[:\-]?\s*([A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,2}\s*\d{3,4})/i,
  issue_date: /(issue|issued)\s*(date)?\s*[:\-]?\s*([0-9]{1,2}[^\S\r\n]?[A-Z]{3}[^\S\r\n]?[0-9]{2,4}|[0-9]{4}\-[0-9]{2}\-[0-9]{2}|[0-9]{2}\/[0-9]{2}\/[0-9]{4})/i,
  expiry_date: /(expiry|valid\s*up\s*to|to)\s*(date)?\s*[:\-]?\s*([0-9]{1,2}[^\S\r\n]?[A-Z]{3}[^\S\r\n]?[0-9]{2,4}|[0-9]{4}\-[0-9]{2}\-[0-9]{2}|[0-9]{2}\/[0-9]{2}\/[0-9]{4})/i,
  total_premium: /(total|gross|final)\s*(premium|payable)\s*[:\-]?\s*(₹?\s*[0-9][0-9,\.]*)/i,
  idv: /\b(IDV|Insured\s*Declared\s*Value)\b[\s:₹]*([0-9][0-9,\.]*)/i,
};

function normalizeRegNo(raw: string) {
  return raw.replace(/\s|-/g, '').toUpperCase(); // KA01AB1234
}

function inTextOrNull(field: string, value: string | null, pdfText: string) {
  if (!value) return null;
  const hay = pdfText.toUpperCase();
  const needle = value.toString().toUpperCase();

  // Special handling for reg no: allow spaces/dashes variants
  if (field === 'vehicle_number') {
    const norm = normalizeRegNo(value);
    const normHay = hay.replace(/\s|-/g, '');
    return normHay.includes(norm) ? value : null;
  }

  return hay.includes(needle) ? value : null;
}

function postFilterAgainstText(data: ExtractResult, pdfText: string): ExtractResult {
  // 1) Prefer regex anchors; if they match, keep them.
  // 2) Else, drop values that don't literally appear in text.
  const out = { ...data };

  // Try regex extraction where possible (stronger than LLM)
  const t = pdfText;

  // Policy number
  const mPol = t.match(FINDERS.policy_number);
  if (mPol?.[2]) out.policy_number = mPol[2].trim();

  // Vehicle number
  const mVeh = t.match(FINDERS.vehicle_number);
  if (mVeh?.[3]) out.vehicle_number = normalizeRegNo(mVeh[3]);

  // Issue/Expiry dates & amounts (leave formatting to later if needed)
  const mIssue = t.match(FINDERS.issue_date);
  if (mIssue?.[3]) out.issue_date = mIssue[3].trim();

  const mExpiry = t.match(FINDERS.expiry_date);
  if (mExpiry?.[3]) out.expiry_date = mExpiry[3].trim();

  const mPrem = t.match(FINDERS.total_premium);
  if (mPrem?.[3]) out.total_premium = num(mPrem[3].trim());

  const mIdv = t.match(FINDERS.idv);
  if (mIdv?.[2]) out.idv = num(mIdv[2].trim());

  // Now drop anything that still isn't substantiated in the raw text
  for (const k of ["policy_number","vehicle_number","issue_date","expiry_date"] as const) {
    const v = out[k];
    const safe = inTextOrNull(k, v, pdfText);
    if (safe === null) {
      out[k] = null;
    } else {
      out[k] = safe;
    }
  }

  // Handle numeric fields separately
  for (const k of ["total_premium","idv"] as const) {
    const v = out[k];
    if (v !== null) {
      const safe = inTextOrNull(k, String(v), pdfText);
      if (safe === null) {
        out[k] = null;
      }
      // Keep the numeric value if it's found in text
    }
  }

  return out;
}

// ========= Numeric coercer =========
const num = (v: any) =>
  v === null || v === "" ? null :
  typeof v === "number" ? v :
  typeof v === "string" ? (Number(v.replace(/[,\s₹]/g,"")) || null) :
  null;

// ========= Main call (no auto-retry) =========
export async function runOpenAIExtractFast(args: {
  uploadId: string;
  modelTag: "primary" | "secondary";
  insurerHint: "TATA_AIG" | "DIGIT" | null;
  pdfText: string;
}) {
  const { modelTag, uploadId, insurerHint, pdfText } = args;

  const model =
    modelTag === "secondary"
      ? (process.env.OPENAI_MODEL_SECONDARY || "gpt-4.1-mini")
      : (process.env.OPENAI_MODEL_PRIMARY  || "gpt-4o-mini");

  console.log("[openaiCore] modelTag:", modelTag, "→ model:", model);
  console.log("[openaiCore] pdfText length:", pdfText?.length ?? -1);

  const cacheKey = `${modelTag}:${uploadId}`;
  const hit = getCache(cacheKey);
  if (hit) return hit;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 4000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const windowed = buildWindows(pdfText);

  try {
    const resp = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_schema", json_schema: MotorPolicyJsonSchema },
      messages: buildMessages(windowed),
    }, { signal: controller.signal });

    clearTimeout(timer);

    const rawText = resp.choices?.[0]?.message?.content ?? "{}";
    let raw: any = {};
    try { raw = JSON.parse(rawText); } catch { /* invalid JSON -> handled below */ }

    // numeric coercion - simplified for new schema
    raw.total_premium  = num(raw.total_premium);
    raw.net_od         = num(raw.net_od);
    raw.idv            = num(raw.idv);

    // validate
    const data = ExtractSchema.parse(raw);

    // Apply post-filter to ensure only text-substantiated values
    const hardened = postFilterAgainstText(data, pdfText);

    const result = { ok: true as const, model, data: hardened };
    setCache(cacheKey, result);
    return result;
  } catch (err: any) {
    clearTimeout(timer);
    
    // ---- TEMP DIAGNOSTIC: bubble up full detail once ----
    const msg   = String(err?.message || err);
    const name  = String(err?.name || "Error");
    const stat  = (err?.status ?? err?.response?.status ?? null) as number | null;
    const data  = err?.response?.data ?? null;
    const stack = (err?.stack ? String(err.stack).split("\n").slice(0,8).join("\n") : null);

    console.error("[openaiCore][DIAG] name:", name);
    console.error("[openaiCore][DIAG] msg:", msg);
    if (stat)  console.error("[openaiCore][DIAG] status:", stat);
    if (data)  console.error("[openaiCore][DIAG] data:", JSON.stringify(data).slice(0,1000));
    if (stack) console.error("[openaiCore][DIAG] stack:", stack);

    // Keep model-specific code so UI knows which path failed
    return {
      ok: false,
      code: `${modelTag}_unknown` as const,
      hint: "diagnostic payload attached",
      detail: { name, msg, status: stat, data },   // <-- TEMP: send back to client
    };
  }
}

