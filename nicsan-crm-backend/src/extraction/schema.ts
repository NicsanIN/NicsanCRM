import { z } from "zod";

/** Who produced a field’s value */
export const Source = z.enum(["llm", "regex", "manual", "merged"]);
export type Source = z.infer<typeof Source>;

/** Known insurers (add more later) */
export const Insurer = z.enum(["TATA_AIG", "DIGIT"]);
export type Insurer = z.infer<typeof Insurer>;

/** Generic field wrapper: value + quality meta */
export const Field = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({
    value: inner.nullable(),                    // null if missing
    confidence: z.number().min(0).max(1),       // 0–1
    source: Source,
    note: z.string().optional(),                // free-form reason/evidence
  });

/** Common helper types */
const Money = z.number().nonnegative();         // store as number (₹ in UI)
const DateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD

/** The normalized, insurer-agnostic payload we expect from extractors */
export const PolicyExtractV1 = z.object({
  schema_version: z.literal("1.0"),
  insurer: Field(Insurer),

  // Core identifiers
  policy_number: Field(z.string()),
  vehicle_number: Field(z.string()),            // e.g., KA01AB1234

  // Dates
  issue_date: Field(DateISO),
  expiry_date: Field(DateISO),

  // Financials
  total_premium: Field(Money),
  idv: Field(Money),                             // Insured Declared Value

  // Optional vehicle details (present if found)
  make: Field(z.string()).optional(),
  model: Field(z.string()).optional(),
  variant: Field(z.string()).optional(),
  fuel_type: Field(z.string()).optional(),

  // Raw debug window (helps review/match if something is off)
  __debug__: z
    .object({
      pages_scanned: z.number().int().nonnegative().optional(),
      evidence_snippet: z.string().optional(),  // tiny excerpt to show in UI
    })
    .optional(),
});

export type PolicyExtractV1 = z.infer<typeof PolicyExtractV1>;

/** Runtime validator for any extraction JSON */
export function parsePolicyExtractV1(input: unknown): PolicyExtractV1 {
  return PolicyExtractV1.parse(input);
}


