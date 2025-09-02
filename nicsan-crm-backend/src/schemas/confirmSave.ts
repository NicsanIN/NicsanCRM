import { z } from "zod";

export const ConfirmSaveSchema = z.object({
  schema_version: z.literal("1.0"),
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
});

export type ConfirmSave = z.infer<typeof ConfirmSaveSchema>;


