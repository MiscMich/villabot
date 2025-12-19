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

## Documentation

See [PLAN.md](./PLAN.md) for the complete implementation plan including:
- System architecture
- Database schema
- Project structure
- Implementation phases
- API configurations

## Getting Started

*Coming soon - project is currently in planning phase*

## License

Proprietary - Villa Paraiso Vacation Rentals
