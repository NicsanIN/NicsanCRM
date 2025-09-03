import { getPdfBufferFromS3 } from "./uploads"; // you already have this
import { getPdfTextWithCoords } from "../extractors/digit/layout/pdfTextPosition"; 
// ^ reuse your working tokenizer (used elsewhere in your Digit pipeline)

export async function getPdfTextFast(
  s3Key: string,
  pageLimit = Number(process.env.OPENAI_PAGE_LIMIT || 4)
) {
  const buf = await getPdfBufferFromS3(s3Key);
  const out = await getPdfTextWithCoords(buf, { pageLimit });

  // Join lines per page, keep order — small, deterministic, fast
  const pages = out.pages.map(p => p.lines.map(l => l.text).join("\n"));
  return pages.join("\n\n===PAGE_BREAK===\n\n")
    .replace(/\u00A0/g, " ")
    .replace(/\u200B/g, "")
    .replace(/[ ]{2+}/g, " ")
    .trim();
}
