export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
    id: string;
    role: ChatRole;
    content: string;
    timestamp: string;
    summary?: string;
    tags?: string[];
}
