# Database Architecture

## Overview

Grokchat uses **SQLite** (via `better-sqlite3`) for persistent storage of conversations, messages, and context categories (signals). This complements the existing Mem0 (user memories) and LanceDB (RAG knowledge base) layers.

## Storage Responsibilities

### SQLite (`server/db.ts`)

- **Purpose**: App state and history
- **Stores**:
  - User sessions
  - Chat messages (user + assistant)
  - Context categories and their signal items
  - Timestamps, tags, metadata
- **Use cases**: UI state restoration, analytics, user history across page reloads

### Mem0 (`server/memoryProvider.ts`)

- **Purpose**: Semantic, long-term user memories
- **Stores**:
  - User preferences ("I prefer short answers")
  - Profile notes ("I'm a backend engineer on Windows")
  - Goals ("shipping Grokchat for a hackathon")
  - Category summaries (compressed context over many messages)
- **Use cases**: Injected into Grok system prompt for personalized responses

### LanceDB (`server/ragStore.ts`)

- **Purpose**: Knowledge-base retrieval (RAG)
- **Stores**:
  - Product docs, runbooks, incident reports, example playbooks
  - Chunked and embedded for semantic search
- **Use cases**: Pull relevant documentation when user asks domain-specific questions

## Schema

### `sessions`

Tracks individual user sessions (currently single static user).

| Column     | Type    | Description                              |
| ---------- | ------- | ---------------------------------------- |
| id         | TEXT PK | Unique session ID                        |
| user_id    | TEXT    | User identifier (e.g., "demo-user")      |
| created_at | INTEGER | Unix timestamp (ms)                      |
| updated_at | INTEGER | Unix timestamp (ms), updated on activity |

### `messages`

Stores all chat messages for each session.

| Column     | Type    | Description                                   |
| ---------- | ------- | --------------------------------------------- |
| id         | TEXT PK | Unique message ID                             |
| session_id | TEXT FK | References `sessions.id`                      |
| role       | TEXT    | `system`, `user`, or `assistant`              |
| content    | TEXT    | Message text                                  |
| timestamp  | TEXT    | ISO 8601 timestamp                            |
| tags       | TEXT    | JSON-encoded array of category IDs (nullable) |

### `categories`

Context categories displayed in the sidebar (e.g., "Launch Readiness", "Incident Digest").

| Column     | Type    | Description                           |
| ---------- | ------- | ------------------------------------- |
| id         | TEXT PK | Unique category ID                    |
| title      | TEXT    | Display name                          |
| icon       | TEXT    | Icon name (Lucide icon string)        |
| accent     | TEXT    | Tailwind gradient classes for styling |
| sort_order | INTEGER | Display order (ascending)             |

### `category_items`

Individual signal items within each category.

| Column      | Type    | Description                                   |
| ----------- | ------- | --------------------------------------------- |
| id          | TEXT PK | Unique item ID                                |
| category_id | TEXT FK | References `categories.id` (cascade delete)   |
| title       | TEXT    | Signal headline                               |
| description | TEXT    | Signal detail (nullable)                      |
| emphasis    | INTEGER | `1` for emphasized/highlighted, `0` otherwise |
| updated_at  | TEXT    | ISO 8601 timestamp (nullable)                 |
| sort_order  | INTEGER | Display order within category                 |

## API Endpoints

### Chat & Messages

**`POST /api/chat`**  
Process a user message: extract memories, retrieve from Mem0/LanceDB, persist to DB.

**Request**:

```json
{
  "userId": "demo-user",
  "messages": [{ "role": "user", "content": "What's our deployment status?" }],
  "tags": ["launch-readiness"]
}
```

**Response**:

```json
{
  "usedMemories": [ { "text": "...", "type": "preference", "tags": [...] } ],
  "ragDocs": [ { "text": "...", "metadata": {...} } ],
  "sessionId": "session-...",
  "userMsgId": "msg-..."
}
```

**`POST /api/chat/response`**  
Persist assistant's response after Grok generates it.

**Request**:

