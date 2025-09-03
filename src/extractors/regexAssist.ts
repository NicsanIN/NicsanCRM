// src/extractors/regexAssist.ts
export type Field = "policy_number"|"vehicle_number"|"issue_date"|"expiry_date"|
  "total_premium"|"idv"|"insurer"|"make"|"model"|"variant"|"fuel_type";

type Extraction = { value: string|null; confidence: number; source: "text"|"llm"|"none" };
type Output = Record<Field, Extraction>;

const rx = {
  // Dates like 21/09/2026 or 21-09-2026
  issueDate: /\b(?:Policy\s+Issue\s+Date|Date\s+of\s+Issue)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  expiryDate: /\b(?:Expiry\s*Date|Policy\s*Expiry)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,

  // Money/number blocks
  idv: /\b(?:Insured\s+Declared\s+Value|IDV)\b[^0-9]{0,20}([0-9][0-9,]{4,})/i,
  totalPremium: /\b(?:Total\s+Premium|Final\s*\/?\s*Gross\s*Premium|Net\s*Premium)\b[^0-9]{0,20}([0-9][0-9,]{2,})/i,

  // Header labels
  insurer: /\bTATA\s*AIG\s*GENERAL\s*INSURANCE\s*COMPANY\s*LIMITED\b/i,

  // "Make / Model / Variant" line → e.g., "Make / Model / Variant : MARUTI SUZUKI / SWIFT / VXI"
  mmvLine: /Make\s*\/\s*Model\s*\/\s*Variant\s*[:\-]?\s*([^\n\r]+)/i,

  // Fuel type (often a standalone label)
  fuelType: /\bFuel\s*Type\s*[:\-]?\s*([A-Za-z ]{3,15})/i,
};

const toISO = (d: string): string | null => {
  // Accept dd/mm/yyyy or dd-mm-yyyy → yyyy-mm-dd
  const m = d.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  const [_, dd, mm, yy] = m;
  const yyyy = yy.length === 2 ? (parseInt(yy) > 50 ? `19${yy}` : `20${yy}`) : yy;
  const dNum = Number(dd), mNum = Number(mm);
  if (dNum < 1 || dNum > 31 || mNum < 1 || mNum > 12) return null;
  return `${yyyy.padStart(4,'0')}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
};

const cleanNum = (s: string) => s.replace(/[^\d]/g, "");

export function applyRegexAssist(text: string, out: Output): Output {
  const res = { ...out };

  // ISSUE DATE
  if (!res.issue_date?.value) {
    const m = text.match(rx.issueDate);
    if (m) {
      const iso = toISO(m[1]);
      if (iso) res.issue_date = { value: iso, confidence: 0.9, source: "text" };
    }
  }

  // EXPIRY DATE (only if missing; you already have one)
  if (!res.expiry_date?.value) {
    const m = text.match(rx.expiryDate);
    if (m) {
      const iso = toISO(m[1]);
      if (iso) res.expiry_date = { value: iso, confidence: 0.9, source: "text" };
    }
  }

  // IDV
  if (!res.idv?.value) {
    const m = text.match(rx.idv);
    if (m) res.idv = { value: cleanNum(m[1]), confidence: 0.9, source: "text" };
  }

  // TOTAL PREMIUM
  if (!res.total_premium?.value) {
    const m = text.match(rx.totalPremium);
    if (m) res.total_premium = { value: cleanNum(m[1]), confidence: 0.9, source: "text" };
  }

  // INSURER
  if (!res.insurer?.value) {
    const m = text.match(rx.insurer);
    if (m) res.insurer = { value: m[0], confidence: 0.95, source: "text" };
  }

  // MAKE / MODEL / VARIANT
  if (!res.make?.value || !res.model?.value || !res.variant?.value) {
    const m = text.match(rx.mmvLine);
    if (m) {
      const parts = m[1].split(/\s*\/\s*/).map(x => x.trim()).filter(Boolean);
      if (parts.length >= 1 && !res.make?.value)    res.make    = { value: parts[0], confidence: 0.85, source: "text" };
      if (parts.length >= 2 && !res.model?.value)   res.model   = { value: parts[1], confidence: 0.85, source: "text" };
      if (parts.length >= 3 && !res.variant?.value) res.variant = { value: parts[2], confidence: 0.8,  source: "text" };
    }
  }

  // FUEL TYPE
  if (!res.fuel_type?.value) {
    const m = text.match(rx.fuelType);
    if (m) res.fuel_type = { value: m[1].toUpperCase(), confidence: 0.8, source: "text" };
  }

  return res;
}
