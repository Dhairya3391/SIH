import "server-only";

/**
 * Text out of a proposal PDF, page by page.
 *
 * Each page is prefixed with an explicit marker. The reviewer cites page
 * numbers for every judgement, and the markers are what make "read from page
 * 4" something a college can actually check against its own document.
 *
 * NOTE: pdf-parse (via pdfjs-dist) requires DOMMatrix/canvas polyfills that
 * do not exist in the Vercel Node runtime, and it crashes at import time.
 * Importing this module must therefore stay side-effect free: PDFParse is
 * loaded lazily inside extractPdfText so routes that never touch a PDF
 * (e.g. GET /api/college/proposals) do not crash on module evaluation.
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
  // Lazy: see the module note above. A static import would crash every route
  // that imports this file, even ones that never read a PDF.
  if (typeof globalThis.DOMMatrix === "undefined") {
    // @ts-ignore - pdf-parse expects this to exist but does not actually use it for simple text extraction
    globalThis.DOMMatrix = class DOMMatrix {};
  }
  if (typeof globalThis.Path2D === "undefined") {
    // @ts-ignore
    globalThis.Path2D = class Path2D {};
  }
  const { PDFParse } = await import("pdf-parse");
  // pdf.js may transfer the buffer it is given; hand it a copy so the caller's
  // bytes survive for the storage upload.
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const result = await parser.getText();
    const pages: { num: number; text?: string | null }[] = result.pages?.length
      ? result.pages
      : [{ num: 1, text: result.text ?? "" }];
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