```json
{
  "sessionId": "session-...",
  "content": "Deployment is at 98.6% health...",
  "tags": ["launch-readiness"]
}
```

**Response**:

```json
{
  "msgId": "msg-..."
}
```

**`GET /api/messages/:sessionId?limit=100`**  
Fetch recent messages for a session.

**Response**:

```json
{
  "messages": [
    {
      "id": "msg-...",
      "session_id": "session-...",
      "role": "user",
      "content": "...",
      "timestamp": "2025-12-07T12:00:00.000Z",
      "tags": "[\"launch-readiness\"]"
    }
  ]
}
```

### Categories & Signals

**`GET /api/categories`**  
Fetch all categories with their items.

**Response**:

```json
{
  "categories": [
    {
      "id": "launch-readiness",
      "title": "Launch Readiness",
      "icon": "Rocket",
      "accent": "from-grokPurple via-grokPink to-grokBlue",
      "sort_order": 0,
      "items": [
        {
          "id": "lr-1",
          "category_id": "launch-readiness",
          "title": "Telemetry looks nominal",
          "description": "Latest staging checks passed with 98.6% health.",
          "emphasis": 1,
          "updated_at": "2m ago",
          "sort_order": 0
        }
      ]
    }
  ]
}
```

**`POST /api/categories`**  
Create or update a category.

**Request**:

```json
{
  "id": "new-category",
  "title": "New Category",
  "icon": "Sparkles",
  "accent": "from-grokPurple to-grokBlue",
  "sort_order": 5
}
```

**`POST /api/categories/:categoryId/items`**  
Create or update a category item.

**Request**:

```json
{
  "id": "item-1",
  "title": "New signal",
  "description": "Details...",
  "emphasis": 0,
  "updated_at": "5m ago",
  "sort_order": 0
}
```

**`DELETE /api/categories/:categoryId/items/:itemId`**  
Delete a category item.

## Database File Location

- **Path**: `data/grokchat.db`
- **Mode**: WAL (Write-Ahead Logging) for better concurrency
- Created automatically on first run

## Migration Path

Currently using **SQLite** for simplicity and local dev. To migrate to **PostgreSQL** later:

1. Install `pg` driver: `npm install pg`
2. Replace `better-sqlite3` calls with `pg` equivalents
3. Update schema creation to use Postgres DDL
4. Set `DATABASE_URL` env var instead of file path
5. Keep the same table structure and API signatures

No frontend changes needed—just swap the DB driver in `server/db.ts`.

## Usage Examples

### Seeding Initial Categories

See `server/seedCategories.ts` for a script to populate initial categories from the hardcoded `App.tsx` data.

Run with:

```bash
npx tsx server/seedCategories.ts
```

### Fetching History on App Load

In `App.tsx`, call `/api/categories` on mount to load persisted categories instead of using hardcoded data:

```typescript
useEffect(() => {
  fetch("/api/categories")
    .then((res) => res.json())
    .then((data) => setCategories(data.categories));
}, []);
```

### Persisting Assistant Responses

After calling Grok and getting a response, persist it:

```typescript
const assistantText = await createChatCompletion(...);
await fetch('/api/chat/response', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId,
    content: assistantText,
    tags: resolvedTags
  })
});
```

## Next Steps

- Wire `App.tsx` to load categories from `/api/categories` instead of hardcoded data
- Call `/api/chat/response` after Grok generates a reply
- Optionally add `/api/messages/:sessionId` to restore history on page reload
- Create a seed script to populate initial categories if DB is empty
- Add user authentication and per-user sessions when ready

## Troubleshooting

**"Database is locked"**

- WAL mode is enabled by default to reduce lock contention
- Ensure only one server instance is running
- Check file permissions on `data/grokchat.db`

**Missing data directory**

- `server/db.ts` auto-creates `data/` on first run
- Ensure write permissions in project root

**Schema changes**

- For now, manually drop tables or delete `data/grokchat.db` to reset
- Later: add migration scripts (e.g., with `node-migrate` or similar)
