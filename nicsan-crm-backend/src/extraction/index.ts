import { PolicyExtractV1 } from "./schema";

// Minimal stub to unblock the pipeline.
// Replace with real OpenAI+regex implementation later.
export async function extractFromPdf(args: { s3Key: string; insurerHint?: string | null }) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  const payload: PolicyExtractV1 = {
    schema_version: "1.0",
    insurer: { value: (args.insurerHint as any) ?? "TATA_AIG", confidence: 0.6, source: "llm" },
    policy_number: { value: "MOCK123456", confidence: 0.5, source: "llm" },
    vehicle_number: { value: "KA01AB1234", confidence: 0.5, source: "llm" },
    issue_date: { value: `${yyyy}-${mm}-${dd}`, confidence: 0.5, source: "llm" },
    expiry_date: { value: `${yyyy + 1}-${mm}-${dd}`, confidence: 0.5, source: "llm" },
    total_premium: { value: 12345, confidence: 0.4, source: "llm" },
    idv: { value: 350000, confidence: 0.4, source: "llm" },
    __debug__: { evidence_snippet: `stub for ${args.s3Key}` },
  };

  return payload;
}


