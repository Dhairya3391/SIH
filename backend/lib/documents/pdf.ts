import "server-only";
import { PDFParse } from "pdf-parse";

/**
 * Text out of a proposal PDF, page by page.
 *
 * Each page is prefixed with an explicit marker. The reviewer cites page
 * numbers for every judgement, and the markers are what make "read from page
 * 4" something a college can actually check against its own document.
 */

export interface ExtractedDocument {
  text: string;
  pages: number;
}

export function looksLikePdf(bytes: Uint8Array): boolean {
  // %PDF-
  return bytes.length > 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

export async function extractPdfText(bytes: Uint8Array): Promise<ExtractedDocument> {
  // pdf.js may transfer the buffer it is given; hand it a copy so the caller's
  // bytes survive for the storage upload.
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const result = await parser.getText();
    const pages = result.pages?.length ? result.pages : [{ num: 1, text: result.text ?? "" }];
    const text = pages
      .map((p) => `--- page ${p.num} ---\n${(p.text ?? "").trim()}`)
      .join("\n\n")
      .trim();
    return { text, pages: result.total || pages.length };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

/** Characters of real text, not counting the page markers added above. */
export function meaningfulLength(text: string): number {
  return text
    .replace(/--- page \d+ ---/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}
