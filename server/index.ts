import 'dotenv/config';
import express from 'express';
import cors from 'cors';
// Use explicit .ts extension for ts-node-esm resolution during dev.
import { saveUserMemories, getRelevantMemories, type MemoryAtom } from './memoryProvider.ts';

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
        await saveUserMemories(userId, candidateMemories);

        const relevant = await getRelevantMemories(userId, latestUser.content, tags);

        return res.json({
            usedMemories: relevant
        });
    } catch (error) {
        console.error('Error in /api/chat', error);
        return res.status(500).json({ error: 'Failed to process chat request.' });
    }
});

app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
});
