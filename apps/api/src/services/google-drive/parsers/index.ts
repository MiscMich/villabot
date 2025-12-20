/**
 * Document parser router
 * Routes documents to appropriate parsers based on MIME type
 */

import { parsePdf } from './pdf.js';
import { parseDocx } from './docx.js';
import { logger } from '../../../utils/logger.js';
import { downloadFile, exportGoogleFile } from '../client.js';

export interface ParsedContent {
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * Parse a file based on its MIME type
 */
export async function parseFile(
  fileId: string,
  mimeType: string,
  fileName: string
): Promise<ParsedContent> {
  logger.info(`Parsing file: ${fileName} (${mimeType})`);

  try {
    switch (mimeType) {
      case 'application/pdf': {
        const buffer = await downloadFile(fileId);
        const result = await parsePdf(buffer);
        return {
          content: result.content,
          metadata: result.metadata,
        };
      }

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        const buffer = await downloadFile(fileId);
        const result = await parseDocx(buffer);
        return {
          content: result.content,
          metadata: result.metadata,
        };
      }

      case 'application/vnd.google-apps.document': {
        const content = await exportGoogleFile(fileId, mimeType);
        return {
          content: content.trim(),
          metadata: { sourceType: 'google_doc' },
        };
      }

      case 'application/vnd.google-apps.spreadsheet': {
        const content = await exportGoogleFile(fileId, mimeType);
        return {
          content: formatCsvAsText(content),
          metadata: { sourceType: 'google_sheet' },
        };
      }

      case 'text/plain': {
        const buffer = await downloadFile(fileId);
        return {
          content: buffer.toString('utf-8').trim(),
          metadata: { sourceType: 'text' },
        };
      }

      case 'text/html': {
        const buffer = await downloadFile(fileId);
        // Basic HTML to text conversion
        const content = buffer
          .toString('utf-8')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return {
          content,
          metadata: { sourceType: 'html' },
        };
      }

      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    logger.error(`Failed to parse file: ${fileName}`, { error, mimeType });
    throw error;
  }
}

/**
 * Format CSV content as readable text
 */
function formatCsvAsText(csv: string): string {
  const lines = csv.split('\n');
  const firstLine = lines[0];
  if (!firstLine) return '';

  // Get headers
  const headers = parseCsvLine(firstLine);
  if (!headers.length) return csv;

  // Format each row as key-value pairs
  const formattedRows: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = parseCsvLine(line);
    if (values.length === 0 || values.every(v => !v.trim())) continue;

    const pairs: string[] = [];
    for (let j = 0; j < headers.length && j < values.length; j++) {
      const value = values[j];
      const header = headers[j];
      if (value?.trim() && header) {
        pairs.push(`${header}: ${value}`);
      }
    }

    if (pairs.length > 0) {
      formattedRows.push(pairs.join(', '));
    }
  }

  return formattedRows.join('\n');
}

/**
 * Simple CSV line parser (handles quoted values)
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
