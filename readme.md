## Grok Chat Front-End

This project hosts the front-end experience for the Grok chat interface. The UI mirrors the AI Trainer page from the Open Workout System while adopting the dark, atmospheric aesthetic from grok.com. The interface centers on a single threaded conversation that continuously tags and surfaces relevant context signals.

### Key Traits

- React + Vite + Tailwind stack running in Node.js
- Node/Express backend with SQLite for persistent chat history and signals
- Mem0 integration for long-term user memories (preferences, profile, goals)
- LanceDB for RAG-based knowledge retrieval
- Collapsible sidebar styled after the Open Workout System AI Trainer, showing context categories and recent threads
- Chat surface tuned for dark mode with Grok-inspired gradients, quick prompts, and typing indicators

### Architecture

- **Frontend**: React + Vite + Tailwind (`src/`)
- **Backend**: Express API server (`server/`)
  - `server/db.ts` - SQLite persistence (chat history, categories, signals)
  - `server/memoryProvider.ts` - Mem0 integration (user memories)
  - `server/ragStore.ts` - LanceDB integration (knowledge base RAG)
- **Data Storage**:
  - `data/grokchat.db` - SQLite database
  - `data/lancedb/` - LanceDB vector store
  - Mem0 cloud service (API key required)

See [`database-readme.md`](./database-readme.md) for detailed database schema and API documentation.

### Getting Started

```pwsh
cd grokchat
npm install

# Seed the database with initial categories
npx tsx server/seedCategories.ts

# Start the backend API server (default port 8787)
# In one terminal:
npx tsx server/index.ts

# Start the Vite dev server (port 5173)
# In another terminal:
npm run dev
```

The frontend opens on `http://localhost:5173` and connects to the API server at `http://localhost:8787`.

### Configure API Keys

1. **Frontend (Grok API)**: Copy `.env.example` to `.env.local` and add your xAI key:

   ```pwsh
   cp .env.example .env.local
   notepad .env.local
   ```

   Set `VITE_GROK_API_KEY` to your Grok API key. Optionally adjust `VITE_GROK_API_MODEL` or `VITE_GROK_API_BASE_URL`.

2. **Backend (Mem0)**: Create or edit `.env` in the project root:

   ```pwsh
   notepad .env
   ```

   Set:

   ```env
   MEM0_API_KEY=your-mem0-api-key-here
   MEM0_API_VERSION=2024-04-01
   PORT=8787
   ```

3. Restart both servers after editing environment variables.

> ⚠️ For production, proxy Grok traffic through the backend instead of exposing keys in the browser. Current setup is for local prototyping.
