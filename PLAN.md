# Villa Paraiso Slack AI Assistant Bot

## Project Overview

A comprehensive Slack AI assistant bot for Villa Paraiso Vacation Rentals that:
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
│                              VILLA PARAISO AI BOT                           │
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

-- Document chunks with embeddings
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768), -- Gemini embedding dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
│  • "Is this a question about Villa Paraiso operations?"     │
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

### 4. RAG Pipeline

**Query Flow:**
```
User Question
     │
     ▼
┌─────────────────┐
│ Query Analysis  │ ← Understand intent, extract keywords
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Embed Query     │ ← Convert to vector using Gemini
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Vector Search   │ ← Find top-k relevant chunks in Supabase
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Context Build   │ ← Combine chunks + conversation history + learned facts
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Gemini LLM      │ ← Generate response with context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Response + Cite │ ← Include source documents
└─────────────────┘
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
villa-paraiso-bot/
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

# Website Scraping
COMPANY_WEBSITE_URL=https://villaparaisovacationrentals.com
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
       VillaBot: Based on our SOPs, here's the check-in process:

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
       VillaBot: Pool cleaning is scheduled as follows:
       - Casa Luna: Monday & Thursday, 8 AM
       - Villa Sol: Tuesday & Friday, 9 AM
       - Casa del Mar: Wednesday & Saturday, 8 AM

       📄 Source: Property Maintenance SOP

       ───────────────────────────────

       Carlos: What about Casa Luna specifically if there's a guest checkout?

       VillaBot: Great follow-up! For Casa Luna post-checkout:
       - Emergency pool cleaning within 4 hours of checkout
       - Full chemical balance check
       - Skim and vacuum
       - Contact pool vendor: ABC Pool Services (555-1234)

       This is in addition to the regular Monday/Thursday schedule.

       📄 Source: Property Maintenance SOP, Section 4.2

       ───────────────────────────────

       Carlos: Perfect, thanks!

       VillaBot: You're welcome! Let me know if you have other questions. 😊
```

### Self-Learning Example
```
#operations channel:

Sofia: Actually the check-in time changed to 3 PM, not 4 PM

    └─ Thread:
       VillaBot: Thanks for the update! I've noted that:

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

*This plan was created for Villa Paraiso Vacation Rentals Slack AI Assistant Bot*
