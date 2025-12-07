import 'dotenv/config';
import express from 'express';
import cors from 'cors';
// Use explicit .ts extension for ts-node-esm resolution during dev.
import { saveUserMemories, getRelevantMemories, type MemoryAtom } from './memoryProvider.ts';
import { searchRelevantDocs } from './ragStore.ts';
import {
    getOrCreateSession,
    insertMessage,
    getRecentMessages,
    getAllCategories,
    getCategoryItems,
    upsertCategory,
    upsertCategoryItem,
    deleteCategoryItem,
    type DBMessage
} from './db.ts';

const app = express();
const port = process.env.PORT || 8787;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ChatRequestBody {
    userId: string;
    messages: ChatMessage[];
    tags: string[];
}

app.post('/api/chat', async (req, res) => {
    const body = req.body as ChatRequestBody;
    const { userId, messages, tags } = body;

    if (!userId || !Array.isArray(messages) || !messages.length) {
        return res.status(400).json({ error: 'userId and messages are required.' });
    }

    const latestUser = [...messages].reverse().find(m => m.role === 'user');
    if (!latestUser) {
        return res.status(400).json({ error: 'At least one user message is required.' });
    }

    // Get or create session for this user
    const sessionId = getOrCreateSession(userId);

    const candidateMemories: MemoryAtom[] = [];
    const lowered = latestUser.content.toLowerCase();

    if (lowered.includes('i prefer') || lowered.includes("i'd like") || lowered.includes('i like')) {
        candidateMemories.push({
            text: `User preference: ${latestUser.content}`,
            type: 'preference',
            tags
        });
    }

    if (lowered.startsWith("i am ") || lowered.startsWith("i'm ")) {
        candidateMemories.push({
            text: `User profile note: ${latestUser.content}`,
            type: 'profile',
            tags
        });
    }

    if (lowered.includes('working on') || lowered.includes('our goal is')) {
        candidateMemories.push({
            text: `User goal: ${latestUser.content}`,
            type: 'goal',
            tags
        });
    }

    try {
        // Persist the user message
        const userMsgId = insertMessage({
            session_id: sessionId,
            role: 'user',
            content: latestUser.content,
            timestamp: new Date().toISOString(),
            tags: tags.length > 0 ? JSON.stringify(tags) : null
        });

        await saveUserMemories(userId, candidateMemories);

        const relevant = await getRelevantMemories(userId, latestUser.content, tags);

        const namespace = tags[0] ?? 'default';
        const ragDocs = await searchRelevantDocs(namespace, latestUser.content, 5);

        return res.json({
            usedMemories: relevant,
            ragDocs,
            sessionId,
            userMsgId
        });
    } catch (error) {
        console.error('Error in /api/chat', error);
        return res.status(500).json({ error: 'Failed to process chat request.' });
    }
});

// Persist assistant response
app.post('/api/chat/response', async (req, res) => {
    const { sessionId, content, tags } = req.body as { sessionId: string; content: string; tags: string[] };
    if (!sessionId || !content) {
        return res.status(400).json({ error: 'sessionId and content are required.' });
    }

    try {
        const msgId = insertMessage({
            session_id: sessionId,
            role: 'assistant',
            content,
            timestamp: new Date().toISOString(),
            tags: tags?.length > 0 ? JSON.stringify(tags) : null
        });
        return res.json({ msgId });
    } catch (error) {
        console.error('Error saving assistant response', error);
        return res.status(500).json({ error: 'Failed to save response.' });
    }
});

// Get recent messages for a session
app.get('/api/messages/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    try {
        const messages = getRecentMessages(sessionId, limit);
        return res.json({ messages });
    } catch (error) {
        console.error('Error fetching messages', error);
        return res.status(500).json({ error: 'Failed to fetch messages.' });
    }
});

// Get all categories with their items
app.get('/api/categories', (_req, res) => {
    try {
        const categories = getAllCategories();
        const result = categories.map(cat => ({
            ...cat,
            items: getCategoryItems(cat.id)
        }));
        return res.json({ categories: result });
    } catch (error) {
        console.error('Error fetching categories', error);
        return res.status(500).json({ error: 'Failed to fetch categories.' });
    }
});

// Upsert a category
app.post('/api/categories', (req, res) => {
    const { id, title, icon, accent, sort_order } = req.body;
    if (!id || !title) {
        return res.status(400).json({ error: 'id and title are required.' });
    }
    try {
        upsertCategory({ id, title, icon: icon || 'Sparkles', accent: accent || 'from-grokPurple to-grokBlue', sort_order: sort_order || 0 });
        return res.json({ ok: true });
    } catch (error) {
        console.error('Error upserting category', error);
        return res.status(500).json({ error: 'Failed to upsert category.' });
    }
});

// Upsert a category item
app.post('/api/categories/:categoryId/items', (req, res) => {
    const { categoryId } = req.params;
    const { id, title, description, emphasis, updated_at, sort_order } = req.body;
    if (!id || !title) {
        return res.status(400).json({ error: 'id and title are required.' });
    }
    try {
        upsertCategoryItem({
            id,
            category_id: categoryId,
            title,
            description: description || null,
            emphasis: emphasis || 0,
            updated_at: updated_at || null,
            sort_order: sort_order || 0
        });
        return res.json({ ok: true });
    } catch (error) {
        console.error('Error upserting category item', error);
        return res.status(500).json({ error: 'Failed to upsert category item.' });
    }
});

// Delete a category item
app.delete('/api/categories/:categoryId/items/:itemId', (req, res) => {
    const { itemId } = req.params;
    try {
        deleteCategoryItem(itemId);
        return res.json({ ok: true });
    } catch (error) {
        console.error('Error deleting category item', error);
        return res.status(500).json({ error: 'Failed to delete category item.' });
    }
});

// Ingest documents into RAG knowledge base
import { upsertDocuments } from './ragStore.ts';

app.post('/api/rag/ingest', async (req, res) => {
    const { namespace, documents } = req.body as { namespace: string; documents: { text: string; metadata?: Record<string, unknown> }[] };
    if (!namespace || !Array.isArray(documents)) {
        return res.status(400).json({ error: 'namespace and documents array are required.' });
    }
    try {
        await upsertDocuments(namespace, documents);
        return res.json({ ok: true, count: documents.length });
    } catch (error) {
        console.error('Error ingesting documents', error);
        return res.status(500).json({ error: 'Failed to ingest documents.' });
    }
});

app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
});
