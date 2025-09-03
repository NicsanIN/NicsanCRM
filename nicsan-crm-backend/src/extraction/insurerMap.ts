export type InsurerHint = "TATA_AIG" | "DIGIT" | null;

export function toInsurerHint(input: string | null | undefined): InsurerHint {
  if (!input) return null;
  const t = input.toUpperCase().replace(/[^A-Z]/g, ""); // strip spaces/_/- etc.
  if (t.includes("TATA") && t.includes("AIG")) return "TATA_AIG";
  if (t.includes("DIGIT")) return "DIGIT";
  return null;
}



