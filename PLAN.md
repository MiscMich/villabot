# Cluebase AI - Knowledge Management Platform

## Project Overview

A multi-tenant SaaS platform for AI-powered knowledge management that:
- Answers team questions using SOPs and company documentation from Google Drive
- Self-learns and updates automatically when documents change
- Scrapes the company website weekly for up-to-date information
- Provides a UI dashboard for monitoring and configuration
- Uses RAG (Retrieval Augmented Generation) for accurate, contextual responses

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **AI/LLM** | Google Gemini API | Natural language understanding and response generation |
| **Vector Database/RAG** | Supabase (pgvector) | Knowledge base storage, semantic search, embeddings |
| **Document Source** | Google Drive API | Fetch SOPs, policies, and documentation |
| **Chat Interface** | Slack Bolt SDK | Bot integration, message handling, channel presence |
| **Backend** | Node.js/TypeScript or Python (FastAPI) | API server, orchestration, business logic |
| **Dashboard UI** | Next.js / React | Admin interface for settings and analytics |
| **Web Scraping** | Puppeteer / Cheerio | Extract content from company website |
| **Task Scheduling** | Node-cron / Celery | Polling Drive, weekly scraping jobs |
| **Hosting** | Vercel / Railway / Fly.io | Application deployment |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLUEBASE AI                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   SLACK      │     │   GOOGLE     │     │   COMPANY    │     │   ADMIN      │
│   CHANNELS   │     │   DRIVE      │     │   WEBSITE    │     │   DASHBOARD  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ Slack Events       │ Drive API         │ Web Scraper        │ REST API
       │                    │                    │                    │
       ▼                    ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND SERVER (Node.js/Python)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Slack     │  │  Document   │  │   Web       │  │  Dashboard  │        │
│  │   Handler   │  │  Processor  │  │   Scraper   │  │   API       │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    RAG ORCHESTRATOR                              │       │
│  │  • Query Processing  • Context Retrieval  • Response Generation  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│    SUPABASE       │   │   GEMINI API      │   │   REDIS/CACHE     │
│   (PostgreSQL +   │   │   (LLM)           │   │   (Optional)      │
│    pgvector)      │   │                   │   │                   │
└───────────────────┘   └───────────────────┘   └───────────────────┘
```

---

## Multi-Tenant Architecture

Cluebase AI is a multi-tenant SaaS platform where each **workspace** is completely isolated:

### Workspace Isolation Model

| Resource | Isolation Level | Description |
|----------|-----------------|-------------|
| **Documents** | Per-workspace | Each workspace has its own knowledge base |
| **Slack Bots** | Per-workspace | Each workspace creates their own Slack app and provides credentials |
| **Google Drive** | Per-workspace | Each workspace authenticates their own Google Drive via OAuth |
| **Team Members** | Per-workspace | Users are invited to specific workspaces with roles |
| **Usage Limits** | Per-workspace | Subscription tier determines document limits, queries/month |

### Integration Authentication

**Slack Bot Setup (Per-Workspace):**
- Each workspace creates their own Slack app in the Slack API console
- Users provide: Bot Token (xoxb-), App-Level Token (xapp-), Signing Secret
- Each bot connects to one Slack workspace only
- Multiple bots per workspace supported for different teams/use cases

**Google Drive Connection (Platform-Managed OAuth):**
- Platform owns the Google OAuth app (GOOGLE_CLIENT_ID/SECRET)
- Users click "Connect Google Drive" → OAuth popup → authorize
- No API credentials needed from users - fully managed
- Tokens stored per-workspace for isolation

### Data Security

- **Row Level Security (RLS)**: All database tables enforce workspace isolation
- **API Authentication**: JWT tokens include workspace context
- **Cross-Workspace Access**: Impossible - RLS policies prevent data leakage

### User Roles

| Role | Scope | Capabilities |
|------|-------|--------------|
| **Platform Admin** | Entire platform | Manage all workspaces, view stats, create internal workspaces |
| **Workspace Owner** | Single workspace | Full control of workspace settings, billing, team |
| **Workspace Admin** | Single workspace | Manage bots, documents, team members |
| **Workspace Member** | Single workspace | Use bots, view documents |

---

## Core Components

### 1. Document Ingestion System

**Google Drive Integration:**
- Connect to specified Google Drive folder(s)
- Support for multiple file types:
  - `.docx` (Word documents)
  - Google Docs (native)
  - `.xlsx` / Google Sheets
  - `.pdf` files
  - `.txt` files
- Extract text content using appropriate parsers
- Track document metadata (modified date, ID, version)

**Document Processing Pipeline:**
```
Google Drive → Fetch Documents → Parse Content → Chunk Text → Generate Embeddings → Store in Supabase
```

### 2. Knowledge Base (Supabase + pgvector)

**Tables Required:**

```sql
-- Documents metadata
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id VARCHAR UNIQUE NOT NULL,
  title VARCHAR NOT NULL,
  file_type VARCHAR NOT NULL,
  source_type VARCHAR DEFAULT 'google_drive', -- 'google_drive' | 'website'
  source_url TEXT,
  content_hash VARCHAR NOT NULL,
  last_modified TIMESTAMP WITH TIME ZONE,
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document chunks with embeddings + full-text search
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768), -- Gemini text-embedding-004 dimension
  -- Auto-generated full-text search column for BM25/hybrid search
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Full-text search index for BM25 keyword matching
CREATE INDEX idx_chunks_fts ON document_chunks USING GIN (fts);

-- Thread sessions for multi-turn conversations
CREATE TABLE thread_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_channel_id VARCHAR NOT NULL,
  slack_thread_ts VARCHAR NOT NULL UNIQUE,
  started_by_user_id VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual messages within threads
CREATE TABLE thread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES thread_sessions(id) ON DELETE CASCADE,
  slack_user_id VARCHAR NOT NULL,
  role VARCHAR NOT NULL, -- 'user' | 'assistant'
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]',
  confidence_score FLOAT,
  feedback_rating INTEGER, -- 1-5 rating
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast thread lookups
CREATE INDEX idx_thread_sessions_thread_ts ON thread_sessions(slack_thread_ts);
CREATE INDEX idx_thread_messages_session ON thread_messages(session_id);

-- Bot configuration
CREATE TABLE bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics and metrics
CREATE TABLE analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learned facts (self-learning)
CREATE TABLE learned_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact TEXT NOT NULL,
  source VARCHAR DEFAULT 'user_feedback',
  taught_by_user_id VARCHAR,
  embedding VECTOR(768),
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vector similarity search index
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON learned_facts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 3. Slack Bot Integration

**Natural Language Listening (No Mentions Required):**

The bot passively monitors all messages in configured channels and uses AI to detect when someone is asking a question it can help with. No @mentions or slash commands needed.

**How It Works (Tiered Detection - Cost Optimized):**

```
Message Posted in Channel
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: Fast Heuristics (< 1ms, runs on every message)     │
│  • Ends with question mark?                                  │
│  • Contains: what, how, when, where, why, who, can, does?   │
│  • Length > 10 chars and < 500 chars?                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                     Pass? ─┼─ No → IGNORE (filters ~70% of messages)
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 2: Keyword Match (< 10ms)                             │
│  • Mentions property names? (Casa Luna, Villa Sol, etc.)    │
│  • Contains SOP terms? (checkout, check-in, maintenance)    │
│  • Matches topics in knowledge base index?                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                     Match? ─┼─ No → IGNORE (filters another ~20%)
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 3: Gemini Classifier (~500ms, only ~10% reach here)   │
│  • "Is this a question about company operations?"           │
│  • Returns: { shouldRespond: boolean, confidence: 0-1 }     │
│  • Only respond if confidence > threshold (default: 0.7)    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                    RESPOND IN THREAD
```

**Why Tiered?**
- Gemini API calls cost money and add latency
- Most Slack messages are casual chat, not questions
- Heuristics filter 90%+ of messages for free
- Only complex/ambiguous cases need AI classification

**Keyword Index (Auto-Generated):**
```typescript
// Built from document titles and extracted entities
const keywordIndex = {
  properties: ['casa luna', 'villa sol', 'casa del mar', ...],
  topics: ['check-in', 'checkout', 'maintenance', 'pool', 'cleaning', ...],
  people: ['property manager', 'guest', 'vendor', ...]
};
// Updated automatically when knowledge base syncs
```

**Threaded Conversations:**
- Bot ALWAYS responds in a thread to keep channels clean
- Maintains conversation context within the thread
- Users can ask follow-up questions in the same thread
- Thread history is included in context for multi-turn conversations
- Each thread is an independent conversation session

**Example Flow:**
```
#general channel:
├── User: "What's the checkout procedure for Casa Luna?"
│   └── Thread:
│       ├── Bot: "Here's the checkout procedure for Casa Luna..."
│       ├── User: "What about the pool maintenance?"
│       ├── Bot: "For pool maintenance at Casa Luna..." (uses thread context)
│       └── User: "Thanks!"
```

