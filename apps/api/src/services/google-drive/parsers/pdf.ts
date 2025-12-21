/**
 * PDF document parser
 */

import pdfParse from 'pdf-parse';
import { logger } from '../../../utils/logger.js';
import { FILE_LIMITS } from '@teambrain/shared';

export interface ParsedDocument {
  content: string;
  metadata: {
    pageCount?: number;
    title?: string;
    author?: string;
  };
}

/**
 * Parse PDF buffer to text
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const data = await pdfParse(buffer, {
      max: FILE_LIMITS.maxPagesPerDocument,
    });

    // Clean up the text
    let content = data.text
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n')  // Max 2 newlines
      .trim();

    logger.debug(`Parsed PDF: ${data.numpages} pages, ${content.length} chars`);

    return {
      content,
      metadata: {
        pageCount: data.numpages,
        title: data.info?.Title,
        author: data.info?.Author,
      },
    };
  } catch (error) {
    logger.error('Failed to parse PDF', { error });
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
