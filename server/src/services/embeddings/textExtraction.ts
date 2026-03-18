import { readFile } from 'fs/promises';
import path from 'path';

import { PDFParse } from 'pdf-parse';

import { CV_UPLOAD_DIR } from '../uploads/paths.js';

const MAX_CV_TEXT_CHARS = 12000;

const normalizeExtractedText = (value: string) => value.trim().replace(/\s+/g, ' ');

export const extractCvText = async (cvPath?: string | null): Promise<string | null> => {
  if (!cvPath) {
    console.info('[embeddings] CV path missing or empty. Continuing without CV text.');
    return null;
  }

  try {
    const pdfBuffer = await readFile(path.join(CV_UPLOAD_DIR, cvPath));
    const parser = new PDFParse({ data: pdfBuffer });
    const parsed = await parser.getText()
      .finally(async () => {
        await parser.destroy();
      });
    const cleaned = normalizeExtractedText(parsed.text ?? '');

    if (!cleaned) {
      console.warn('[embeddings] CV parsed but produced no text. Continuing without CV text.');
      return null;
    }

    return cleaned.slice(0, MAX_CV_TEXT_CHARS);
  } catch (error) {
    console.warn(`[embeddings] Failed to parse CV from "${cvPath}". Continuing without CV text.`, error);
    return null;
  }
};
