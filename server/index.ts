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
    deleteCategory,
    deleteMessages,
    updateMessageTags,
    toggleCategoryPinned,
    updateCategoryDescription,
    updateCategoryIcon,
    updateCategoryAccent,
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

interface AttachmentMeta {
    name: string;
    size: number;
    type: 'text' | 'image' | 'pdf';
    mimeType?: string;
}

interface ChatRequestBody {
    userId: string;
    messages: ChatMessage[];
    tags: string[];
    attachments?: AttachmentMeta[];
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

    console.log('[Memory Heuristics] Checking message:', lowered);

    // Preference patterns
    if (
        lowered.includes('i prefer') ||
        lowered.includes("i'd like") ||
        lowered.includes('i like') ||
        lowered.includes("don't") ||
        lowered.includes('do not') ||
        lowered.includes('please always') ||
        lowered.includes('please never') ||
        lowered.includes('going forward')
    ) {
        candidateMemories.push({
            text: `User preference: ${latestUser.content}`,
            type: 'preference',
            tags
        });
    }

    // Profile patterns
    if (
        lowered.startsWith('i am ') ||
        lowered.startsWith("i'm ") ||
        lowered.includes('my name is') ||
        lowered.includes('call me ')
    ) {
        candidateMemories.push({
            text: `User profile note: ${latestUser.content}`,
            type: 'profile',
            tags
        });
    }

    // Goal patterns
    if (lowered.includes('working on') || lowered.includes('our goal is')) {
        candidateMemories.push({
            text: `User goal: ${latestUser.content}`,
            type: 'goal',
            tags
        });
    }

    // Explicit memory commands
    if (
        lowered.includes('remember that') ||
        lowered.includes('remember this') ||
        lowered.includes('note that') ||
        lowered.includes('keep in mind')
    ) {
        candidateMemories.push({
            text: `User note: ${latestUser.content}`,
            type: 'history',
            tags
        });
    }

    console.log('[Memory Heuristics] Candidate memories:', candidateMemories.length);

    try {
        // Persist the user message with attachment metadata (not content)
        const attachmentsMeta = body.attachments?.map(a => ({ name: a.name, size: a.size, type: a.type, mimeType: a.mimeType }));
        const userMsgId = insertMessage({
            session_id: sessionId,
            role: 'user',
            content: latestUser.content,
            timestamp: new Date().toISOString(),
            tags: tags.length > 0 ? JSON.stringify(tags) : null,
            attachments: attachmentsMeta ? JSON.stringify(attachmentsMeta) : null
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
            tags: tags?.length > 0 ? JSON.stringify(tags) : null,
            attachments: null
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
            pinned: cat.pinned === 1,
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
    const { id, title, description, icon, accent, sort_order, pinned } = req.body;
    if (!id || !title) {
        return res.status(400).json({ error: 'id and title are required.' });
    }
    try {
        upsertCategory({ id, title, description: description || null, icon: icon || 'Sparkles', accent: accent || 'from-grokPurple to-grokBlue', sort_order: sort_order || 0, pinned: pinned || 0 });
        return res.json({ ok: true });
    } catch (error) {
        console.error('Error upserting category', error);
        return res.status(500).json({ error: 'Failed to upsert category.' });
    }
});

// Toggle category pinned status
app.post('/api/categories/:categoryId/pin', (req, res) => {
    const { categoryId } = req.params;
    try {
        const isPinned = toggleCategoryPinned(categoryId);
        return res.json({ ok: true, pinned: isPinned });
    } catch (error) {
        console.error('Error toggling category pin', error);
        return res.status(500).json({ error: 'Failed to toggle pin.' });
    }
});

// Update category description
app.patch('/api/categories/:categoryId/description', (req, res) => {
    const { categoryId } = req.params;
    const { description } = req.body as { description: string };
    try {
        updateCategoryDescription(categoryId, description ?? '');
        return res.json({ ok: true });
    } catch (error) {
        console.error('Error updating category description', error);
        return res.status(500).json({ error: 'Failed to update description.' });
    }
});

// Update category icon
app.patch('/api/categories/:categoryId/icon', (req, res) => {
    const { categoryId } = req.params;
    const { icon } = req.body as { icon: string };
    try {
        updateCategoryIcon(categoryId, icon ?? 'Sparkles');
        return res.json({ ok: true });
    } catch (error) {
        console.error('Error updating category icon', error);
        return res.status(500).json({ error: 'Failed to update icon.' });
    }
});

// Update category accent/color
app.patch('/api/categories/:categoryId/accent', (req, res) => {
    const { categoryId } = req.params;
    const { accent } = req.body as { accent: string };
    try {
        updateCategoryAccent(categoryId, accent ?? 'from-grokPurple to-grokBlue');
        return res.json({ ok: true });
    } catch (error) {
        console.error('Error updating category accent', error);
        return res.status(500).json({ error: 'Failed to update accent.' });
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

// Delete a category
app.delete('/api/categories/:categoryId', (req, res) => {
    const { categoryId } = req.params;
    try {
        deleteCategory(categoryId);
        return res.json({ ok: true });
    } catch (error) {
        console.error('Error deleting category', error);
        return res.status(500).json({ error: 'Failed to delete category.' });
    }
});

// Delete messages (user/assistant pairs)
app.delete('/api/messages', (req, res) => {
    const { messageIds } = req.body as { messageIds: string[] };
    if (!Array.isArray(messageIds) || !messageIds.length) {
        return res.status(400).json({ error: 'messageIds array is required.' });
    }
    try {
        deleteMessages(messageIds);
        return res.json({ ok: true, deleted: messageIds.length });
    } catch (error) {
        console.error('Error deleting messages', error);
        return res.status(500).json({ error: 'Failed to delete messages.' });
    }
});

// Update message tags (for auto-tagging)
app.patch('/api/messages/:messageId/tags', (req, res) => {
    const { messageId } = req.params;
    const { tags } = req.body as { tags: string[] };
    if (!messageId) {
        return res.status(400).json({ error: 'messageId is required.' });
    }
    try {
        const tagsJson = Array.isArray(tags) && tags.length > 0 ? JSON.stringify(tags) : null;
        updateMessageTags(messageId, tagsJson);
        return res.json({ ok: true, messageId, tags });
    } catch (error) {
        console.error('Error updating message tags', error);
        return res.status(500).json({ error: 'Failed to update message tags.' });
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
