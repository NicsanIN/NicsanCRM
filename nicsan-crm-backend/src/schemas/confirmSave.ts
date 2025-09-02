import { z } from "zod";

export const ConfirmSaveSchema = z.object({
  schema_version: z.literal("1.0"),
  insurer: z.object({
    value: z.string(),
    source: z.string(),
    confidence: z.number()
  }),
  policy_number: z.object({
    value: z.string(),
    source: z.string(),
    confidence: z.number()
  }),
  vehicle_number: z.object({
    value: z.string(),
    source: z.string(),
    confidence: z.number()
  }),
  issue_date: z.object({
    value: z.string(),
    source: z.string(),
    confidence: z.number()
  }),
  expiry_date: z.object({
    value: z.string(),
    source: z.string(),
    confidence: z.number()
  }),
  total_premium: z.object({
    value: z.number(),
    source: z.string(),
    confidence: z.number()
  }),
  idv: z.object({
    value: z.number(),
    source: z.string(),
    confidence: z.number()
  }),
  product_type: z.string().min(1),
  vehicle_type: z.string().min(1),
  make: z
    .string()
    .transform((s) => (typeof s === 'string' ? s.trim() : ''))
    .pipe(z.string())
    .optional()
    .transform((s) => (s && s.trim() !== '' ? s.trim() : 'UNKNOWN')),
  ncb: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 0 : v),
    z.coerce.number().min(0).max(100).catch(0)
  ),
  manual_extras: z.record(z.string(), z.any()).optional(),
});

export type ConfirmSave = z.infer<typeof ConfirmSaveSchema>;


