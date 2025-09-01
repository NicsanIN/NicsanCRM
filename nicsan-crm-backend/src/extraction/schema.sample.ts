import { parsePolicyExtractV1 } from "./schema";

const sample = {
  schema_version: "1.0",
  insurer: { value: "TATA_AIG", confidence: 0.9, source: "llm" },
  policy_number: { value: "D217080603", confidence: 0.95, source: "llm" },
  vehicle_number: { value: "TN18BE3785", confidence: 0.9, source: "regex" },
  issue_date: { value: "2024-07-15", confidence: 0.8, source: "llm" },
  expiry_date: { value: "2025-07-14", confidence: 0.8, source: "llm" },
  total_premium: { value: 15432, confidence: 0.85, source: "regex" },
  idv: { value: 380000, confidence: 0.75, source: "llm" },
  __debug__: { evidence_snippet: "Insured Declared Value (IDV) ₹ 3,80,000" },
};

console.log("OK:", !!parsePolicyExtractV1(sample));


