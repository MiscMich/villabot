/**
 * Query expansion utility
 * Expands queries with domain-specific synonyms and related terms
 */

import { logger } from './logger.js';

// Domain-specific synonym mappings for vacation rental context
const SYNONYM_MAP: Record<string, string[]> = {
  // Accommodation terms
  'guest': ['visitor', 'customer', 'client', 'renter', 'occupant'],
  'property': ['villa', 'rental', 'unit', 'accommodation', 'house', 'home'],
  'room': ['bedroom', 'space', 'area', 'suite'],
  'booking': ['reservation', 'stay', 'rental period'],
  'check-in': ['arrival', 'checkin', 'check in'],
  'check-out': ['departure', 'checkout', 'check out'],

  // Operations terms
  'clean': ['cleaning', 'housekeeping', 'turnover', 'sanitize'],
  'maintenance': ['repair', 'fix', 'upkeep', 'service'],
  'pool': ['swimming pool', 'jacuzzi', 'hot tub', 'spa'],
  'wifi': ['internet', 'wi-fi', 'network', 'connectivity'],
  'ac': ['air conditioning', 'hvac', 'cooling', 'air conditioner'],

  // Staff and process terms
  'sop': ['procedure', 'process', 'protocol', 'guideline', 'instruction'],
  'policy': ['rule', 'guideline', 'requirement', 'regulation'],
  'staff': ['team', 'employee', 'personnel', 'worker'],
  'manager': ['supervisor', 'coordinator', 'lead'],

  // Issue handling
  'problem': ['issue', 'complaint', 'concern', 'trouble'],
  'damage': ['broken', 'damaged', 'issue', 'breakage'],
  'emergency': ['urgent', 'critical', 'immediate'],
  'refund': ['reimbursement', 'compensation', 'credit'],

  // Communication
  'contact': ['reach', 'call', 'email', 'message'],
  'respond': ['reply', 'answer', 'get back'],

  // Time-related
  'daily': ['everyday', 'routine', 'regular'],
  'weekly': ['every week', 'routine'],
  'schedule': ['calendar', 'timing', 'plan'],

  // Villa Paraiso specific
  'villa': ['property', 'house', 'rental', 'accommodation'],
  'paraiso': ['villa paraiso', 'vpvr'],
};

// Phrase expansions for common queries
const PHRASE_EXPANSIONS: Record<string, string[]> = {
  'how to handle': ['procedure for', 'process for', 'steps for', 'what to do when'],
  'what is the': ['where can i find', 'tell me about', 'explain'],
  'guest complaint': ['guest issue', 'customer problem', 'visitor concern'],
  'lost key': ['missing key', 'key problem', 'lockout'],
  'late checkout': ['extended checkout', 'checkout extension'],
  'early checkin': ['early arrival', 'checkin early'],
  'damage claim': ['damage report', 'damage incident', 'breakage report'],
};

/**
 * Expand a query with synonyms and related terms
 * Returns an expanded query string
 */
export function expandQuery(query: string): string {
  const normalizedQuery = query.toLowerCase().trim();
  const expansions: Set<string> = new Set();

  // Check phrase expansions first
  for (const [phrase, alternatives] of Object.entries(PHRASE_EXPANSIONS)) {
    if (normalizedQuery.includes(phrase)) {
      // Add phrase alternatives
      alternatives.forEach(alt => expansions.add(alt));
    }
  }

  // Expand individual words
  const words = normalizedQuery.split(/\s+/);
  for (const word of words) {
    const cleanWord = word.replace(/[^\w]/g, '');
    if (SYNONYM_MAP[cleanWord]) {
      // Add first 2 synonyms to avoid query bloat
      SYNONYM_MAP[cleanWord].slice(0, 2).forEach(syn => expansions.add(syn));
    }
  }

  // Combine original query with expansions
  if (expansions.size > 0) {
    const expandedTerms = Array.from(expansions).join(' ');
    logger.debug('Query expanded', {
      original: query,
      expansions: Array.from(expansions),
    });
    return `${query} ${expandedTerms}`;
  }

  return query;
}

/**
 * Get alternative queries for multi-query search
 */
export function getAlternativeQueries(query: string, maxAlternatives: number = 3): string[] {
  const alternatives: string[] = [query];
  const normalizedQuery = query.toLowerCase().trim();

  // Generate alternatives by phrase substitution
  for (const [phrase, alts] of Object.entries(PHRASE_EXPANSIONS)) {
    if (normalizedQuery.includes(phrase)) {
      for (const alt of alts.slice(0, 2)) {
        const altQuery = normalizedQuery.replace(phrase, alt);
        if (!alternatives.includes(altQuery)) {
          alternatives.push(altQuery);
          if (alternatives.length >= maxAlternatives) {
            return alternatives;
          }
        }
      }
    }
  }

  // Generate alternatives by word substitution
  const words = normalizedQuery.split(/\s+/);
  for (let i = 0; i < words.length && alternatives.length < maxAlternatives; i++) {
    const word = words[i]?.replace(/[^\w]/g, '');
    if (word && SYNONYM_MAP[word] && SYNONYM_MAP[word].length > 0) {
      const newWords = [...words];
      const firstSynonym = SYNONYM_MAP[word][0];
      if (firstSynonym) {
        newWords[i] = firstSynonym;
        const altQuery = newWords.join(' ');
        if (!alternatives.includes(altQuery)) {
          alternatives.push(altQuery);
        }
      }
    }
  }

  return alternatives;
}

/**
 * Extract key terms from a query for focused search
 */
export function extractKeyTerms(query: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your', 'i', 'me', 'my',
    'what', 'how', 'when', 'where', 'why', 'which', 'who', 'whom', 'there',
    'please', 'help', 'need', 'want', 'about', 'tell', 'show', 'find',
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}
