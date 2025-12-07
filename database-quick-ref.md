# Database Quick Reference

## Start Commands

```pwsh
# First time setup
npm install
npx tsx server/seedCategories.ts
npx tsx server/seedRAG.ts  # Optional: seed sample RAG docs

# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend  
npm run dev
```

## File Locations

- **Database**: `data/grokchat.db`
- **LanceDB**: `data/lancedb/`
- **Schema**: `server/db.ts`
- **API**: `server/index.ts`
- **Seed**: `server/seedCategories.ts`

## Key API Endpoints

```bash
# Health check
GET /api/health

# Chat (persists user message)
POST /api/chat
{
  "userId": "demo-user",
  "messages": [{"role": "user", "content": "..."}],
  "tags": ["launch-readiness"]
}

# Save assistant response
POST /api/chat/response
{
  "sessionId": "session-...",
  "content": "...",
  "tags": ["launch-readiness"]
}

# Get categories
GET /api/categories

# Get messages
GET /api/messages/:sessionId?limit=100
```

## Schema Quick View

**sessions** → `id`, `user_id`, `created_at`, `updated_at`  
**messages** → `id`, `session_id`, `role`, `content`, `timestamp`, `tags`  
**categories** → `id`, `title`, `icon`, `accent`, `sort_order`  
**category_items** → `id`, `category_id`, `title`, `description`, `emphasis`, `updated_at`, `sort_order`

## Environment Variables

**`.env.local`** (frontend):

```env
VITE_GROK_API_KEY=your-key-here
```

**`.env`** (backend):

```env
MEM0_API_KEY=your-key-here
MEM0_API_VERSION=2024-04-01
PORT=8787
```

## Common Tasks

**Reset database**:

```pwsh
rm data/grokchat.db
npx tsx server/seedCategories.ts
```

**Check what's in the DB** (requires sqlite3 CLI):

```pwsh
sqlite3 data/grokchat.db "SELECT * FROM categories;"
sqlite3 data/grokchat.db "SELECT COUNT(*) FROM messages;"
```

**View server logs**:
Watch the terminal running `npx tsx server/index.ts`

## Troubleshooting

| Issue                  | Solution                                                 |
| ---------------------- | -------------------------------------------------------- |
| Database locked        | Close other connections, ensure single server instance   |
| Missing data directory | Auto-created on first run; check permissions             |
| Categories not loading | Run seed script: `npx tsx server/seedCategories.ts`      |
| 404 on /api/\*         | Ensure backend is running on port 8787                   |
| CORS errors            | Backend has `cors()` enabled; check both servers running |

## Next Steps

See [`implementation-summary.md`](./implementation-summary.md) for frontend integration details and [`database-readme.md`](./database-readme.md) for complete API documentation.
