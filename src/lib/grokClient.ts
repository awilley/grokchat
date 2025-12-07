export type GrokMessageRole = 'system' | 'user' | 'assistant';

export interface GrokMessage {
    role: GrokMessageRole;
    content: string;
}

export interface GrokCompletionOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    model?: string;
}

interface GrokCompletionResponse {
    choices?: Array<{
        message?: {
            role?: GrokMessageRole;
            content?: string;
        };
    }>;
}

declare global {
    interface ImportMetaEnv {
        readonly VITE_GROK_API_KEY?: string;
        readonly VITE_GROK_API_BASE_URL?: string;
        readonly VITE_GROK_API_MODEL?: string;
    }

    interface ImportMeta {
        readonly env: ImportMetaEnv;
    }
}

const GROK_API_KEY = import.meta.env.VITE_GROK_API_KEY;
const GROK_API_BASE_URL = import.meta.env.VITE_GROK_API_BASE_URL ?? 'https://api.x.ai/v1';
const GROK_DEFAULT_MODEL = import.meta.env.VITE_GROK_API_MODEL ?? 'grok-beta';

const isConfigured = Boolean(GROK_API_KEY && GROK_API_KEY.trim().length > 0);

export function grokIsConfigured() {
    return isConfigured;
}

export async function createChatCompletion(messages: GrokMessage[], options: GrokCompletionOptions = {}) {
    if (!isConfigured) {
        throw new Error('Grok API key is not configured. Set VITE_GROK_API_KEY in your environment.');
    }

    const response = await fetch(`${GROK_API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GROK_API_KEY}`
        },
        body: JSON.stringify({
            model: options.model ?? GROK_DEFAULT_MODEL,
            messages,
            temperature: options.temperature ?? 0.6,
            max_tokens: options.maxTokens ?? 600,
            top_p: options.topP ?? 0.9
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        let details = errorText;
        try {
            const parsed = JSON.parse(errorText) as { error?: { message?: string } };
            details = parsed?.error?.message ?? errorText;
        } catch (parseError) {
            // Leave details as original string when parsing fails
            console.warn('Unable to parse Grok error payload', parseError);
        }
        throw new Error(`Grok API request failed (${response.status}): ${details}`);
    }

    const payload = (await response.json()) as GrokCompletionResponse;
    const content = payload?.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('Grok API response did not include message content.');
    }

    return content.trim();
}
