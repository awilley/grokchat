import Mem0 from 'mem0ai';

export type MemoryType = 'preference' | 'profile' | 'goal' | 'history' | 'category_summary';

export interface MemoryAtom {
    text: string;
    type: MemoryType;
    tags: string[];
}

const MEM0_API_KEY = process.env.MEM0_API_KEY;

if (!MEM0_API_KEY) {
    // In dev we just log; in prod you may want to throw.
    console.warn('MEM0_API_KEY is not set; memory provider will be a no-op.');
}

type Mem0Message = { role: 'user' | 'assistant'; content: string };

type Mem0AddOptions = {
    user_id: string;
    metadata?: Record<string, unknown>;
    api_version?: string;
};

type Mem0Client = {
    add: (messages: Mem0Message[], options: Mem0AddOptions) => Promise<unknown>;
    search: (query: string, options: Record<string, unknown>) => Promise<{ results?: unknown[] }>;
};

const mem0: Mem0Client | null = MEM0_API_KEY ? (new Mem0({ apiKey: MEM0_API_KEY }) as unknown as Mem0Client) : null;
const mem0Options = {
    api_version: process.env.MEM0_API_VERSION ?? '2024-04-01'
};

export async function saveUserMemories(userId: string, memories: MemoryAtom[]): Promise<void> {
    if (!mem0) {
        console.log('[Mem0] saveUserMemories skipped: mem0 client not initialized (missing API key?)');
        return;
    }
    if (!memories.length) {
        console.log('[Mem0] saveUserMemories skipped: no memories to save');
        return;
    }

    console.log('[Mem0] saveUserMemories', { userId, count: memories.length, memories });

    try {
        const results = await Promise.all(
            memories.map(async memory => {
                // Mem0 expects an array of messages as the first arg, and options (including user_id) as the second
                const messages: Mem0Message[] = [{ role: 'user', content: memory.text }];
                const options: Mem0AddOptions = {
                    user_id: userId,
                    metadata: {
                        type: memory.type,
                        tags: memory.tags
                    },
                    ...mem0Options
                };
                console.log('[Mem0] Calling mem0.add with messages:', JSON.stringify(messages), 'options:', JSON.stringify(options));
                const result = await mem0.add(messages, options);
                console.log('[Mem0] mem0.add result:', JSON.stringify(result));
                return result;
            })
        );
        console.log('[Mem0] All memories saved successfully:', results.length);
    } catch (error) {
        console.error('[Mem0] add failed', error);
    }
}

export async function getRelevantMemories(userId: string, query: string, tags: string[]): Promise<MemoryAtom[]> {
    if (!mem0) {
        console.log('[Mem0] getRelevantMemories skipped: mem0 not configured');
        return [];
    }

    console.log('[Mem0] getRelevantMemories', { userId, query, tags });

    try {
        // Mem0 v2 search API: query + options with filters containing user_id
        const searchOptions = {
            version: 'v2',
            filters: {
                user_id: userId
            },
            limit: 10,
            ...mem0Options
        };
        console.log('[Mem0] Calling mem0.search with query:', query, 'options:', JSON.stringify(searchOptions));

        const response = await (mem0 as any).search(query, searchOptions);
        console.log('[Mem0] search response:', JSON.stringify(response));

        // v2 API returns array directly, each item has 'memory' field not 'text'
        const items = Array.isArray(response) ? response : (Array.isArray(response?.results) ? response.results : []);

        interface Mem0SearchItem {
            id?: string;
            memory?: string;
            text?: string; // fallback for older API
            metadata?: Record<string, unknown> | null;
            categories?: string[];
        }

        return (items as Mem0SearchItem[])
            .map(item => {
                const text = item.memory ?? item.text ?? '';
                const metadata = (item.metadata || {}) as { type?: MemoryType; tags?: string[] };
                const type: MemoryType = metadata.type ?? 'history';
                const memTags = metadata.tags ?? item.categories ?? [];

                return {
                    text,
                    type,
                    tags: memTags
                } satisfies MemoryAtom;
            })
            .filter(memory => {
                // Don't filter by tags for now - return all memories for the user
                return memory.text.length > 0;
            });
    } catch (error) {
        console.error('[Mem0] search failed', error);
        return [];
    }
}
