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

-- Conversation history for context
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_channel_id VARCHAR NOT NULL,
  slack_user_id VARCHAR NOT NULL,
  slack_thread_ts VARCHAR,
  message TEXT NOT NULL,
  response TEXT,
  sources JSONB DEFAULT '[]',
  feedback_rating INTEGER, -- 1-5 rating
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

**Features:**
- Listen to messages in configured channels
- Respond to direct mentions (@VillaBot)
- Support threaded conversations for context
- Handle slash commands for special actions
- Provide feedback buttons on responses

**Slash Commands:**
- `/villa help` - Show available commands
- `/villa search [query]` - Direct knowledge base search
- `/villa status` - Show bot status and last sync time
- `/villa learn [fact]` - Teach the bot something new
- `/villa forget [topic]` - Remove learned information

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

**Automatic Updates:**
- Poll Google Drive every 5-15 minutes for changes
- Compare content hashes to detect modifications
- Re-process updated documents automatically
- Remove chunks for deleted documents

**User Teaching:**
- Accept corrections via Slack ("Actually, the check-in time is 3 PM")
- Store learned facts with embeddings
- Include learned facts in RAG context
- Admin verification workflow for learned facts

**Website Scraping:**
- Weekly scheduled crawl of company website
- Extract text content from pages
- Process and embed like documents
- Update knowledge base with changes

### 6. Admin Dashboard

**Pages:**

1. **Overview Dashboard**
   - Bot status (online/offline)
   - Total questions answered today/week/month
   - Response accuracy rating
   - Last sync timestamps
   - Error logs summary

2. **Knowledge Base Management**
   - List of all indexed documents
   - Document status (active/outdated/error)
   - Manual re-sync button
   - Add/remove documents
   - View document chunks

3. **Channel Configuration**
   - Select which Slack channels bot monitors
   - Configure bot behavior per channel
   - Set response style (formal/casual)
   - Enable/disable features per channel

4. **Analytics**
   - Most asked questions
   - Response times
   - User satisfaction ratings
   - Knowledge gaps (questions with no good answer)
   - Usage trends over time

5. **Settings**
   - Google Drive folder configuration
   - Website URLs to scrape
   - Polling intervals
   - Gemini API settings (temperature, etc.)
   - Slack workspace settings

6. **Learned Facts**
   - View all user-taught facts
   - Verify/reject pending facts
   - Edit existing facts
   - See who taught what

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
**Goal:** Deploy bot to Slack channels

**Tasks:**
- [ ] Set up Slack Bolt SDK
- [ ] Configure event subscriptions (app_mention, message)
- [ ] Implement message handlers
- [ ] Add slash commands
- [ ] Build threaded conversation support
- [ ] Add typing indicators
- [ ] Implement feedback buttons (thumbs up/down)
- [ ] Configure channel allowlist
- [ ] Deploy initial bot to workspace

**Deliverable:** Functional Slack bot answering questions in channels

---

### Phase 5: Auto-Sync & Self-Learning
**Goal:** Keep knowledge base automatically updated

**Tasks:**
- [ ] Implement Drive polling scheduler (every 10 minutes)
- [ ] Build change detection using modified timestamps
- [ ] Handle document updates (re-embed changed docs)
- [ ] Handle document deletions (remove from KB)
- [ ] Create learned facts system:
  - [ ] `/villa learn` command
  - [ ] Correction detection in messages
  - [ ] Fact storage with embeddings
  - [ ] Include facts in RAG context
- [ ] Build fact verification workflow

**Deliverable:** Bot that stays current and learns from users

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
- `app_mentions:read` - Receive mentions
- `channels:history` - Read channel messages
- `channels:read` - View channel info
- `chat:write` - Send messages
- `commands` - Slash commands
- `groups:history` - Private channel messages
- `groups:read` - Private channel info
- `im:history` - DM history
- `im:read` - DM info
- `users:read` - User info

**Event Subscriptions:**
- `app_mention` - When bot is mentioned
- `message.channels` - Messages in public channels
- `message.groups` - Messages in private channels

---

## Sample Bot Interaction

```
User: @VillaBot What's the check-in process for guests?

VillaBot: Based on our SOPs, here's the check-in process for guests:

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
• Guest Check-in SOP v2.3 (last updated: Dec 10, 2024)
• Property Manager Guidelines

Was this helpful? 👍 👎
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
