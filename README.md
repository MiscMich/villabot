# Villa Paraiso Slack AI Assistant

An intelligent Slack bot for Villa Paraiso Vacation Rentals that answers team questions using company SOPs, documentation, and website content.

## Features

- **RAG-Powered Responses**: Uses Retrieval Augmented Generation to provide accurate, contextual answers
- **Google Drive Integration**: Automatically syncs SOPs and documentation (DOCX, PDF, Google Docs, Sheets)
- **Self-Learning**: Learns from user corrections and feedback
- **Auto-Updates**: Polls Google Drive for changes and updates knowledge base automatically
- **Website Scraping**: Weekly extraction of company website content
- **Admin Dashboard**: Monitor bot performance, manage knowledge base, and configure settings

## Tech Stack

| Component | Technology |
|-----------|------------|
| AI/LLM | Google Gemini API |
| Vector Database | Supabase (pgvector) |
| Document Source | Google Drive API |
| Chat Interface | Slack Bolt SDK |
| Backend | Node.js/TypeScript |
| Dashboard | Next.js / React |
| Web Scraping | Puppeteer / Cheerio |

## Project Structure

```
villa-paraiso-bot/
├── apps/
│   ├── api/           # Backend API server
│   └── dashboard/     # Admin dashboard (Next.js)
├── packages/
│   └── shared/        # Shared types and constants
├── supabase/
│   └── migrations/    # Database migrations
└── PLAN.md            # Full implementation plan
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Supabase account
- Google Cloud project with Drive API enabled
- Slack workspace with admin access
- Gemini API key

### Installation

1. **Clone and install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Run database migrations:**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Run the contents of `supabase/migrations/001_initial_schema.sql`

4. **Start the development server:**
   ```bash
   pnpm dev
   ```

5. **Verify it's working:**
   ```bash
   curl http://localhost:3000/health
   ```

## Documentation

See [PLAN.md](./PLAN.md) for the complete implementation plan including:
- System architecture
- Database schema
- RAG pipeline details
- Implementation phases
- API configurations

## Development

```bash
# Start API server in development mode
pnpm dev

# Start dashboard in development mode
pnpm dev:dashboard

# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Run tests
pnpm test

# Build all packages
pnpm build
```

## License

Proprietary - Villa Paraiso Vacation Rentals
