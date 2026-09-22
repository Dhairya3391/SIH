declare module "pdf-parse" {
  export class PDFParse {
    constructor(options: { data: Uint8Array });
    getText(): Promise<{
      text?: string;
      total?: number;
      pages?: { num: number; text?: string | null }[];
    }>;
    destroy(): Promise<void>;
  }
}