**Configurable Behavior (via Dashboard):**
- Confidence threshold for responding (default: 70%)
- Response delay (appear more natural, not instant)
- Quiet hours (don't respond during off-hours)
- Per-channel enable/disable
- Topics to ignore (configurable blocklist)

### 4. RAG Pipeline (Research-Backed Implementation)

Based on industry research and benchmarks from [Anthropic](https://www.anthropic.com/news/contextual-retrieval), [NVIDIA](https://stackoverflow.blog/2024/12/27/breaking-up-is-hard-to-do-chunking-in-rag-applications/), and [LangChain](https://python.langchain.com/v0.1/docs/modules/data_connection/document_transformers/recursive_text_splitter/).

---

#### 4.1 Document Chunking Strategy

**Recommended: RecursiveCharacterTextSplitter**

Per [Databricks research](https://community.databricks.com/t5/technical-blog/the-ultimate-guide-to-chunking-strategies-for-rag-applications/ba-p/113089), this is the default choice for 80% of RAG applications.

```typescript
// Chunking configuration
const CHUNK_CONFIG = {
  chunkSize: 512,        // tokens (sweet spot for most queries)
  chunkOverlap: 50,      // ~10% overlap to preserve context
  separators: ['\n\n', '\n', '. ', ' ', ''],  // Split order: paragraph → sentence → word
};
```

**Why These Settings?**
| Setting | Value | Reasoning |
|---------|-------|-----------|
| Chunk size | 512 tokens | NVIDIA benchmark: factoid queries work best at 256-512 tokens |
| Overlap | 50 tokens (~10%) | Preserves context across chunk boundaries |
| Separators | Hierarchical | Keeps paragraphs/sentences together when possible |

**Chunk Size by Query Type:**
- **Factoid questions** ("What's the check-in time?"): 256-512 tokens optimal
- **Analytical questions** ("Explain the maintenance process"): 1024+ tokens optimal
- **Our default**: 512 tokens (most SOP questions are factoid-style)

---

#### 4.2 Contextual Embeddings (Anthropic's Method)

Problem: A chunk saying "The check-in time is 3 PM" loses context about *which property* or *which document* it came from.

**Solution: Prepend context to each chunk before embedding**

```typescript
// Before embedding, add context to each chunk
function addContextToChunk(chunk: string, document: Document): string {
  const context = `
<context>
Document: ${document.title}
Source: ${document.source_type} (${document.file_type})
Last Updated: ${document.last_modified}
</context>

${chunk}
`;
  return context;
}

// Example transformation:
// BEFORE: "The check-in time is 3 PM. Early check-in available upon request."
// AFTER:
// <context>
// Document: Guest Check-in SOP v2.3
// Source: google_drive (docx)
// Last Updated: 2024-12-10
// </context>
//
// The check-in time is 3 PM. Early check-in available upon request.
```

**Impact:** [Anthropic's research](https://www.anthropic.com/news/contextual-retrieval) shows:
- 35% reduction in retrieval failures with contextual embeddings alone
- 49% reduction when combined with BM25
- 67% reduction when adding reranking

---

#### 4.3 Hybrid Search (Vector + BM25)

Pure vector search misses exact keyword matches. Pure keyword search misses semantic meaning. **Hybrid search combines both.**

```
User Query: "Casa Luna pool cleaning schedule"
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│ Vector Search │       │  BM25 Search  │
│ (Semantic)    │       │  (Keywords)   │
└───────┬───────┘       └───────┬───────┘
        │                       │
        │ Top 20 results        │ Top 20 results
        │                       │
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │  Reciprocal Rank      │
        │  Fusion (RRF)         │
        │  Merge & Deduplicate  │
        └───────────┬───────────┘
                    │
                    ▼ Top 10 merged
        ┌───────────────────────┐
        │  Reranker (Optional)  │
        │  Cross-encoder model  │
        └───────────┬───────────┘
                    │
                    ▼ Top 5 final
                 To LLM
```

**Supabase Implementation:**

```sql
-- Enable full-text search for BM25
ALTER TABLE document_chunks ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX idx_chunks_fts ON document_chunks USING GIN (fts);

-- Hybrid search function
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(768),
  match_count INT DEFAULT 10,
  vector_weight FLOAT DEFAULT 0.5,
  keyword_weight FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  document_id UUID,
  similarity FLOAT,
  rank_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      dc.id,
      dc.content,
      dc.document_id,
      1 - (dc.embedding <=> query_embedding) AS similarity,
      ROW_NUMBER() OVER (ORDER BY dc.embedding <=> query_embedding) AS vector_rank
    FROM document_chunks dc
    ORDER BY dc.embedding <=> query_embedding
    LIMIT 20
  ),
  keyword_results AS (
    SELECT
      dc.id,
      dc.content,
      dc.document_id,
      ts_rank(dc.fts, plainto_tsquery('english', query_text)) AS text_rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank(dc.fts, plainto_tsquery('english', query_text)) DESC) AS keyword_rank
    FROM document_chunks dc
    WHERE dc.fts @@ plainto_tsquery('english', query_text)
    ORDER BY text_rank DESC
    LIMIT 20
  ),
  combined AS (
    SELECT
      COALESCE(v.id, k.id) AS id,
      COALESCE(v.content, k.content) AS content,
      COALESCE(v.document_id, k.document_id) AS document_id,
      COALESCE(v.similarity, 0) AS similarity,
      -- RRF: Reciprocal Rank Fusion
      (vector_weight / (60 + COALESCE(v.vector_rank, 1000))) +
      (keyword_weight / (60 + COALESCE(k.keyword_rank, 1000))) AS rank_score
    FROM vector_results v
    FULL OUTER JOIN keyword_results k ON v.id = k.id
  )
  SELECT c.id, c.content, c.document_id, c.similarity, c.rank_score
  FROM combined c
  ORDER BY c.rank_score DESC
  LIMIT match_count;
END;
$$;
```

**Why Hybrid?** [Research shows](https://superlinked.com/vectorhub/articles/optimizing-rag-with-hybrid-search-reranking) 2-3x reduction in hallucinations vs single-route retrieval.

---

#### 4.4 Embedding Model Choice

**Recommended: Gemini text-embedding-004**

| Model | Dimensions | Cost | Notes |
|-------|------------|------|-------|
| **Gemini text-embedding-004** | 768 (default) | FREE | Best value, multilingual |
| Gemini (full) | 3072 | FREE | Higher quality, more storage |
| OpenAI text-embedding-3-small | 1536 | $0.02/1M tokens | Reliable, well-documented |
| OpenAI text-embedding-3-large | 3072 | $0.13/1M tokens | Highest quality |

Per [Google's benchmarks](https://developers.googleblog.com/en/gemini-embedding-available-gemini-api/), Gemini outperforms OpenAI's embedding-3-large by ~6% while being free.

**Critical Rule:** Always use the SAME embedding model for:
- Document chunks
- User queries
- Learned facts

Mixing models produces meaningless similarity scores.

---

#### 4.5 Complete RAG Flow

```
User Question: "What's the pool cleaning schedule for Casa Luna?"
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. QUERY PROCESSING                                         │
│    • Embed query with Gemini                                │
│    • Extract keywords for BM25                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. HYBRID RETRIEVAL                                         │
│    • Vector search (semantic): top 20                       │
│    • BM25 search (keywords): top 20                         │
│    • RRF fusion → top 10                                    │
│    • (Optional) Rerank → top 5                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CONTEXT ASSEMBLY                                         │
│    • Retrieved chunks (with source metadata)                │
│    • Thread history (last 10 messages)                      │
│    • Relevant learned facts                                 │
│    • System prompt with persona                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. GENERATION (Gemini)                                      │
│    • Generate response with citations                       │
│    • Include source document names                          │
│    • Format for Slack                                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. RESPONSE                                                 │
│    "Pool cleaning at Casa Luna is Monday & Thursday at 8 AM"│
│    📄 Source: Property Maintenance SOP                      │
└─────────────────────────────────────────────────────────────┘
```

---

#### 4.6 Chunking Implementation

```typescript
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitters';

interface ChunkMetadata {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  sourceType: 'google_drive' | 'website';
  fileType: string;
  lastModified: Date;
}

async function chunkDocument(
  content: string,
  document: Document
): Promise<{ text: string; metadata: ChunkMetadata }[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 50,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });

  const rawChunks = await splitter.splitText(content);

  return rawChunks.map((chunk, index) => {
    // Add contextual prefix (Anthropic's method)
    const contextualChunk = `[Document: ${document.title}]\n\n${chunk}`;

    return {
      text: contextualChunk,
      metadata: {
        documentId: document.id,
        documentTitle: document.title,
        chunkIndex: index,
        sourceType: document.source_type,
        fileType: document.file_type,
        lastModified: document.last_modified,
      },
    };
  });
}

async function embedAndStore(chunks: { text: string; metadata: ChunkMetadata }[]) {
  // Batch embedding (more efficient than one-by-one)
  const BATCH_SIZE = 100;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.text);

    // Gemini embedding API
    const embeddings = await gemini.embedContent({
      model: 'text-embedding-004',
      content: texts,
    });

    // Store in Supabase
    const rows = batch.map((chunk, idx) => ({
      document_id: chunk.metadata.documentId,
      chunk_index: chunk.metadata.chunkIndex,
      content: chunk.text,
      embedding: embeddings[idx],
      metadata: chunk.metadata,
    }));

    await supabase.from('document_chunks').insert(rows);
  }
}
```

---

#### 4.7 Retrieval Quality Metrics

Track these to know if your RAG is working:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Recall@5** | >80% | % of relevant chunks in top 5 results |
| **MRR (Mean Reciprocal Rank)** | >0.7 | Average 1/rank of first relevant result |
| **Answer accuracy** | >90% | User feedback (thumbs up/down) |
| **Retrieval latency** | <500ms | Time from query to chunks retrieved |

**Testing retrieval quality:**
```typescript
// Create a test set of question → expected_document pairs
const testCases = [
  { question: 'What is check-in time?', expectedDoc: 'guest-checkin-sop' },
  { question: 'Pool maintenance schedule', expectedDoc: 'property-maintenance' },
];

// Run and measure recall
for (const test of testCases) {
  const results = await hybridSearch(test.question);
  const foundExpected = results.some(r => r.document_id === test.expectedDoc);
  console.log(`${test.question}: ${foundExpected ? '✓' : '✗'}`);
}
```

### 5. Self-Learning System

**Google Drive Real-Time Sync:**

The bot continuously monitors your Google Drive folder and automatically updates the knowledge base when documents change.

```
┌─────────────────────────────────────────────────────────────────┐
│                   GOOGLE DRIVE SYNC ENGINE                      │
└─────────────────────────────────────────────────────────────────┘

Every 5 minutes:
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  List Files  │───▶│ Compare Hash │───▶│ Detect Delta │
│  in Folder   │    │ + Modified   │    │              │
└──────────────┘    └──────────────┘    └──────┬───────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
           ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
           │  NEW FILE    │           │   MODIFIED   │           │   DELETED    │
           │  detected    │           │   FILE       │           │   FILE       │
           └──────┬───────┘           └──────┬───────┘           └──────┬───────┘
                  │                          │                          │
                  ▼                          ▼                          ▼
           ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
           │ Parse & Embed│           │ Delete old   │           │ Remove from  │
           │ Add to KB    │           │ Re-parse     │           │ Knowledge    │
           └──────────────┘           │ Re-embed     │           │ Base         │
                                      └──────────────┘           └──────────────┘
```

**Change Detection Methods:**
1. **Modified Timestamp**: Google Drive API returns `modifiedTime` - compare with last sync
2. **Content Hash**: MD5/SHA256 hash of file content - catches any content change
3. **File Version**: Drive tracks file versions - detect even if timestamp is same

**What Triggers an Update:**
- You edit a Google Doc and save → detected within 5 minutes
- You upload a new PDF → detected within 5 minutes
- You delete a file → removed from KB within 5 minutes
- You rename a file → metadata updated within 5 minutes
- You move a file out of the folder → removed from KB

**User Teaching (Natural Language):**
- Accept corrections in thread: "Actually, the check-in time is 3 PM not 4 PM"
- Bot detects correction intent and stores as learned fact
- Store learned facts with embeddings
- Include learned facts in RAG context (higher priority than old docs)
- Admin verification workflow for learned facts

**Website Scraping:**
- Weekly scheduled crawl of company website
- Extract text content from pages
- Process and embed like documents
- Differential updates (only changed pages)
- Remove pages that no longer exist

### 6. Admin Dashboard (Full UI Configuration)

**Design Philosophy:**
- Modern, clean UI built with Next.js + Tailwind CSS + shadcn/ui
- **ALL settings configurable via UI** - no code changes needed
- Real-time updates and live status indicators
- Mobile-responsive design
- Dark/light mode support

**Pages:**

1. **Overview Dashboard**
   - Bot status (online/offline) with uptime indicator
   - Live activity feed (recent questions/responses)
   - Total questions answered today/week/month
   - Response accuracy rating (from user feedback)
   - Last sync timestamps (Drive, Website)
   - Error logs summary with alerts
   - Quick action buttons (force sync, restart, etc.)

2. **Knowledge Base Management**
   - List of all indexed documents with search/filter
   - Document status (active/outdated/error/syncing)
   - Preview document content and chunks
   - Manual re-sync button per document or all
   - Add Google Drive folders to monitor
   - View embedding count and storage usage
   - Delete documents from knowledge base

3. **Channel Configuration**
   - Visual channel selector (pulls from Slack)
   - Toggle bot on/off per channel
   - Per-channel settings:
     - Response confidence threshold (slider: 50-100%)
     - Response delay (0-5 seconds)
     - Response style (formal/casual/friendly)
     - Quiet hours schedule
     - Topic blocklist
   - Test bot in channel button

4. **Analytics Dashboard**
   - Interactive charts (Recharts)
   - Most asked questions (word cloud + list)
   - Response times histogram
   - User satisfaction ratings over time
   - Knowledge gaps report (questions with low confidence)
   - Usage trends (daily/weekly/monthly)
   - Top users by question count
   - Export data to CSV

5. **Settings (API & Configuration)**
   - **API Keys Management:**
     - Google Drive credentials (OAuth flow via UI)
     - Gemini API key (with test button)
     - Slack tokens (with validation)
     - Supabase connection (auto-configured)
   - **Sync Settings:**
     - Drive polling interval (dropdown: 1/5/10/15/30 min)
     - Website scrape schedule (cron builder UI)
     - Website URLs to scrape (add/remove list)
   - **AI Settings:**
     - Gemini model selection
     - Temperature slider (0.0 - 1.0)
     - Max response length
     - System prompt customization
   - **General Settings:**
     - Bot display name
     - Bot avatar
     - Timezone configuration

6. **Learned Facts Management**
   - View all user-taught facts with source
   - Pending verification queue
   - Approve/reject/edit facts
   - See who taught what and when
   - Bulk actions (approve all, delete old)
   - Search and filter facts

7. **Logs & Debugging**
   - Real-time log viewer
   - Filter by log level (info/warn/error)
   - Search logs
   - Download log files
   - API request/response inspector

---

## Project Structure

```
cluebase-ai/
├── apps/
│   ├── api/                          # Backend API server
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point
│   │   │   ├── config/
│   │   │   │   └── env.ts            # Environment configuration
│   │   │   ├── services/
│   │   │   │   ├── slack/
│   │   │   │   │   ├── bot.ts        # Slack Bolt app setup
│   │   │   │   │   ├── handlers.ts   # Message handlers
│   │   │   │   │   └── commands.ts   # Slash commands
│   │   │   │   ├── google-drive/
│   │   │   │   │   ├── client.ts     # Drive API client
│   │   │   │   │   ├── sync.ts       # Document sync logic
│   │   │   │   │   └── parsers/
│   │   │   │   │       ├── docx.ts
│   │   │   │   │       ├── pdf.ts
│   │   │   │   │       ├── sheets.ts
│   │   │   │   │       └── index.ts
│   │   │   │   ├── scraper/
│   │   │   │   │   ├── crawler.ts    # Website crawler
│   │   │   │   │   └── extractor.ts  # Content extraction
│   │   │   │   ├── rag/
│   │   │   │   │   ├── embeddings.ts # Gemini embeddings
│   │   │   │   │   ├── chunker.ts    # Text chunking
│   │   │   │   │   ├── retriever.ts  # Vector search
│   │   │   │   │   └── generator.ts  # Response generation
│   │   │   │   ├── supabase/
│   │   │   │   │   ├── client.ts     # Supabase client
│   │   │   │   │   └── queries.ts    # Database queries
│   │   │   │   └── learning/
│   │   │   │       ├── facts.ts      # Learned facts management
│   │   │   │       └── feedback.ts   # User feedback handling
│   │   │   ├── jobs/
│   │   │   │   ├── scheduler.ts      # Cron job setup
│   │   │   │   ├── sync-drive.ts     # Drive sync job
│   │   │   │   └── scrape-website.ts # Website scrape job
│   │   │   ├── routes/
│   │   │   │   ├── api.ts            # Dashboard API routes
│   │   │   │   ├── health.ts         # Health check endpoint
│   │   │   │   └── webhooks.ts       # Slack webhooks
│   │   │   └── utils/
│   │   │       ├── logger.ts
│   │   │       └── errors.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── dashboard/                     # Admin dashboard (Next.js)
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx          # Home/Overview
│       │   │   ├── knowledge/
│       │   │   │   └── page.tsx      # Knowledge base management
│       │   │   ├── channels/
│       │   │   │   └── page.tsx      # Channel configuration
│       │   │   ├── analytics/
│       │   │   │   └── page.tsx      # Analytics dashboard
│       │   │   ├── settings/
│       │   │   │   └── page.tsx      # Bot settings
│       │   │   └── learning/
│       │   │       └── page.tsx      # Learned facts management
│       │   ├── components/
│       │   │   ├── ui/               # Reusable UI components
│       │   │   ├── charts/           # Analytics charts
│       │   │   └── tables/           # Data tables
│       │   └── lib/
│       │       ├── api.ts            # API client
│       │       └── supabase.ts       # Supabase client
│       ├── package.json
│       └── next.config.js
│
├── packages/
│   └── shared/                        # Shared types and utilities
│       ├── src/
│       │   ├── types/
│       │   │   ├── documents.ts
│       │   │   ├── slack.ts
│       │   │   └── analytics.ts
│       │   └── constants.ts
│       └── package.json
│
├── supabase/
│   └── migrations/                    # Database migrations
│       └── 001_initial_schema.sql
│
├── docker-compose.yml                 # Local development setup
├── .env.example                       # Environment variables template
├── package.json                       # Root package.json (monorepo)
├── turbo.json                         # Turborepo config (optional)
└── README.md                          # Project documentation
```

---

## MVP Scope (Recommended)

For a working MVP, focus on the core loop first. Ship fast, iterate based on real usage.

### MVP (Phase 1-4) - Target: 2-3 weeks of dev time
```
✅ INCLUDE                          ❌ DEFER TO V2
─────────────────────────────────   ─────────────────────────────────
Google Drive sync (polling)         Google Drive webhooks
Basic document parsing (PDF, DOCX)  Google Sheets, complex formats
Core RAG pipeline                   Advanced chunking strategies
Slack bot in 1-2 channels           Multi-channel configuration
Threaded conversations              Per-channel customization
Simple dashboard (status + docs)    Full analytics dashboard
Basic error handling                Graceful degradation tiers
                                    Website scraping
                                    Self-learning system
                                    Learned facts verification
                                    Load testing
```

### MVP Success Criteria
- [ ] Bot correctly answers 80%+ of questions from SOPs
- [ ] Response time < 5 seconds
- [ ] Documents sync within 10 minutes of changes
- [ ] No crashes for 24 hours of operation
- [ ] Team can view indexed documents in dashboard

---

## Implementation Phases

### Phase 1: Foundation Setup
**Goal:** Set up project structure and basic integrations

**Tasks:**
- [ ] Initialize monorepo with package manager (pnpm/npm workspaces)
- [ ] Set up TypeScript configuration
- [ ] Create Supabase project and run initial migrations
- [ ] Set up Google Cloud project and enable Drive API
- [ ] Create Slack app and configure OAuth/Bot tokens
- [ ] Set up Gemini API access
- [ ] Configure environment variables
- [ ] Create basic Express/Fastify server

**Deliverable:** Working project skeleton with all API connections verified

---

### Phase 2: Google Drive Integration
**Goal:** Fetch and process documents from Google Drive

**Tasks:**
- [ ] Implement Google Drive OAuth flow
- [ ] Build Drive folder listing and file fetching
- [ ] Create document parsers:
  - [ ] DOCX parser (mammoth.js or docx4js)
  - [ ] PDF parser (pdf-parse)
  - [ ] Google Docs export (Drive API)
  - [ ] Google Sheets export (Sheets API)
- [ ] Implement text chunking strategy (recursive character splitter)
- [ ] Track document metadata and content hashes
- [ ] Build initial sync functionality

**Deliverable:** Ability to fetch and parse all documents from a Drive folder

---

### Phase 3: Knowledge Base & RAG
**Goal:** Store documents and enable semantic search

**Tasks:**
- [ ] Integrate Gemini embeddings API
- [ ] Create embedding generation for document chunks
- [ ] Store chunks with embeddings in Supabase
- [ ] Implement vector similarity search function
- [ ] Build RAG pipeline:
  - [ ] Query embedding
  - [ ] Top-k retrieval
  - [ ] Context assembly
  - [ ] Prompt template
- [ ] Integrate Gemini for response generation
- [ ] Add source citation in responses

**Deliverable:** Working RAG system that answers questions using documents

---

### Phase 4: Slack Bot Integration
**Goal:** Deploy bot to Slack channels with natural language understanding

**Tasks:**
- [ ] Set up Slack Bolt SDK with Socket Mode
- [ ] Configure event subscriptions (message.channels, message.groups)
- [ ] Build intent classifier using Gemini:
  - [ ] Detect if message is a question
  - [ ] Determine if question is relevant to knowledge base
  - [ ] Calculate confidence score
- [ ] Implement natural language message handler
- [ ] Build threaded conversation system:
  - [ ] Always respond in threads
  - [ ] Track thread context in database
  - [ ] Support multi-turn conversations
  - [ ] Include thread history in RAG context
- [ ] Add typing indicators while processing
- [ ] Implement feedback buttons (thumbs up/down)
- [ ] Build channel configuration system (enable/disable per channel)
- [ ] Add confidence threshold filtering
- [ ] Deploy initial bot to workspace

**Deliverable:** Functional Slack bot that naturally responds to questions in channels

---

### Phase 5: Auto-Sync & Self-Learning
**Goal:** Keep knowledge base automatically updated

**Tasks:**
- [ ] Implement Drive polling scheduler (configurable: 1-30 minutes)
- [ ] Build change detection system:
  - [ ] Compare modified timestamps from Drive API
  - [ ] Hash content to detect changes
  - [ ] Track file versions
- [ ] Handle document updates (delete old chunks, re-embed)
- [ ] Handle document deletions (cascade delete from KB)
- [ ] Handle new documents (parse, chunk, embed)
- [ ] Create learned facts system:
  - [ ] Natural language correction detection ("actually...", "the correct...")
  - [ ] Store facts with embeddings and metadata
  - [ ] Include learned facts in RAG context (higher weight)
  - [ ] Track who taught what
- [ ] Build admin verification workflow in dashboard
- [ ] Add sync status notifications to dashboard

**Deliverable:** Bot that stays current with Drive changes and learns from users

---

### Phase 6: Website Scraping
**Goal:** Extract and index company website content

**Tasks:**
- [ ] Set up Puppeteer/Playwright crawler
- [ ] Configure allowed URLs/paths
- [ ] Build content extractor (main content, not nav/footer)
- [ ] Implement weekly cron job
- [ ] Add differential updates (only changed pages)
- [ ] Integrate scraped content into knowledge base
- [ ] Handle removed pages

**Deliverable:** Weekly-updated website content in knowledge base

---

### Phase 7: Admin Dashboard
**Goal:** Build management interface

**Tasks:**
- [ ] Set up Next.js project with Tailwind CSS
- [ ] Implement authentication (Supabase Auth or NextAuth)
- [ ] Build dashboard pages:
  - [ ] Overview with key metrics
  - [ ] Knowledge base browser
  - [ ] Channel configuration
  - [ ] Settings management
  - [ ] Analytics charts
  - [ ] Learned facts review
- [ ] Create API endpoints for dashboard
- [ ] Add real-time updates (websockets or polling)

**Deliverable:** Fully functional admin dashboard

---

### Phase 8: Polish & Production
**Goal:** Production-ready deployment

**Tasks:**
- [ ] Add comprehensive error handling
- [ ] Implement rate limiting
- [ ] Add request logging and monitoring
- [ ] Set up alerting (PagerDuty/Slack alerts)
- [ ] Write documentation
- [ ] Performance optimization
- [ ] Security audit
- [ ] Load testing
- [ ] Deploy to production environment

**Deliverable:** Production-ready, monitored application

---

## API Keys & Services Required

| Service | What You Need | Where to Get It |
|---------|---------------|-----------------|
| **Google Cloud** | OAuth 2.0 credentials, API key | [Google Cloud Console](https://console.cloud.google.com) |
| **Google Drive API** | Enable in Google Cloud project | [API Library](https://console.cloud.google.com/apis/library/drive.googleapis.com) |
| **Google Gemini** | API key | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| **Supabase** | Project URL, Anon key, Service role key | [Supabase Dashboard](https://supabase.com/dashboard) |
| **Slack** | Bot token, Signing secret, App-level token | [Slack API Apps](https://api.slack.com/apps) |

---

## Environment Variables

```env
# Google Cloud / Drive
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_DRIVE_FOLDER_ID=

# Gemini AI
GEMINI_API_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=
SLACK_APP_TOKEN=xapp-...

# App Config
NODE_ENV=development
PORT=3000
DASHBOARD_URL=http://localhost:3001

# Website Scraping (configurable per workspace)
COMPANY_WEBSITE_URL=https://example.com
SCRAPE_SCHEDULE=0 0 * * 0  # Weekly on Sunday midnight

# Sync Config
DRIVE_POLL_INTERVAL_MS=600000  # 10 minutes
```

---

## Key Libraries

**Backend (Node.js/TypeScript):**
```json
{
  "dependencies": {
    "@slack/bolt": "^3.x",
    "@google/generative-ai": "^0.x",
    "googleapis": "^130.x",
    "@supabase/supabase-js": "^2.x",
    "mammoth": "^1.x",
    "pdf-parse": "^1.x",
    "puppeteer": "^21.x",
    "cheerio": "^1.x",
    "node-cron": "^3.x",
    "express": "^4.x",
    "zod": "^3.x",
    "winston": "^3.x"
  }
}
```

**Dashboard (Next.js):**
```json
{
  "dependencies": {
    "next": "^14.x",
    "react": "^18.x",
    "@supabase/supabase-js": "^2.x",
    "@tanstack/react-query": "^5.x",
    "tailwindcss": "^3.x",
    "recharts": "^2.x",
    "shadcn/ui": "latest"
  }
}
```

---

## Slack App Configuration

**OAuth Scopes (Bot Token):**
- `channels:history` - Read channel messages (required for listening)
- `channels:read` - View channel info
- `chat:write` - Send messages and respond in threads
- `groups:history` - Private channel messages
- `groups:read` - Private channel info
- `reactions:write` - Add reactions (for feedback)
- `users:read` - User info (for learned facts attribution)

**Event Subscriptions:**
- `message.channels` - All messages in public channels (for natural language detection)
- `message.groups` - All messages in private channels

**Socket Mode:** Enabled (recommended for real-time message handling)

**Note:** No slash commands or app_mention needed - bot listens to all messages and uses AI to decide when to respond.

---

## Sample Bot Interactions

### Natural Question Detection (No @mention needed)
```
#operations channel:

Maria: Hey does anyone know what the check-in process is for guests?

    └─ Thread:
       Cluebase: Based on our SOPs, here's the check-in process:

       1. **Pre-arrival** (24 hours before):
          - Send welcome email with property access codes
          - Confirm arrival time

       2. **Day of arrival**:
          - Property manager conducts final inspection
          - Ensure all amenities are stocked

       3. **Guest arrival**:
          - Greet at property (if requested)
          - Walk through house features
          - Provide emergency contact numbers

       📄 Sources:
       • Guest Check-in SOP v2.3 (updated Dec 10, 2024)

       Was this helpful? [👍] [👎]
```

### Multi-Turn Threaded Conversation
```
#operations channel:

Carlos: What's the pool cleaning schedule?

    └─ Thread:
       Cluebase: Pool cleaning is scheduled as follows:
       - Casa Luna: Monday & Thursday, 8 AM
       - Villa Sol: Tuesday & Friday, 9 AM
       - Casa del Mar: Wednesday & Saturday, 8 AM

       📄 Source: Property Maintenance SOP

       ───────────────────────────────

       Carlos: What about Casa Luna specifically if there's a guest checkout?

       Cluebase: Great follow-up! For Casa Luna post-checkout:
       - Emergency pool cleaning within 4 hours of checkout
       - Full chemical balance check
       - Skim and vacuum
       - Contact pool vendor: ABC Pool Services (555-1234)

       This is in addition to the regular Monday/Thursday schedule.

       📄 Source: Property Maintenance SOP, Section 4.2

       ───────────────────────────────

       Carlos: Perfect, thanks!

       Cluebase: You're welcome! Let me know if you have other questions. 😊
```

### Self-Learning Example
```
#operations channel:

Sofia: Actually the check-in time changed to 3 PM, not 4 PM

    └─ Thread:
       Cluebase: Thanks for the update! I've noted that:

       ✅ **Learned:** Check-in time is now 3 PM (previously 4 PM)

       This will be pending admin verification. I'll use this info
       going forward while it's reviewed.

       _Taught by Sofia on Dec 19, 2024_
```

### Bot Stays Silent (Not a Question)
```
#general channel:

Juan: Great job on the event yesterday everyone! 🎉
      (Bot does not respond - not a question about SOPs)

Maria: Thanks! It was fun
      (Bot does not respond)

Carlos: What time should we arrive for setup tomorrow?
      (Bot does not respond - casual/scheduling question, not SOP-related)
```

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Response accuracy | >90% helpful | User feedback ratings |
| Response time | <5 seconds | Server logs |
| Document sync latency | <15 minutes | Sync timestamps |
| Knowledge base coverage | 100% of SOPs | Document count |
| User adoption | >80% of team | Unique users/week |
| Error rate | <1% | Error logs |

---

## Error Handling & Resilience

### External API Failures

| Service | Failure Mode | Handling Strategy |
|---------|--------------|-------------------|
| **Gemini API** | Rate limit / 503 | Retry 3x with exponential backoff (1s, 2s, 4s). If still fails, respond: "I'm having trouble thinking right now. Please try again in a moment." |
| **Gemini API** | Token limit exceeded | Truncate context, keep most recent thread messages + top 3 KB chunks |
| **Supabase** | Connection failed | Retry 3x. If fails, log error, respond: "I can't access my knowledge base right now." |
| **Google Drive** | Auth expired | Auto-refresh token. If fails, alert admin via dashboard + Slack DM |
| **Google Drive** | Rate limited | Queue sync jobs, process with delay. Never block bot responses. |
| **Slack API** | Rate limited | Respect `Retry-After` header, queue messages |

### Document Processing Errors

```typescript
// Pseudo-code for robust document processing
async function processDocument(file: DriveFile) {
  try {
    const content = await parseDocument(file);
    if (!content || content.length < 10) {
      throw new Error('Empty or invalid content');
    }
    const chunks = chunkText(content);
    const embeddings = await generateEmbeddings(chunks);
    await storeInSupabase(file.id, chunks, embeddings);

    logSuccess(file.id);
  } catch (error) {
    // Don't fail silently - track the error
    await markDocumentAsErrored(file.id, error.message);
    alertAdminIfCritical(error);

    // Don't block other documents
    return;
  }
}
```

### Graceful Degradation Tiers

```
Tier 1 (Full Service):
  ✓ Gemini available
  ✓ Supabase available
  ✓ Full RAG pipeline
  → Normal operation

Tier 2 (Degraded - No AI):
  ✗ Gemini unavailable
  ✓ Supabase available
  → Keyword search fallback, return raw document excerpts

Tier 3 (Degraded - Cache Only):
  ✗ Gemini unavailable
  ✗ Supabase unavailable
  → Return cached responses for common questions (Redis)

Tier 4 (Offline):
  ✗ All services down
  → "I'm currently offline for maintenance. Please try again later."
```

---

## Edge Cases

### Message Handling

| Edge Case | How to Handle |
|-----------|---------------|
| Very long message (>4000 chars) | Truncate, focus on first paragraph |
| Multiple questions in one message | Answer the first clear question, offer to address others |
| Message in non-English | Detect language, respond in same language (Gemini supports this) |
| User replies in thread bot didn't start | Check if question is relevant, respond if yes |
| Rapid-fire questions from same user | Rate limit: max 5 questions/minute per user |
| Empty or whitespace-only message | Ignore silently |
| Message is just emoji/reactions | Ignore silently |

### Document Processing

| Edge Case | How to Handle |
|-----------|---------------|
| File > 10MB | Skip, log warning, alert admin |
| Corrupted PDF | Try alternate parser, mark as errored if fails |
| Password-protected file | Skip, notify admin via dashboard |
| Empty document | Skip, don't add to KB |
| Scanned PDF (images only) | Use OCR (Tesseract) or skip with warning |
| Google Doc with images/diagrams | Extract text only, note that images were skipped |
| Spreadsheet with multiple sheets | Process all sheets, prefix content with sheet name |
| Document with 100+ pages | Chunk carefully, may need multiple embedding batches |

### Knowledge Base Conflicts

| Edge Case | How to Handle |
|-----------|---------------|
| Two docs have conflicting info | Prefer more recently modified document |
| Learned fact contradicts document | Flag for admin review, use learned fact temporarily |
| Document deleted but still referenced | Remove from KB, update any cached responses |
| Same doc uploaded twice | Detect via content hash, skip duplicate |

### Thread Management

| Edge Case | How to Handle |
|-----------|---------------|
| Thread has 50+ messages | Only include last 10 messages in context |
| Thread inactive for 24+ hours | Mark session as closed, start fresh if user returns |
| User deletes their message | Bot response remains, log the deletion |
| Bot's response is deleted | Log it, don't re-respond |

---

## Testing Strategy

### Unit Tests

```
tests/
├── unit/
│   ├── parsers/
│   │   ├── docx.test.ts      # Test DOCX extraction
│   │   ├── pdf.test.ts       # Test PDF extraction
│   │   ├── sheets.test.ts    # Test spreadsheet parsing
│   │   └── fixtures/         # Sample files for testing
│   ├── chunker.test.ts       # Text chunking logic
│   ├── intent-classifier.test.ts  # Question detection
│   ├── heuristics.test.ts    # Fast filters
│   └── hash.test.ts          # Content hashing
```

**Key Unit Test Cases:**
- Parser handles malformed files gracefully
- Chunker respects max chunk size
- Chunker maintains sentence boundaries
- Intent classifier correctly identifies questions
- Heuristics filter non-questions efficiently

### Integration Tests

```
tests/
├── integration/
│   ├── drive-sync.test.ts    # Drive API integration
│   ├── supabase.test.ts      # DB operations + vector search
│   ├── gemini.test.ts        # Embeddings + generation
│   ├── slack.test.ts         # Message handling
│   └── rag-pipeline.test.ts  # End-to-end RAG
```

**Key Integration Test Cases:**
- Drive sync detects new/modified/deleted files
- Vector search returns relevant results
- Embeddings are consistent (same text → same vector)
- Slack messages trigger correct handlers
- Thread context is properly maintained

### End-to-End Tests

```typescript
// Example E2E test
describe('Bot answers questions from SOPs', () => {
  beforeAll(async () => {
    // Seed test documents into Drive
    await uploadTestDocument('test-sop.docx');
    await waitForSync();
  });

  it('answers a question about content in the SOP', async () => {
    const response = await simulateSlackMessage(
      'What is the checkout time?'
    );

    expect(response).toContain('checkout');
    expect(response.sources).toContain('test-sop.docx');
  });

  it('maintains context in thread', async () => {
    const thread = await startThread('What properties do we manage?');
    const followUp = await replyInThread(thread, 'What about Casa Luna specifically?');

    expect(followUp).toContain('Casa Luna');
    // Should not re-explain all properties
  });
});
```

### RAG Quality Tests

```typescript
// Test that RAG returns accurate answers
describe('RAG Accuracy', () => {
  const testCases = [
    {
      question: 'What time is check-in?',
      expectedAnswer: /3\s*PM|3:00|15:00/i,
      requiredSource: 'check-in-sop'
    },
    {
      question: 'How do I report a maintenance issue?',
      expectedAnswer: /maintenance form|submit ticket/i,
      requiredSource: 'maintenance-procedures'
    }
  ];

  testCases.forEach(({ question, expectedAnswer, requiredSource }) => {
    it(`correctly answers: "${question}"`, async () => {
      const response = await askBot(question);
      expect(response.text).toMatch(expectedAnswer);
      expect(response.sources).toContain(requiredSource);
    });
  });
});
```

### Load Testing

```
Tools: k6 or Artillery

Scenarios:
1. Sustained load: 10 questions/minute for 1 hour
2. Spike test: 50 questions in 1 minute
3. Soak test: Low traffic (1 q/min) for 24 hours

Metrics to track:
- Response time (p50, p95, p99)
- Error rate
- Memory usage over time
- Supabase connection pool health
```

---

## Security Considerations

1. **API Keys:** Store all secrets in environment variables, never commit
2. **Slack:** Verify request signatures on all incoming webhooks
3. **Supabase:** Use Row Level Security (RLS) policies
4. **Dashboard:** Implement proper authentication/authorization
5. **Google OAuth:** Use proper token refresh flow, store securely
6. **Rate Limiting:** Implement on all API endpoints
7. **Logging:** Never log sensitive data (PII, credentials)

---

## Next Steps

1. Review this plan and provide feedback
2. Set up the required accounts and API keys
3. Begin Phase 1: Foundation Setup
4. Iterate through each phase with testing

---

*Cluebase AI - Multi-tenant Knowledge Management Platform*

---

# Enhancement Plan v2.0: Multi-Bot Platform

## Executive Summary

This section outlines enhancements to transform the single-bot RAG system into a flexible, multi-bot platform with document categorization, improved source attribution, and enterprise-ready deployment.

---

## Enhancement 1: Document Categorization System

### Current State
- Documents stored in flat structure with `source_type` (google_drive, website)
- No distinction between SOPs, company knowledge, website content
- All documents searched equally for every query

### Target State
- Documents organized by **category** (knowledge type) and **scope** (which bots can access)
- Search can filter by category or combine across categories with proper attribution
- Source citations clearly indicate document category

### Database Migration

```sql
-- New ENUM for document categories
CREATE TYPE document_category AS ENUM (
  'company_knowledge',    -- General company info, website scrape
  'internal_sops',        -- Standard operating procedures
  'marketing',            -- Marketing materials, brand guidelines
  'sales',                -- Sales playbooks, pricing
  'operations',           -- Operational procedures
  'hr_policies',          -- HR documentation
  'technical',            -- Technical documentation
  'custom'                -- User-defined categories
);

-- Add to documents table
ALTER TABLE documents ADD COLUMN category document_category DEFAULT 'company_knowledge';
ALTER TABLE documents ADD COLUMN category_custom VARCHAR(100); -- For 'custom' type
ALTER TABLE documents ADD COLUMN priority INTEGER DEFAULT 5;   -- 1-10, higher = more important

-- Create index for category filtering
CREATE INDEX idx_documents_category ON documents(category, is_active);

-- Update chunks metadata to include category
-- Already using JSONB metadata, add category field during sync
```

### Updated Search Function

```sql
CREATE OR REPLACE FUNCTION hybrid_search_categorized(
  query_text TEXT,
  query_embedding VECTOR(768),
  category_filter document_category[] DEFAULT NULL,
  top_k INTEGER DEFAULT 15,
  vector_weight FLOAT DEFAULT 0.5,
  keyword_weight FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT,
  category document_category,
  document_title TEXT,
  source_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      dc.id,
      dc.content,
      dc.document_id,
      d.category,
      d.title,
      d.source_url,
      1 - (dc.embedding <=> query_embedding) AS similarity,
      ROW_NUMBER() OVER (ORDER BY dc.embedding <=> query_embedding) AS vector_rank
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE d.is_active = true
      AND (category_filter IS NULL OR d.category = ANY(category_filter))
    ORDER BY dc.embedding <=> query_embedding
    LIMIT 20
  ),
  keyword_results AS (
    SELECT
      dc.id,
      dc.content,
      dc.document_id,
      d.category,
      d.title,
      d.source_url,
      ts_rank(dc.fts, plainto_tsquery('english', query_text)) AS text_rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank(dc.fts, plainto_tsquery('english', query_text)) DESC) AS keyword_rank
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE dc.fts @@ plainto_tsquery('english', query_text)
      AND d.is_active = true
      AND (category_filter IS NULL OR d.category = ANY(category_filter))
    ORDER BY text_rank DESC
    LIMIT 20
  ),
  combined AS (
    SELECT
      COALESCE(v.id, k.id) AS chunk_id,
      COALESCE(v.document_id, k.document_id) AS document_id,
      COALESCE(v.content, k.content) AS content,
      COALESCE(v.similarity, 0) AS similarity,
      COALESCE(v.category, k.category) AS category,
      COALESCE(v.title, k.title) AS document_title,
      COALESCE(v.source_url, k.source_url) AS source_url,
      (vector_weight / (60 + COALESCE(v.vector_rank, 1000))) +
      (keyword_weight / (60 + COALESCE(k.keyword_rank, 1000))) AS rank_score
    FROM vector_results v
    FULL OUTER JOIN keyword_results k ON v.id = k.id
  )
  SELECT c.chunk_id, c.document_id, c.content, c.similarity, c.category, c.document_title, c.source_url
  FROM combined c
  ORDER BY c.rank_score DESC
  LIMIT top_k;
END;
$$ LANGUAGE plpgsql;
```

### API Changes

```typescript
// Enhanced SearchOptions interface
interface SearchOptions {
  query: string;
  categories?: DocumentCategory[];  // Filter to specific categories
  combineCategories?: boolean;      // If true, search all but attribute separately
  topK?: number;
  minSimilarity?: number;
}

// Enhanced SearchResult
interface SearchResult {
  content: string;
  similarity: number;
  documentId: string;
  documentTitle: string;
  sourceUrl: string | null;
  category: DocumentCategory;       // Which category this came from
  categoryLabel: string;            // Human-readable: "Internal SOP", "Company Knowledge"
}
```

### Source Attribution Enhancement

When responding, the bot will:
1. Group sources by category in the response
2. Cite with category prefix: "According to *[SOP: Check-in Procedures]*..."
3. Indicate when combining: "Based on company knowledge and internal SOPs..."

Example response format:
```
Based on our Standard Operating Procedures and company knowledge:

**From Check-in Procedures (SOP):**
Guests should arrive between 3 PM and 8 PM...

**From Company Website:**
Your company offers premium services...

---
📚 Sources:
- Check-in Procedures (Internal SOP)
- company.com/about (Company Knowledge)
```

### Dashboard Category Management

New features in Documents page:
- Category filter tabs: `[All] [Company Knowledge] [SOPs] [Marketing] [Sales]`
- Drag-and-drop category assignment
- Bulk category updates
- Category-specific sync settings
- Google Drive folder → category mapping

---

## Enhancement 2: Website Scraping Improvements

### Current Limitation
```typescript
// apps/api/src/services/scraper/website.ts:54
while (urlsToScrape.size > 0 && scrapedUrls.size < 50) { // Hard limit!
```

### Solution: Configurable Scraping

```typescript
// New scraper configuration interface
interface ScraperConfig {
  maxPages: number;           // Default: 500 (was 50)
  maxDepth: number;           // Max link depth from start URL (default: 10)
  rateLimit: number;          // Milliseconds between requests (default: 1000)
  respectRobotsTxt: boolean;  // Check robots.txt (default: true)
  includePatterns: string[];  // URL patterns to include (glob patterns)
  excludePatterns: string[];  // URL patterns to exclude
  category: DocumentCategory; // Assign to scraped pages
  timeout: number;            // Page load timeout (default: 30000)
  userAgent: string;          // Custom user agent
}

// Default configuration
const DEFAULT_SCRAPER_CONFIG: ScraperConfig = {
  maxPages: 500,
  maxDepth: 10,
  rateLimit: 1000,
  respectRobotsTxt: true,
  includePatterns: ['*'],
  excludePatterns: [
    '**/login*',
    '**/admin*',
    '**/cart*',
    '**/checkout*'
  ],
  category: 'company_knowledge',
  timeout: 30000,
  userAgent: 'Cluebase/1.0 (+https://cluebase.ai/bot)'
};
```

### Implementation Changes

```typescript
// apps/api/src/services/scraper/website.ts

import robotsParser from 'robots-parser';

async function scrapeWebsite(
  url: string,
  config: Partial<ScraperConfig> = {}
): Promise<ScrapeResult> {
  const settings = { ...DEFAULT_SCRAPER_CONFIG, ...config };

  // Check robots.txt
  let robots: ReturnType<typeof robotsParser> | null = null;
  if (settings.respectRobotsTxt) {
    const robotsUrl = new URL('/robots.txt', url).href;
    try {
      const robotsContent = await fetch(robotsUrl).then(r => r.text());
      robots = robotsParser(robotsUrl, robotsContent);
    } catch {
      // robots.txt not found, proceed without restrictions
    }
  }

  const urlsToScrape = new Set([url]);
  const scrapedUrls = new Set<string>();
  const results: PageResult[] = [];

  while (urlsToScrape.size > 0 && scrapedUrls.size < settings.maxPages) {
    const currentUrl = urlsToScrape.values().next().value;
    urlsToScrape.delete(currentUrl);

    // Check robots.txt
    if (robots && !robots.isAllowed(currentUrl, settings.userAgent)) {
      continue;
    }

    // Check URL patterns
    if (!matchesPatterns(currentUrl, settings.includePatterns, settings.excludePatterns)) {
      continue;
    }

    // Rate limiting
    await sleep(settings.rateLimit);

    // Scrape page...
    const pageResult = await scrapePage(currentUrl, settings);
    if (pageResult) {
      results.push({
        ...pageResult,
        category: settings.category
      });
    }

    scrapedUrls.add(currentUrl);
  }

  return {
    pagesScraped: results.length,
    results,
    errors: []
  };
}
```

### Dashboard Scrape Configuration

New UI in Settings:
- Max pages slider: 50 → 1000
- URL include/exclude patterns
- Category assignment for scraped pages
- Progress indicator during scrape
- Preview of discovered pages before scraping

---

## Enhancement 3: Multi-Bot Architecture

### Concept

Create a **workspace/bot** system where:
- Each bot has its own Slack configuration
- Each bot has access to specific document categories
- Bots can share common knowledge while having exclusive access to their domain
- Single codebase, multiple bot instances

### Database Schema

```sql
-- Bots table
CREATE TABLE bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,  -- 'operations', 'marketing', 'sales'
  description TEXT,
  system_prompt TEXT,                 -- Bot-specific personality/instructions
  slack_bot_token TEXT,               -- Each bot has own Slack credentials
  slack_app_token TEXT,
  slack_signing_secret TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot-category access control
CREATE TABLE bot_category_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  category document_category NOT NULL,
  access_level VARCHAR(20) DEFAULT 'read', -- 'read', 'write', 'admin'
  priority INTEGER DEFAULT 5,               -- Search priority for this category
  UNIQUE(bot_id, category)
);

-- Track which bot handled which conversation
ALTER TABLE thread_sessions ADD COLUMN bot_id UUID REFERENCES bots(id);
ALTER TABLE thread_messages ADD COLUMN bot_id UUID REFERENCES bots(id);

-- Documents can be assigned to specific bots (optional restriction)
ALTER TABLE documents ADD COLUMN bot_id UUID REFERENCES bots(id);
-- NULL means accessible to all bots with category access
```

### Bot Configuration Examples

```yaml
# Operations Bot (example)
operations_bot:
  name: "Cluebase Operations"
  slug: "operations"
  categories:
    - company_knowledge: { priority: 5 }
    - internal_sops: { priority: 10 }      # Highest priority
    - operations: { priority: 8 }
  system_prompt: |
    You are Cluebase, the operations assistant for your organization.
    Focus on SOPs, procedures, and operational questions.
    Always prioritize internal SOPs when answering operational questions.
    Cite your sources with the category prefix.

# Marketing Bot
marketing_bot:
  name: "Cluebase Marketing"
  slug: "marketing"
  categories:
    - company_knowledge: { priority: 5 }
    - marketing: { priority: 10 }
    - sales: { priority: 7 }
  system_prompt: |
    You are the Marketing Assistant for your organization.
    Help with campaigns, brand guidelines, social media, and lead generation.
    Focus on marketing materials and sales strategies.

# General Knowledge Bot
general_bot:
  name: "Cluebase General"
  slug: "general"
  categories:
    - company_knowledge: { priority: 10 }
  system_prompt: |
    You are a general knowledge assistant for your organization.
    Answer questions about the company, products, and services.
```

### Runtime Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Server (Port 3000)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│  │ Operations Bot   │ │ Marketing Bot    │ │ General Bot  │ │
│  │ Socket: /ops     │ │ Socket: /mkt     │ │ Socket: /gen │ │
│  │ Categories:      │ │ Categories:      │ │ Categories:  │ │
│  │ - SOPs           │ │ - Marketing      │ │ - Company    │ │
│  │ - Operations     │ │ - Sales          │ │   Knowledge  │ │
│  │ - Company        │ │ - Company        │ │              │ │
│  └────────┬─────────┘ └────────┬─────────┘ └──────┬───────┘ │
│           │                    │                   │         │
│           └────────────────────┼───────────────────┘         │
│                                ▼                             │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              Shared RAG Search Engine                    ││
│  │  - Category-filtered hybrid search                       ││
│  │  - Bot-specific priority weighting                       ││
│  │  - Cross-category source attribution                     ││
│  └──────────────────────────────────────────────────────────┘│
│                                │                             │
│                                ▼                             │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              Shared Document Store                       ││
│  │  - Supabase + pgvector                                   ││
│  │  - Category-indexed documents                            ││
│  │  - Unified embeddings                                    ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Dashboard Bot Management

New "Bots" page:
- List of all configured bots
- Create/edit bot configurations
- Assign categories to bots
- Test bot responses
- View per-bot analytics
- Slack credential management per bot

---

## Enhancement 4: Docker Deployment Verification

### Current Status: ✅ Complete

The Docker deployment is production-ready with:

1. **Multi-stage builds** - Optimized image sizes
2. **Health checks** - Automatic container health monitoring
3. **Environment variables** - Full configuration via .env
4. **Network isolation** - Secure inter-service communication
5. **Graceful shutdown** - Proper signal handling

### Deployment Verification Checklist

```bash
# 1. Build and start
docker compose up -d --build

# 2. Verify health
curl http://localhost:3000/health
# Expected: {"status":"healthy","services":{"supabase":true,"slack":true,...}}

# 3. Access dashboard
open http://localhost:3001

# 4. Check logs
docker compose logs -f api
docker compose logs -f dashboard

# 5. Test Slack connection
# Send a message in configured Slack channel
# Bot should respond in thread
```

### Production Deployment

See `DEPLOYMENT.md` for complete production deployment guide including:
- Reverse proxy (nginx) configuration
- SSL/TLS setup
- Monitoring recommendations
- Backup strategies

---

## Enhancement 5: Feedback System

### Overview

A feedback system that allows users to rate bot responses with thumbs up/down buttons. This data will be used for:
1. Quality monitoring in analytics dashboard
2. Identifying areas for improvement
3. Training data for future model enhancements
4. User satisfaction tracking per bot

### Slack Integration

Each bot response includes interactive buttons:
```
[Bot Response Content]

Was this helpful?  [👍 Yes]  [👎 No]
```

### Database Schema

```sql
-- Create feedback table
CREATE TABLE response_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES thread_messages(id) ON DELETE CASCADE,
  session_id UUID REFERENCES thread_sessions(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,

  -- Feedback details
  is_helpful BOOLEAN NOT NULL,           -- true = 👍, false = 👎
  feedback_text TEXT,                      -- Optional text feedback

  -- Context for analysis
  query_text TEXT,                         -- Original question
  response_text TEXT,                      -- Bot's response
  sources_used JSONB DEFAULT '[]',         -- Which sources were cited

  -- User info
  slack_user_id VARCHAR NOT NULL,
  slack_channel_id VARCHAR NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX idx_feedback_bot ON response_feedback(bot_id, created_at);
CREATE INDEX idx_feedback_helpful ON response_feedback(is_helpful, created_at);
CREATE INDEX idx_feedback_session ON response_feedback(session_id);
```

### API Endpoints

```typescript
// Submit feedback
POST /api/feedback
{
  messageId: string;
  isHelpful: boolean;
  feedbackText?: string;
}

// Get feedback analytics
GET /api/feedback/analytics?botId=xxx&startDate=xxx&endDate=xxx
Response: {
  totalResponses: number;
  helpfulCount: number;
  unhelpfulCount: number;
  satisfactionRate: number;  // Percentage
  recentUnhelpful: FeedbackEntry[];
  trendsOverTime: TimeSeriesData[];
}

// Get feedback for specific message
GET /api/feedback/:messageId
```

### Dashboard Analytics

New "Response Quality" section on Overview page:
- **Satisfaction Rate**: Overall % of helpful responses
- **Trend Chart**: Satisfaction over time (7d, 30d, 90d)
- **Recent Issues**: List of recent 👎 responses for review
- **Per-Bot Breakdown**: Satisfaction rates by bot

New "Feedback Review" page:
- Filter by bot, date range, helpful/unhelpful
- View original query and response
- See which sources were used
- Mark feedback as reviewed/addressed
- Export feedback data for analysis

### Slack Implementation

```typescript
// Add buttons to bot response
const feedbackBlocks = [
  {
    type: "actions",
    block_id: "feedback_block",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "👍 Helpful" },
        action_id: "feedback_helpful",
        value: JSON.stringify({ messageId, sessionId })
      },
      {
        type: "button",
        text: { type: "plain_text", text: "👎 Not Helpful" },
        action_id: "feedback_unhelpful",
        value: JSON.stringify({ messageId, sessionId })
      }
    ]
  }
];

// Handle button clicks
app.action('feedback_helpful', async ({ ack, body, say }) => {
  await ack();
  await recordFeedback(body, true);
  // Update message to show feedback received
});

app.action('feedback_unhelpful', async ({ ack, body, say }) => {
  await ack();
  await recordFeedback(body, false);
  // Optionally prompt for more details
});
```

### Optional: Detailed Feedback Modal

When user clicks 👎:
```
┌────────────────────────────────────┐
│  What could be improved?           │
├────────────────────────────────────┤
│ ○ Answer was incorrect             │
│ ○ Answer was incomplete            │
│ ○ Couldn't find the information    │
│ ○ Response was confusing           │
│ ○ Other                            │
├────────────────────────────────────┤
│ Additional comments:               │
│ ┌────────────────────────────────┐ │
│ │                                │ │
│ └────────────────────────────────┘ │
├────────────────────────────────────┤
│            [Submit]                │
└────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 0: Interactive Setup Wizard ✅ COMPLETE

**Goal**: Enable first-time users to configure the entire application through a beautiful, guided UI experience — no manual environment variable editing required.

**Status**: Fully implemented with 8-step wizard at `/setup`

#### Setup Wizard Steps

| Step | Name | Description | Status |
|------|------|-------------|--------|
| 1 | **Welcome** | Introduction, overview of what will be configured | ✅ |
| 2 | **Database** | Supabase connection (URL + Service Role Key) | ✅ |
| 3 | **AI Provider** | Gemini API key configuration | ✅ |
| 4 | **Slack App** | Bot Token + App Token + Signing Secret | ✅ |
| 5 | **Google Drive** | OAuth setup for document access | ✅ |
| 6 | **Knowledge Source** | Select Drive folder(s) + website URL to scrape | ✅ |
| 7 | **First Bot** | Create the default bot with custom instructions | ✅ |
| 8 | **Review & Launch** | Summary of all settings, trigger initial sync | ✅ |

#### Completed Features

- Multi-step wizard with progress indicator
- Real-time validation with success/error states
- Collapsible instruction panels per step
- Copy buttons for tokens/keys
- Test connection buttons with loading states
- Modal dialogs for detailed instructions
- Responsive design (tablet + desktop)
- Setup status middleware (redirect to /setup if not configured)
- API endpoints for each validation step

---

### Phase SaaS: Multi-Tenant Transformation ✅ COMPLETE

**Goal**: Transform single-tenant VillaBot into multi-tenant Cluebase AI SaaS platform

**Status**: Fully implemented across 8 sub-phases

| Sub-Phase | Description | Status |
|-----------|-------------|--------|
| 1. Database Foundation | Workspaces, user profiles, RLS policies | ✅ |
| 2. Authentication | Supabase Auth with email/password, JWT verification | ✅ |
| 3. API Routes | All routes updated with workspace filtering | ✅ |
| 4. Services | All services updated with workspace context | ✅ |
| 5. Billing | Stripe integration with checkout, webhooks | ✅ |
| 6. Dashboard Contexts | AuthContext, WorkspaceContext, protected routes | ✅ |
| 7. Dashboard Pages | Auth pages, billing, team management | ✅ |
| 8. Branding | Cluebase AI branding throughout | ✅ |

---

### Phase Landing: Public Landing Page ✅ COMPLETE

**Goal**: Create a marketing landing page for Cluebase AI

**Status**: Fully implemented at `/` (root route)

#### Route Structure

| Route | Purpose | Auth Required |
|-------|---------|---------------|
| `/` | Public landing page (marketing) | No |
| `/dashboard` | Authenticated dashboard overview | Yes |
| `/auth/signin` | Sign in page | No |
| `/auth/signup` | Sign up page | No |
| `/setup` | Initial setup wizard | No |

#### Landing Page Sections (All Complete)

- ✅ Navigation with logo and auth CTAs
- ✅ Hero section with animated stats and Slack demo mockup
- ✅ Trust section with company logos
- ✅ Features bento grid (6 cards)
- ✅ How It Works (3 steps)
- ✅ Pricing section with monthly/annual toggle (20% annual discount)
- ✅ Testimonials (3 quotes)
- ✅ Final CTA section
- ✅ Footer with links

#### Pricing Tiers

| Tier | Monthly | Annual | Features |
|------|---------|--------|----------|
| Starter | $29 | $279 | 1 bot, 100 docs, 1K queries |
| Pro | $79 | $759 | 3 bots, 500 docs, 10K queries |
| Business | $199 | $1,910 | Unlimited bots/docs/queries |

---

### Phase 1: Document Categorization (Completed ✅)
- [x] Create database migration for categories
- [x] Update `hybrid_search` function with category filtering
- [x] Modify sync process to assign categories
- [x] Implement category-aware source attribution

### Phase 2: Website Scraping Improvements (Completed ✅)
- [x] Remove 50-page hard limit (now configurable, default 500)
- [x] Add configurable scraping options
- [x] Implement rate limiting and robots.txt support
- [ ] Add progress tracking UI
- [ ] Category assignment for scraped pages

### Phase 3: Multi-Bot Foundation ✅ COMPLETE

**Backend (Complete):**
- [x] Create `bots`, `bot_channels`, `bot_drive_folders` tables (`006_multi_bot_platform.sql`)
- [x] Bot types and interfaces (`packages/shared/src/types/bots.ts`)
- [x] Bot CRUD service (`apps/api/src/services/bots/index.ts`)
- [x] Bot API routes (`apps/api/src/routes/bots.ts`)
- [x] Multi-bot Slack instance class (`apps/api/src/services/slack/instance.ts`)
- [x] Bot lifecycle manager (`apps/api/src/services/slack/manager.ts`)
- [x] Updated `hybrid_search` with bot filtering

**Dashboard (Complete):**
- [x] Bot management page (`/bots`) with stats overview
- [x] Bot creation/edit modal with form validation (`bot-form-modal.tsx`)
- [x] Bot status indicators (active/inactive/error)
- [x] Bot activation/deactivation toggle switch
- [x] Search functionality for bots
- [x] Update sidebar with Bots navigation link

### Phase 3.5: Folder-to-Bot Architecture Fix ✅ COMPLETE (December 2024)

**Problem Fixed:**
The Google Drive sync was ignoring the `bot_drive_folders` table and syncing from a single hardcoded environment folder. Each bot should sync only from its assigned folders.

**Changes Made:**

**Database Migration (`016_document_tags.sql`):**
- [x] Added `tags TEXT[]` column to documents for custom user tags
- [x] Added `drive_folder_id VARCHAR` column to track source folder
- [x] GIN index on tags for efficient filtering
- [x] Deprecated old `category` column (use tags instead)

**Google Drive Sync (`apps/api/src/services/google-drive/sync.ts`):**
- [x] `fullSync()` now queries `bot_drive_folders` when botId provided
- [x] Syncs each folder assigned to the bot individually
- [x] Stores `drive_folder_id` on each document for tracking
- [x] Filters changes to only include files in bot's assigned folders
- [x] Workspace-wide sync gets all folders from all bots

**Google Drive Client (`apps/api/src/services/google-drive/client.ts`):**
- [x] Added `parents?: string[]` to DriveFile interface
- [x] `listChanges()` returns parent folder IDs for filtering

**Bot Setup Wizard (`apps/dashboard/src/components/bot-setup-wizard.tsx`):**
- [x] 4-step wizard: Basic Info → Slack → Folders → Confirm
- [x] Slack credential testing before proceeding
- [x] Add/remove folders with ID extraction from URLs
- [x] Summary view before creating bot

**Backend API (`apps/api/src/routes/bots.ts`):**
- [x] `POST /api/bots/test-slack` - Validate Slack credentials
- [x] `POST /api/bots/:id/sync` - Trigger sync for specific bot

**Document Tags API (`apps/api/src/routes/documents.ts`):**
- [x] `GET /api/documents/tags` - Get unique tags for autocomplete
- [x] `PATCH /api/documents/:id/tags` - Update document tags
- [x] Added `bot_id` filter support to document list

**Playwright E2E Tests (`apps/dashboard/e2e/`):**
- [x] `auth.spec.ts` - Authentication flow tests
- [x] `billing.spec.ts` - Billing page tests
- [x] `bots.spec.ts` - Bot management and wizard tests
- [x] `playwright.config.ts` - Playwright configuration

### Phase 4: Feedback System ✅ COMPLETE

**Backend (Complete):**
- [x] Create `response_feedback` table (`007_feedback_system.sql`)
- [x] Feedback types and interfaces (`packages/shared/src/types/feedback.ts`)
- [x] Feedback API routes with analytics (`apps/api/src/routes/feedback.ts`)
- [x] Feedback buttons in Slack responses (`bot.ts`)
- [x] `get_satisfaction_rate()` database function
- [x] `feedback_stats` view for analytics

**Dashboard (Complete):**
- [x] Feedback review page (`/feedback`) with full UI
- [x] Stats overview (satisfaction rate, total, helpful, unhelpful)
- [x] Filter buttons (all/helpful/unhelpful/unreviewed)
- [x] Feedback list with query/response context
- [x] Mark as reviewed functionality
- [x] Pagination support
- [x] Update sidebar with Feedback navigation link

### Phase 5: Integration & Polish ✅ MOSTLY COMPLETE

- [x] Register `botsRouter` and `feedbackRouter` in main app
- [x] Migrate main app to use `BotManager` instead of legacy single-bot
- [x] Update dashboard sidebar with all new navigation items
- [x] Add Geist font throughout dashboard
- [x] Implement consistent modal system for all forms
- [x] Add loading states and skeleton loaders
- [ ] Error boundaries and toast notifications
- [ ] Mobile-responsive improvements

### Phase 6: Multi-Bot Deployment ✅ COMPLETE

**Bot Management (Complete):**
- [x] Multi-socket Slack connections via BotManager
- [x] Bot-specific system prompts in RAG pipeline
- [x] Per-bot analytics tracking (bot_id in all events)
- [x] Bot creation wizard in dashboard (modal-based: `bot-form-modal.tsx`)
- [x] Bot health monitoring with auto-restart (`manager.ts`)
- [x] Health status API endpoints (`/api/bots/health/status`, `/api/bots/:id/health`)
- [x] Manual restart endpoint (`/api/bots/:id/restart`)
- [x] Health history tracking (`bot_health`, `bot_health_history` tables)

**Bot Health Monitoring:**
- Health checks every 30 seconds
- Auto-restart after 3 consecutive failures
- 60-second cooldown between restart attempts
- Error state tracking in database
- Health status dashboard view

---

### Phase Admin: Platform Admin Panel ✅ COMPLETE

**Goal**: Enable platform operators to manage workspaces, users, and create internal/test accounts that bypass billing

**Backend (Complete):**
- [x] Database migration for admin features (`014_platform_admin.sql`)
  - `is_platform_admin` column on user_profiles
  - `is_internal`, `internal_notes`, `created_by_admin` on workspaces
  - `platform_stats` view for aggregate statistics
  - `admin_workspace_details` view
  - `create_internal_workspace()` function with unlimited limits
  - `admin_audit_log` table
- [x] Admin API routes (`/api/admin/*`)
  - GET `/api/admin/stats` - Platform-wide statistics
  - GET `/api/admin/workspaces` - List all workspaces with filters
  - GET `/api/admin/workspaces/:id` - Workspace details
  - POST `/api/admin/workspaces/internal` - Create internal workspace
  - PATCH `/api/admin/workspaces/:id` - Update workspace
  - GET `/api/admin/growth` - Growth metrics over time
- [x] Rate limiting middleware with workspace/tier awareness
  - Per-workspace rate limits based on tier
  - Internal workspaces bypass all rate limits
  - Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
- [x] Error tracking utility (`errorTracker.ts`)

**Dashboard (Complete):**
- [x] Admin layout with dedicated sidebar (`/admin/layout.tsx`)
- [x] Admin overview page with platform stats (`/admin/page.tsx`)
  - Total workspaces, users, estimated MRR, bots
  - Tier breakdown (Starter/Pro/Business)
  - Growth chart (30-day trend)
  - Recent workspaces list
- [x] Workspaces management page (`/admin/workspaces/page.tsx`)
  - Search, tier/status/internal filters
  - Paginated table with workspace details
  - Link to workspace detail page
- [x] Workspace detail page (`/admin/workspaces/[id]/page.tsx`)
  - Stats (members, documents, bots, queries)
  - Team members list
  - Bots list
  - Edit capabilities
- [x] Create internal workspace modal (`create-internal-modal.tsx`)
  - Form for name/email/notes
  - Creates workspace with unlimited limits
  - No billing required

**Internal/Test Accounts:**
- Internal workspaces bypass billing completely
- Unlimited documents, queries, members, bots
- Rate limits disabled for internal workspaces
- Clearly marked in admin panel with purple indicator

---

### Phase Setup: Setup Wizard Redesign ✅ COMPLETE

**Goal**: Redesign the setup wizard for SaaS model (remove infrastructure config)

**Changes:**
- Removed Supabase URL/Service Key configuration (platform-managed)
- Removed Gemini API key configuration (platform-managed)
- Streamlined to focus on:
  - Slack app credentials
  - Google Drive OAuth
  - Knowledge source selection
  - First bot configuration
- Improved UI with premium design system

---

### Phase 7: Advanced Features (Future)

- [ ] Auto-categorization using AI
- [ ] Cross-bot conversation handoff
- [ ] Custom category definitions
- [ ] API for external integrations
- [ ] Webhook support for external events

---

## Category Assignment Rules

### Automatic Assignment

| Source | Default Category | Override Conditions |
|--------|-----------------|---------------------|
| Website scrape | `company_knowledge` | Configurable per scrape |
| Google Drive root | `company_knowledge` | Based on folder mapping |
| "SOPs" folder | `internal_sops` | Folder name contains "SOP" |
| "Marketing" folder | `marketing` | Folder name match |
| "Sales" folder | `sales` | Folder name match |
| "HR" folder | `hr_policies` | Folder name match |

### Folder → Category Mapping (Configurable)

```typescript
// Example configuration in dashboard
const folderCategoryMap = {
  '1ABC123_sops_folder_id': 'internal_sops',
  '1DEF456_marketing_folder_id': 'marketing',
  '1GHI789_sales_folder_id': 'sales',
};
```

---

## Questions for Implementation

1. **Sub-categories**: Do you need deeper categorization? (e.g., SOPs → Check-in SOPs, Checkout SOPs)

2. **Auto-categorization**: Should we use AI to automatically categorize documents based on content analysis?

3. **Bot Deployment Model**:
   - Option A: All bots in one container (simpler)
   - Option B: Separate containers per bot (better isolation)

4. **Slack Workspace Strategy**:
   - Option A: Same workspace, different channels per bot
   - Option B: Different Slack apps per bot (separate tokens)

5. **Category Access Control**: Should some categories require additional authentication beyond Slack membership?

---

*Cluebase AI Enhancement Plan v2.0 - Last Updated: December 2024*
