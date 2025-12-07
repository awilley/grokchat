export type GrokMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface GrokMessage {
    role: GrokMessageRole;
    content: string;
    tool_call_id?: string;
}

export interface GrokToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, {
                type: string;
                description?: string;
                items?: { type: string; properties?: Record<string, unknown>; required?: string[] };
                enum?: string[];
                default?: unknown;
            }>;
            required?: string[];
        };
    };
}

export interface GrokToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface GrokCompletionOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    model?: string;
    tools?: GrokToolDefinition[];
    tool_choice?: 'auto' | 'none' | 'required';
}

interface GrokCompletionResponse {
    choices?: Array<{
        message?: {
            role?: GrokMessageRole;
            content?: string | null;
            tool_calls?: GrokToolCall[];
        };
        finish_reason?: string;
    }>;
}

export interface GrokCompletionResult {
    content: string | null;
    tool_calls?: GrokToolCall[];
    finish_reason?: string;
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

export async function createChatCompletion(messages: GrokMessage[], options: GrokCompletionOptions = {}): Promise<string> {
    const result = await createChatCompletionWithTools(messages, options);
    return result.content?.trim() ?? '';
}

export async function createChatCompletionWithTools(messages: GrokMessage[], options: GrokCompletionOptions = {}): Promise<GrokCompletionResult> {
    if (!isConfigured) {
        throw new Error('Grok API key is not configured. Set VITE_GROK_API_KEY in your environment.');
    }

    const requestBody: Record<string, unknown> = {
        model: options.model ?? GROK_DEFAULT_MODEL,
        messages,
        temperature: options.temperature ?? 0.6,
        max_tokens: options.maxTokens ?? 600,
        top_p: options.topP ?? 0.9
    };

    if (options.tools && options.tools.length > 0) {
        requestBody.tools = options.tools;
        requestBody.tool_choice = options.tool_choice ?? 'auto';
    }

    const response = await fetch(`${GROK_API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GROK_API_KEY}`
        },
        body: JSON.stringify(requestBody)
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
    const choice = payload?.choices?.[0];

    return {
        content: choice?.message?.content ?? null,
        tool_calls: choice?.message?.tool_calls,
        finish_reason: choice?.finish_reason
    };
}

// Tool definition for creating a new context category
export const createContextCategoryTool: GrokToolDefinition = {
    type: 'function',
    function: {
        name: 'create_context_category',
        description: 'Create a new context category to organize conversations and knowledge. Use this when the user discusses a topic that would benefit from its own dedicated context space, or when they explicitly ask to create a new category/focus area.',
        parameters: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: 'The name/title for the new context category (e.g., "Project Alpha", "Health & Fitness", "Travel Plans")'
                },
                description: {
                    type: 'string',
                    description: 'A brief description of what this context category is for'
                },
                icon: {
                    type: 'string',
                    description: 'Icon name for the category',
                    enum: ['Sparkles', 'Rocket', 'Aperture', 'CircuitBoard', 'Compass', 'Share2', 'Target', 'Brain', 'Users', 'Zap', 'Globe', 'Shield', 'FileText', 'Database', 'Activity'],
                    default: 'Sparkles'
                },
                accent: {
                    type: 'string',
                    description: 'Color theme for the category',
                    enum: ['from-grokPurple to-grokBlue', 'from-grokPink to-grokPurple', 'from-grokBlue to-cyan-400', 'from-orange-500 to-red-500', 'from-emerald-500 to-teal-500', 'from-violet-500 to-indigo-500', 'from-rose-500 to-pink-500', 'from-amber-500 to-yellow-500'],
                    default: 'from-grokPurple to-grokBlue'
                },
                signals: {
                    type: 'array',
                    description: 'Optional initial context signals to add to this category',
                    items: {
                        type: 'object',
                        properties: {
                            title: { type: 'string', description: 'Signal title' },
                            description: { type: 'string', description: 'Signal description' }
                        },
                        required: ['title']
                    }
                }
            },
            required: ['title']
        }
    }
};

export interface CreateContextCategoryArgs {
    title: string;
    description?: string;
    icon?: string;
    accent?: string;
    signals?: Array<{ title: string; description?: string }>;
}

// Tool definition for suggesting a category when user sends without context
export const suggestCategoryTool: GrokToolDefinition = {
    type: 'function',
    function: {
        name: 'suggest_category',
        description: 'When the user sends a message without selecting a context category, use this tool to suggest either creating a new category or selecting an existing one. This lets the user decide how to categorize their message.',
        parameters: {
            type: 'object',
            properties: {
                suggestion_type: {
                    type: 'string',
                    description: 'Whether suggesting a new category or an existing one',
                    enum: ['new', 'existing']
                },
                existing_category_id: {
                    type: 'string',
                    description: 'If suggestion_type is "existing", the ID of the suggested existing category'
                },
                new_category: {
                    type: 'object',
                    description: 'If suggestion_type is "new", details for the suggested new category',
                    properties: {
                        title: { type: 'string', description: 'Suggested title for the new category' },
                        description: { type: 'string', description: 'Suggested description' },
                        icon: {
                            type: 'string',
                            enum: ['Sparkles', 'Rocket', 'Aperture', 'CircuitBoard', 'Compass', 'Share2', 'Target', 'Brain', 'Users', 'Zap', 'Globe', 'Shield', 'FileText', 'Database', 'Activity']
                        },
                        accent: {
                            type: 'string',
                            enum: ['from-grokPurple to-grokBlue', 'from-grokPink to-grokPurple', 'from-grokBlue to-cyan-400', 'from-orange-500 to-red-500', 'from-emerald-500 to-teal-500', 'from-violet-500 to-indigo-500', 'from-rose-500 to-pink-500', 'from-amber-500 to-yellow-500']
                        }
                    },
                    required: ['title']
                },
                reasoning: {
                    type: 'string',
                    description: 'Brief explanation of why this category is suggested'
                }
            },
            required: ['suggestion_type', 'reasoning']
        }
    }
};

export interface SuggestCategoryArgs {
    suggestion_type: 'new' | 'existing';
    existing_category_id?: string;
    new_category?: {
        title: string;
        description?: string;
        icon?: string;
        accent?: string;
    };
    reasoning: string;
}
