/**
 * DOCX document parser
 */

import mammoth from 'mammoth';
import { logger } from '../../../utils/logger.js';

export interface ParsedDocument {
  content: string;
  metadata: {
    messages?: string[];
  };
}

/**
 * Parse DOCX buffer to text
 */
export async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const result = await mammoth.extractRawText({ buffer });

    // Clean up the text
    const content = result.value
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n')  // Max 2 newlines
      .trim();

    if (result.messages.length > 0) {
      logger.debug('DOCX parse warnings', { messages: result.messages });
    }

    logger.debug(`Parsed DOCX: ${content.length} chars`);

    return {
      content,
      metadata: {
        messages: result.messages.map(m => m.message),
      },
    };
  } catch (error) {
    logger.error('Failed to parse DOCX', { error });
    throw new Error(`DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
