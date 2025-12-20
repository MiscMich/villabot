/**
 * Shared constants
 */

// Chunking configuration
export const CHUNK_CONFIG = {
  chunkSize: 512,
  chunkOverlap: 50,
  separators: ['\n\n', '\n', '. ', ' ', ''],
} as const;

// Embedding configuration
export const EMBEDDING_CONFIG = {
  model: 'text-embedding-004',
  dimensions: 768,
  batchSize: 100,
} as const;

// RAG configuration
export const RAG_CONFIG = {
  topK: 15,              // Increased from 5 to return more relevant chunks
  vectorWeight: 0.5,
  keywordWeight: 0.5,
  minSimilarity: 0.2,    // Lowered from 0.3 to include more potential matches
} as const;

// Rate limiting
export const RATE_LIMITS = {
  questionsPerUserPerMinute: 5,
  syncJobsPerHour: 12,
} as const;

// Thread configuration
export const THREAD_CONFIG = {
  maxMessagesInContext: 10,
  sessionTimeoutHours: 24,
} as const;

// Heuristics for question detection
export const QUESTION_HEURISTICS = {
  questionWords: ['what', 'how', 'when', 'where', 'why', 'who', 'which', 'can', 'does', 'is', 'are', 'do', 'should', 'would', 'could'],
  minLength: 10,
  maxLength: 500,
} as const;

// File size limits
export const FILE_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
  maxPagesPerDocument: 100,
} as const;

// Supported file types
export const SUPPORTED_FILE_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.google-apps.document': 'google_doc',
  'application/vnd.google-apps.spreadsheet': 'google_sheet',
  'text/plain': 'txt',
  'text/html': 'html',
} as const;
