export type ChatRole = 'user' | 'assistant' | 'system';

export interface AttachedFile {
    name: string;
    content: string;
    size: number;
    type: 'text' | 'image' | 'pdf';
    mimeType?: string;
}

export interface ChatMessage {
    id: string;
    role: ChatRole;
    content: string;
    timestamp: string;
    summary?: string;
    tags?: string[];
    attachments?: AttachedFile[];
}
