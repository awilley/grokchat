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

type Mem0Client = {
    add: (params: { user_id: string; text: string; metadata?: { type?: MemoryType; tags?: string[] } }, options?: Record<string, unknown>) => Promise<unknown>;
    search: (query: string, options: Record<string, unknown>) => Promise<{ results?: unknown[] }>;
};

const mem0: Mem0Client | null = MEM0_API_KEY ? (new Mem0({ apiKey: MEM0_API_KEY }) as unknown as Mem0Client) : null;
const mem0Options = {
    api_version: process.env.MEM0_API_VERSION ?? '2024-04-01'
};

export async function saveUserMemories(userId: string, memories: MemoryAtom[]): Promise<void> {
    if (!mem0 || !memories.length) return;

    console.log('[Mem0] saveUserMemories', { userId, count: memories.length });

    try {
        await Promise.all(
            memories.map(memory =>
                mem0.add({
                    user_id: userId,
                    text: memory.text,
                    metadata: {
                        type: memory.type,
                        tags: memory.tags
                    }
                }, mem0Options)
            )
        );
    } catch (error) {
        console.warn('[Mem0] add failed', error);
    }
}

export async function getRelevantMemories(userId: string, query: string, tags: string[]): Promise<MemoryAtom[]> {
    if (!mem0) {
        console.log('[Mem0] getRelevantMemories skipped: mem0 not configured');
        return [];
    }

    console.log('[Mem0] getRelevantMemories', { userId, query, tags });

    try {
        // Some versions of the SDK expect query as first arg; pass user_id/limit in options.
        const response = await (mem0 as any).search(
            query,
            {
                user_id: userId,
                limit: 8,
                ...mem0Options
            }
        );

        const items = Array.isArray(response?.results) ? response.results : [];

        interface Mem0SearchMetadata {
            type?: MemoryType;
            tags?: string[];
        }

        interface Mem0SearchItem {
            text?: string;
            metadata?: Mem0SearchMetadata | null;
        }

        return (items as Mem0SearchItem[])
            .map(item => {
                const text = item.text ?? '';
                const metadata = (item.metadata || {}) as Mem0SearchMetadata;
                const type: MemoryType = metadata.type ?? 'history';
                const memTags = metadata.tags ?? [];

                return {
                    text,
                    type,
                    tags: memTags
                } satisfies MemoryAtom;
            })
            .filter(memory => {
                if (!tags.length) return true;
                return memory.tags.some(tag => tags.includes(tag));
            });
    } catch (error) {
        console.warn('[Mem0] search failed', error);
        return [];
    }
}
