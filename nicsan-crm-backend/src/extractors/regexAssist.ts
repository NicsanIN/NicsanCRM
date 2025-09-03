// src/extractors/regexAssist.ts
export type Field = "policy_number"|"vehicle_number"|"issue_date"|"expiry_date"|
  "total_premium"|"idv"|"insurer"|"make"|"model"|"variant"|"fuel_type";

type Extraction = { value: string|null; confidence: number; source: "text"|"llm"|"none" };
type Output = Record<Field, Extraction>;

const rx = {
  // --- Date from the Period table (Valid From) ---
  validFromDate: /\bValid\s*From\b[^0-9A-Za-z]{0,12}(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})(?:\s*\(\d{1,2}:\d{2}\s*(?:HRS|Hrs|hrs)?\))?/i,

  // Add paired dates: "From 21/09/2025 To 20/09/2026" (take the 'From' as issue/start)
  issueFromTo: /\bFrom\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})(?:\s*\d{1,2}:\d{2}\s*(?:HRS|hrs)?)?\s*To\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,

  // Generic "from ... to ..." with many separators & optional time/brackets
  issueFromToWide: /\b(?:Period\s+of\s+Insurance|Policy\s*Period)?[^A-Za-z0-9]{0,10}\bFrom\b[^0-9A-Za-z]{0,10}([0-9]{1,2}[\/\-\.\s][A-Za-z]{3,9}|[0-9]{1,2}[\/\-\.\s][0-9]{1,2})[\/\-\.\s]([0-9]{2,4}|[A-Za-z]{3,9})[^0-9A-Za-z]{0,30}\bTo\b[^0-9A-Za-z]{0,10}([0-9]{1,2}[\/\-\.\s][A-Za-z]{3,9}|[0-9]{1,2}[\/\-\.\s][0-9]{1,2})[\/\-\.\s]([0-9]{2,4}|[A-Za-z]{3,9})/i,

  // Simpler "period: dd-mm-yyyy to dd-mm-yyyy"
  issuePeriodTo: /\b(?:Period\s*(?:of\s*Insurance)?|Policy\s*Period)\b[^0-9A-Za-z]{0,10}([0-9]{1,2}[\/\-\.\s][0-9]{1,2}[\/\-\.\s][0-9]{2,4})[^0-9A-Za-z]{0,10}\bto\b[^0-9A-Za-z]{0,10}([0-9]{1,2}[\/\-\.\s][0-9]{1,2}[\/\-\.\s][0-9]{2,4})/i,

  // Keep your existing issueDate/expiryDate label variants
  issueDate:
    /\b(?:Policy\s*Issue\s*Date|Date\s*of\s*Issue|Commencement\s*Date|Policy\s*Start\s*Date|Start\s*Date)\b[^0-9]{0,20}(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,

  // Labeled single date with month names allowed
  issueLabeledWide: /\b(?:Policy\s*Issue\s*Date|Date\s*of\s*Issue|Commencement\s*Date|Policy\s*Start\s*Date|Start\s*Date)\b[^0-9A-Za-z]{0,10}([0-9]{1,2}[\/\-\.\s][A-Za-z]{3,9}[\/\-\.\s][0-9]{2,4}|[0-9]{1,2}[\/\-\.\s][0-9]{1,2}[\/\-\.\s][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{2,4})/i,

  expiryDate:
    /\b(?:Policy\s*Expiry|Expiry\s*Date|End\s*Date)\b[^0-9]{0,20}(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,

  // IDV / Premium (unchanged or as you already have)
  idv: /\b(?:Insured\s*Declared\s*Value|IDV)\b[^0-9]{0,20}([0-9][0-9,]{4,})/i,
  totalPremiumPrimary: /\b(?:Total\s+Premium|Final\s*\/?\s*Gross\s*Premium)\b[^0-9]{0,20}([0-9][0-9,]{2,})/i,
  totalPremiumFallback: /\bNet\s*Premium\b[^0-9]{0,20}([0-9][0-9,]{2,})/i,

  // Insurer
  insurerTata: /\bTATA\s*AIG\s*GENERAL\s*INSURANCE\s*COMPANY\s*LIMITED\b/i,
  insurerDigit: /\bGO\s*DIGIT\s*GENERAL\s*INSURANCE\s*LIMITED\b/i,

  // MMV lines
  mmvLine: /Make\s*\/\s*Model\s*\/\s*Variant\s*[:\-]?\s*([^\r\n]+)/i,
  makeSingle: /\bMake\s*[:\-]?\s*([A-Za-z0-9 .\/\-]{2,40})/i,
  modelSingle: /\bModel\s*[:\-]?\s*([A-Za-z0-9 .\/\-]{1,40})/i,
  variantSingle: /\bVariant\s*[:\-]?\s*([A-Za-z0-9 .\/\-]{1,40})/i,

  // Fuel Type (keep but we won't store if you don't need it)
  fuelType: /\bFuel\s*Type\s*[:\-]?\s*([A-Za-z0-9 /-]{2,20})/i,

  // Coverage table header pattern
  coverageHeader: /Coverage\s*Details[\s\S]{0,120}?Valid\s*From[\s\S]{0,60}?Valid\s*Till/i,
  ownDamageRow: /\bOwn\s*Damage\s*Cover\b[^\d]{0,30}(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
};

const MONTHS: Record<string,string> = {
  jan:'01', january:'01', feb:'02', february:'02', mar:'03', march:'03',
  apr:'04', april:'04', may:'05', jun:'06', june:'06', jul:'07', july:'07',
  aug:'08', august:'08', sep:'09', sept:'09', september:'09',
  oct:'10', october:'10', nov:'11', november:'11', dec:'12', december:'12'
};

const toISO = (raw: string): string | null => {
  const s = raw.trim().replace(/\s+/g,' ');
  // dd[/-.\s]mm[/-.\s]yyyy
  let m = s.match(/^(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})$/i);
  if (m) {
    let [_, dd, mm, yy] = m;
    const yyyy = yy.length === 2 ? (parseInt(yy,10) > 50 ? `19${yy}` : `20${yy}`) : yy;
    const d = Number(dd), mo = Number(mm);
    if (d>=1 && d<=31 && mo>=1 && mo<=12) return `${yyyy.padStart(4,'0')}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
    return null;
  }
  // dd [sep] Mon [sep] yyyy  OR dd Mon yyyy
  m = s.match(/^(\d{1,2})[\/\-\.\s]([A-Za-z]{3,9})[\/\-\.\s](\d{2,4})$/i) || s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/i);
  if (m) {
    const dd = m[1], mon = MONTHS[m[2].toLowerCase()], yy = m[3];
    if (!mon) return null;
    const yyyy = yy.length === 2 ? (parseInt(yy,10) > 50 ? `19${yy}` : `20${yy}`) : yy;
    const d = Number(dd);
    if (d>=1 && d<=31) return `${yyyy.padStart(4,'0')}-${mon}-${dd.padStart(2,'0')}`;
    return null;
  }
  return null;
};

const cleanNum = (s: string) => s.replace(/[^\d]/g, "");

// helper to find a date near a label (across newlines)
const DATE_ANY = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/; // dd/mm/yyyy etc.

function findDateNear(label: RegExp, text: string, lookahead = 120): string | null {
  const m = label.exec(text);
  if (!m) return null;
  const start = m.index + m[0].length;
  const slice = text.slice(start, start + lookahead); // include newlines/tabs
  const d = DATE_ANY.exec(slice);
  return d ? d[1] : null;
}

function firstDateAfter(header: RegExp, text: string, scan = 2500): string | null {
  const m = header.exec(text);
  if (!m) return null;
  const slice = text.slice(m.index + m[0].length, m.index + m[0].length + scan);
  const d = DATE_ANY.exec(slice);
  return d ? d[1] : null;
}

function pickIssueDateFromCoverageTable(text: string): string | null {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  // Find the header block: Coverage Details … Valid From … Valid Till
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^coverage\s*details$/i.test(lines[i])) {
      // Expect next ~3 lines to contain "Valid From" and "Valid Till"
      const block = lines.slice(i, i + 5).join(" ");
      if (/valid\s*from/i.test(block) && /valid\s*till/i.test(block)) {
        headerIdx = i;
        break;
      }
    }
  }
  if (headerIdx === -1) return null;

  // From the header onwards, find the first data row.
  // Tata AIG puts "Own Damage Cover" then the start and end dates on next lines.
  const DATE = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
  for (let i = headerIdx + 1; i < Math.min(lines.length, headerIdx + 80); i++) {
    // Skip empty or label-only lines
    if (!lines[i] || /valid\s*from|valid\s*till/i.test(lines[i])) continue;

    // If this row is a coverage row header, the next non-empty line should contain the start date
    if (/own\s*damage\s*cover/i.test(lines[i])) {
      // search the next few lines for a date token
      for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
        const m = DATE.exec(lines[j]);
        if (m) return m[1]; // raw dd/mm/yyyy (we'll normalize later)
      }
    }

    // Generic fallback: first date we see after the header is the start date
    const m = DATE.exec(lines[i]);
    if (m) return m[1];
  }
  return null;
}

// helper to find first non-empty value
const firstNonEmpty = (...candidates: (string|undefined|null)[]) =>
  candidates.map(s => (s ?? '').trim()).find(s => s && s !== '/' && s !== '-');

// Helpers to validate MMV tokens
const BAD_PHRASES = [
  "every mile a safe one", // TATA AIG slogan
  "tata aig", "insurance", "policy", "receipt", "premium", "gst"
];

const cleanToken = (s: string) => s
  .replace(/^\s*\/\s*/, "")   // drop leading slashes
  .replace(/\s*\/\s*$/, "")   // drop trailing slashes
  .replace(/\s{2,}/g, " ")
  .trim();

const looksLikeMake = (s: string) => {
  const t = s.toLowerCase();
  if (!t || t.length < 2 || t.length > 40) return false;
  if (BAD_PHRASES.some(p => t.includes(p))) return false;
  // Heuristic: contains letters, not only punctuation, at least one vowel or digit
  return /[a-z0-9]/i.test(s) && /[aeiou0-9]/i.test(s);
};

const looksLikeModelOrVariant = (s: string) => {
  const t = s.toLowerCase();
  if (!t || t === "/" || t.length < 1 || t.length > 40) return false;
  if (BAD_PHRASES.some(p => t.includes(p))) return false;
  return /[a-z0-9]/i.test(s);
};

function logAround(label: RegExp, text: string, context = 2, tag = "probe") {
  try {
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (label.test(lines[i])) {
        const start = Math.max(0, i - context);
        const end = Math.min(lines.length, i + context + 1);
        const block = lines.slice(start, end).join("\n");
        console.log(`[${tag}] >>>\n${block}\n<<< [/${tag}]`);
      }
    }
  } catch { /* no-op */ }
}

function setIfEmptyOrUpgradeText(
  cur: { value: string|null; confidence: number; source: "text"|"llm"|"none" } | undefined,
  nextVal: string | null,
  conf: number
): { value: string|null; confidence: number; source: "text"|"llm"|"none" } {
  if (!nextVal) return cur || { value: null, confidence: 0, source: "none" as const };
  if (!cur || cur.value == null || cur.source === "llm") {
    return { value: nextVal, confidence: conf, source: "text" as const };
  }
  return cur;
}

export function applyRegexAssist(text: string, out: Output): Output {
  const res = { ...out };

  // ISSUE DATE: try labeled, then period forms ("From ... To ..." or "Period ... to ...")
  {
    let iso: string | null = null;

    const L = text.match(rx.issueLabeledWide);
    if (L) iso = toISO(L[1]);

    if (!iso) {
      const F = text.match(rx.issueFromToWide);
      if (F) {
        // Recompose "From" date tokens into a single string and normalize
        const from = `${F[1]} ${F[2]}`.trim();
        iso = toISO(from);
      }
    }

    if (!iso) {
      const P = text.match(rx.issuePeriodTo);
      if (P) iso = toISO(P[1]);
    }

    if (iso) res.issue_date = setIfEmptyOrUpgradeText(res.issue_date, iso, 0.9);
  }

  // EXPIRY DATE (only if missing or to upgrade llm)
  {
    const m = text.match(rx.expiryDate);
    if (m) {
      const iso = toISO(m[1]);
      if (iso) res.expiry_date = setIfEmptyOrUpgradeText(res.expiry_date, iso, 0.9);
    }
  }

  // ISSUE DATE fallback from Period table ("Valid From")
  if (!res.issue_date?.value || res.issue_date.source === 'llm') {
    const raw = findDateNear(/\bValid\s*From\b/i, text, 160);
    const iso = raw ? toISO(raw) : null;
    if (iso) res.issue_date = { value: iso, confidence: 0.9, source: "text" };
  }

  // ---- FINAL fallback: line-walk the table and take the first "Valid From" date
  if (!res.issue_date?.value || res.issue_date.source === "llm") {
    const raw = pickIssueDateFromCoverageTable(text);
    const iso = raw ? toISO(raw) : null;
    if (iso) {
      res.issue_date = { value: iso, confidence: 0.9, source: "text" };
    }
  }

  // ---- EXPIRY: second date after "Coverage Details ... Valid From ... Valid Till"
  if (!res.expiry_date?.value || res.expiry_date.source === "llm") {
    const headerIdx = text.search(/Coverage\s*Details[\s\S]{0,150}?Valid\s*From[\s\S]{0,80}?Valid\s*Till/i);
    if (headerIdx >= 0) {
      const slice = text.slice(headerIdx, headerIdx + 6000); // span table block
      const dates = Array.from(slice.matchAll(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g));
      if (dates.length >= 2) {
        const raw = dates[1][1]; // 1st = issue, 2nd = expiry
        const iso = toISO(raw);
        if (iso) res.expiry_date = { value: iso, confidence: 0.9, source: "text" };
      }
    }
  }



  // IDV
  {
    const m = text.match(rx.idv);
    if (m) res.idv = setIfEmptyOrUpgradeText(res.idv, cleanNum(m[1]), 0.9);
  }

  // TOTAL PREMIUM (prefer Total/Final/Gross; fallback to Net if still empty)
  {
    let v: string | null = null;
    const p1 = text.match(rx.totalPremiumPrimary);
    if (p1) v = cleanNum(p1[1]); else {
      const p2 = text.match(rx.totalPremiumFallback);
      if (p2) v = cleanNum(p2[1]);
    }
    if (v) res.total_premium = setIfEmptyOrUpgradeText(res.total_premium, v, 0.9);
  }

  // INSURER — upgrade llm to text if we have an exact match
  {
    const m = text.match(rx.insurerTata);
    if (m) res.insurer = setIfEmptyOrUpgradeText(res.insurer, m[0], 0.95);
  }

  // MMV — combined line
  {
    const m = text.match(rx.mmvLine);
    if (m) {
      const raw = m[1];
      const parts = raw.split("/").map(cleanToken).filter(looksLikeModelOrVariant);
      // First token is most likely Make; ensure it's plausible as a Make
      if (parts[0] && looksLikeMake(parts[0])) {
        res.make = setIfEmptyOrUpgradeText(res.make, parts[0], 0.85);
      }
      if (parts[1]) res.model = setIfEmptyOrUpgradeText(res.model, parts[1], 0.85);
      if (parts[2]) res.variant = setIfEmptyOrUpgradeText(res.variant, parts[2], 0.80);
    }
  }

  // MMV — split rows (fallback; only fill/upgrade plausible tokens)
  {
    // Make — value may be on same line OR the very next line
    const m1 = text.match(/\bMake\s*[:\-]?\s*([^\r\n]*)\r?\n?([^\r\n]*)/i);
    if (m1) {
      const v = cleanToken(firstNonEmpty(m1[1], m1[2]) || '');
      if (looksLikeMake(v)) res.make = setIfEmptyOrUpgradeText(res.make, v, 0.85);
    }

    // Model — same trick
    const m2 = text.match(/\bModel\s*[:\-]?\s*([^\r\n]*)\r?\n?([^\r\n]*)/i);
    if (m2) {
      const v = cleanToken(firstNonEmpty(m2[1], m2[2]) || '');
      if (looksLikeModelOrVariant(v)) res.model = setIfEmptyOrUpgradeText(res.model, v, 0.85);
    }

    // Variant — keep your existing logic, but prefer explicit label if present
    const m3 = text.match(/\bVariant\s*[:\-]?\s*([^\r\n]*)\r?\n?([^\r\n]*)/i);
    if (m3) {
      const v = cleanToken(firstNonEmpty(m3[1], m3[2]) || '');
      if (looksLikeModelOrVariant(v)) res.variant = setIfEmptyOrUpgradeText(res.variant, v, 0.80);
    }
  }

  // FUEL TYPE — you said not required; keep extraction but don't persist if you don't want it.
  {
    const m = text.match(rx.fuelType);
    if (m) res.fuel_type = setIfEmptyOrUpgradeText(res.fuel_type, m[1].toUpperCase(), 0.85);
  }

  // --- Post-normalize combined tokens: e.g., model = "VOLKSWAGEN / VIRTUS"
  const KNOWN_MAKES = [
    'MARUTI SUZUKI','MARUTI','TATA MOTORS','TATA','MAHINDRA','HYUNDAI','HONDA',
    'TOYOTA','VOLKSWAGEN','SKODA','KIA','NISSAN','RENAULT','FORD','CHEVROLET',
    'JEEP','MG','BMW','MERCEDES-BENZ','MERCEDES','AUDI','VOLVO','FIAT'
  ];

  const splitSlash = (s: string) => s.split('/').map(x => x.trim()).filter(Boolean);

  if ((!res.make?.value || res.make.source === 'llm') && res.model?.value) {
    const raw = res.model.value.trim();

    if (raw.includes('/')) {
      const parts = splitSlash(raw);
      if (parts.length >= 2) {
        const possibleMake = parts[0];
        const possibleModel = parts.slice(1).join(' / ');
        if (looksLikeMake(possibleMake)) {
          res.make  = { value: possibleMake, confidence: 0.9, source: 'text' };
          res.model = { value: possibleModel, confidence: 0.9, source: 'text' };
        }
      }
    } else {
      const hit = KNOWN_MAKES.find(mk => raw.toUpperCase().startsWith(mk));
      if (hit) {
        const rest = raw.slice(hit.length).replace(/^[\s\/\-:]+/, '').trim();
        if (rest) {
          res.make  = { value: hit,  confidence: 0.9, source: 'text' };
          res.model = { value: rest, confidence: 0.9, source: 'text' };
        }
      }
    }
  }

  // DEBUG: Log patterns when DEBUG_REGEX=1
  if (process.env.DEBUG_REGEX === "1") {
    // MMV (both single-line and split labels)
    logAround(/Make\s*\/\s*Model\s*\/\s*Variant/i, text, 2, "MMV-line");
    logAround(/\bMake\b/i, text, 1, "MMV-make");
    logAround(/\bModel\b/i, text, 1, "MMV-model");
    logAround(/\bVariant\b/i, text, 1, "MMV-variant");

    // Dates (labeled and From/To)
    logAround(/Policy\s*Issue\s*Date|Date\s*of\s*Issue|Start\s*Date|Commencement\s*Date/i, text, 2, "DATE-labeled");
    logAround(/\bFrom\b.*\bTo\b/i, text, 2, "DATE-fromto");
  }

  // FINAL NORMALIZATION (always last)
  if (res.expiry_date?.value && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(res.expiry_date.value)) {
    const iso = toISO(res.expiry_date.value);
    if (iso) res.expiry_date = { ...res.expiry_date, value: iso, source: "text", confidence: Math.max(res.expiry_date.confidence ?? 0.9, 0.9) };
  }

  return res;
}
