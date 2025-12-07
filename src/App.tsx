import { useCallback, useEffect, useMemo, useState, useRef, type ComponentType } from 'react';
import {
    Sparkles,
    Rocket,
    Aperture,
    CircuitBoard,
    Compass,
    Share2,
    Target,
    Brain,
    Users,
    Zap,
    Globe,
    Shield,
    FileText,
    Database,
    Activity
} from 'lucide-react';
import AppLayout from './components/AppLayout';
import ChatPanel from './components/ChatPanel';
import CategorySuggestionPopup, { type CategorySuggestion } from './components/CategorySuggestionPopup';
import type { ContextCategory, ContextCategoryItem } from './components/Sidebar';
import type { ChatMessage, AttachedFile } from './types/chat';
import {
    createChatCompletionWithTools,
    grokIsConfigured,
    createContextCategoryTool,
    suggestCategoryTool,
    type GrokMessage,
    type CreateContextCategoryArgs,
    type SuggestCategoryArgs
} from './lib/grokClient';

// Icon name to component mapping for categories loaded from DB
const iconMap: Record<string, ComponentType<{ className?: string }>> = {
    Sparkles,
    Rocket,
    Aperture,
    CircuitBoard,
    Compass,
    Share2,
    Target,
    Brain,
    Users,
    Zap,
    Globe,
    Shield,
    FileText,
    Database,
    Activity
};

const initialMessages: ChatMessage[] = [
    {
        id: 'sys-1',
        role: 'system',
        content: 'You are Grok, an adaptive operations co-pilot. Maintain a resilient tone and weave in relevant context signals when responding.',
        timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString()
    },
    {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Morning! I have telemetry, launch readiness, and field intel primed. Want me to draft the 10:00 mission update or scan for new anomalies first?',
        timestamp: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
        tags: ['launch-readiness']
    },
    {
        id: 'user-1',
        role: 'user',
        content: 'Run a quick sweep for emerging risks tied to the Oceania rollout. Anything we should preempt before the all-hands?',
        timestamp: new Date(Date.now() - 1000 * 60 * 21).toISOString()
    },
    {
        id: 'assistant-2',
        role: 'assistant',
        content: 'Two signals surfaced: one around customer onboarding friction in Melbourne pilots, another about latency spike windows when traffic routes through Sydney relay. I can attach mitigation drafts if you want a pre-read.',
        timestamp: new Date(Date.now() - 1000 * 60 * 19).toISOString(),
        tags: ['field-intel', 'launch-readiness']
    }
];

const createId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

function synthesizeAssistantReply(prompt: string, category: ContextCategory): string {
    const anchor = category.items[0]?.title ?? 'selected context';
    const trimmedPrompt = prompt.length > 140 ? `${prompt.slice(0, 140)}…` : prompt;
    return [
        `Pulling from **${anchor}** and adjacent signals.`,
        `Here is the high-signal summary for: "${trimmedPrompt}"`,
        '',
        '• Key risk: latency windows widen during the Sydney relay — reroute through west coast edge for the next six hours.',
        '• Sentiment: onboarding confusion shows up in 14% of Oceania threads, mostly in healthcare pilots; drafting a fixes digest now.',
        '• Next move: spin a sub-thread titled "Oceania preempt" so we can track mitigations and auto-tag any fresh incidents.'
    ].join('\n');
}

export default function App() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [categories, setCategories] = useState<ContextCategory[]>([]);
    const [isAssistantTyping, setAssistantTyping] = useState(false);
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [grokStatusMessage, setGrokStatusMessage] = useState<string | null>(null);
    const [composerTags, setComposerTags] = useState<string[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [historyLoaded, setHistoryLoaded] = useState(false);

    // Category suggestion popup state
    const [pendingSuggestion, setPendingSuggestion] = useState<CategorySuggestion | null>(null);
    const [pendingMessageContent, setPendingMessageContent] = useState<string | null>(null);
    const [pendingUserMessageId, setPendingUserMessageId] = useState<string | null>(null);
    const [suggestionLoading, setSuggestionLoading] = useState(false);
    const pendingGrokMessagesRef = useRef<GrokMessage[] | null>(null);
    const pendingToolCallIdRef = useRef<string | null>(null);

    const grokConfigured = useMemo(() => grokIsConfigured(), []);

    // Load categories from DB on mount
    useEffect(() => {
        fetch('/api/categories')
            .then(res => res.ok ? res.json() : Promise.reject('Failed to load categories'))
            .then(data => {
                if (data.categories?.length > 0) {
                    // Map icon strings to actual components
                    const mappedCategories = data.categories.map((cat: ContextCategory & { icon: string }) => ({
                        ...cat,
                        icon: iconMap[cat.icon as string] || Sparkles
                    }));
                    setCategories(mappedCategories);
                    // No default selection - user picks context or Grok auto-tags
                }
            })
            .catch(error => {
                console.warn('Could not load categories from DB', error);
            });
    }, [activeCategoryId]);

    // Restore chat history from DB if session exists
    useEffect(() => {
        const storedSessionId = localStorage.getItem('grokchat-session-id');
        if (storedSessionId) {
            console.log('[History] Restoring session:', storedSessionId);
            setSessionId(storedSessionId);
            fetch(`/api/messages/${storedSessionId}?limit=100`)
                .then(res => res.ok ? res.json() : Promise.reject('Failed to load messages'))
                .then(data => {
                    console.log('[History] Loaded messages from DB:', data.messages?.length || 0);
                    if (data.messages?.length > 0) {
                        const systemMsg = initialMessages.find(m => m.role === 'system');
                        const restoredMessages = data.messages
                            .reverse() // DB returns DESC, reverse to ASC
                            .filter((msg: any) => msg.role !== 'system') // Filter out system messages from DB
                            .map((msg: any) => ({
                                id: msg.id,
                                role: msg.role,
                                content: msg.content,
                                timestamp: msg.timestamp,
                                tags: msg.tags ? JSON.parse(msg.tags) : undefined,
                                attachments: msg.attachments ? JSON.parse(msg.attachments) : undefined
                            }));
                        // Prepend system message if it exists
                        const finalMessages = systemMsg ? [systemMsg, ...restoredMessages] : restoredMessages;
                        console.log('[History] Setting', finalMessages.length, 'messages');
                        setMessages(finalMessages);
                        setHistoryLoaded(true);
                    } else {
                        // No history, use defaults
                        setMessages(initialMessages);
                        setHistoryLoaded(true);
                    }
                })
                .catch(error => {
                    console.warn('Could not restore chat history, using defaults', error);
                    setMessages(initialMessages);
                    setHistoryLoaded(true);
                });
        } else {
            // No session, use defaults
            console.log('[History] No stored session, using defaults');
            setMessages(initialMessages);
            setHistoryLoaded(true);
        }
    }, []);

    // Persist session ID to localStorage
    useEffect(() => {
        if (sessionId) {
            localStorage.setItem('grokchat-session-id', sessionId);
        }
    }, [sessionId]);

    const activeCategory = useMemo(
        () => categories.find(category => category.id === activeCategoryId) ?? null,
        [activeCategoryId, categories]
    );

    // Compute the 3 most recently used contexts from message history
    const recentContexts = useMemo(() => {
        const seenIds = new Set<string>();
        const recent: ContextCategory[] = [];
        // Traverse messages in reverse to find most recent tags first
        for (let i = messages.length - 1; i >= 0 && recent.length < 3; i--) {
            const msg = messages[i];
            if (msg.tags) {
                for (const tagId of msg.tags) {
                    if (!seenIds.has(tagId)) {
                        const cat = categories.find(c => c.id === tagId);
                        if (cat) {
                            seenIds.add(tagId);
                            recent.push(cat);
                            if (recent.length >= 3) break;
                        }
                    }
                }
            }
        }
        // If we don't have 3 yet, fill from categories
        for (const cat of categories) {
            if (recent.length >= 3) break;
            if (!seenIds.has(cat.id)) {
                recent.push(cat);
            }
        }
        return recent;
    }, [messages, categories]);

    useEffect(() => {
        if (activeCategoryId) {
            setComposerTags([activeCategoryId]);
        }
    }, [activeCategoryId]);

    const handleSendMessage = useCallback(
        async (content: string, tags: string[], attachments?: AttachedFile[]) => {
            // Build category list for auto-tagging prompt
            const categoryList = categories.map(c => `- ${c.id}: ${c.title}`).join('\n');
            const shouldAutoTag = tags.length === 0 && categories.length > 0;

            // User message stores only the display content (text + file names), not file contents
            const userMessage: ChatMessage = {
                id: `user-${createId()}`,
                role: 'user',
                content,
                timestamp: new Date().toISOString(),
                tags: [], // Will be updated after auto-tagging
                attachments: attachments // Store attachments separately for display
            };
            const nextHistory = [...messages, userMessage];
            setMessages(nextHistory);
            setAssistantTyping(true);

            // Build full content for Grok including file contents
            let grokContent = content;
            if (attachments && attachments.length > 0) {
                const fileSections: string[] = [];
                for (const f of attachments) {
                    if (f.type === 'text') {
                        fileSections.push(`\n\n--- File: ${f.name} ---\n${f.content}`);
                    } else if (f.type === 'image') {
                        fileSections.push(`\n\n--- Image: ${f.name} ---\n[Image attached: ${f.content}]`);
                    } else if (f.type === 'pdf') {
                        fileSections.push(`\n\n--- PDF: ${f.name} ---\n[PDF attached: ${f.content}]`);
                    }
                }
                grokContent = content + fileSections.join('');
            }

            try {
                const systemPrompt = nextHistory.find(message => message.role === 'system');
                let conversationalMessages = nextHistory.filter(message => message.role !== 'system');

                // When viewing a specific category, filter to only messages in that category
                // This keeps the context focused and reduces token usage
                if (activeCategoryId) {
                    conversationalMessages = conversationalMessages.filter(
                        msg => msg.tags?.includes(activeCategoryId)
                    );
                }

                const trimmedConversation = conversationalMessages.slice(-12);

                // Build completion messages - use grokContent for the latest user message
                const completionMessages = (
                    systemPrompt ? [systemPrompt, ...trimmedConversation] : trimmedConversation
                ).map((message, idx, arr) => {
                    // For the last message (user's new message), use the full grokContent
                    if (idx === arr.length - 1 && message.role === 'user') {
                        return { role: message.role, content: grokContent };
                    }
                    return { role: message.role, content: message.content };
                });

                // Determine effective tags for memory/RAG retrieval
                // Use the active category if filtering, otherwise use provided tags
                const effectiveTags = activeCategoryId ? [activeCategoryId] : tags;

                let usedMemories: { text: string; type: string; tags: string[] }[] = [];
                let ragDocs: { text: string }[] = [];
                let currentSessionId = sessionId;
                let dbUserMsgId: string | null = null;

                try {
                    // Prepare attachment metadata (without content) for DB storage
                    const attachmentsMeta = attachments?.map(a => ({
                        name: a.name,
                        size: a.size,
                        type: a.type,
                        mimeType: a.mimeType
                    }));

                    const response = await fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: 'demo-user',
                            messages: completionMessages,
                            tags: effectiveTags, // Use effective tags for memory/RAG retrieval
                            attachments: attachmentsMeta
                        })
                    });

                    if (response.ok) {
                        const data = await response.json() as {
                            usedMemories?: { text: string; type: string; tags: string[] }[];
                            ragDocs?: { text: string }[];
                            sessionId?: string;
                            userMsgId?: string;
                        };
                        usedMemories = data.usedMemories ?? [];
                        ragDocs = data.ragDocs ?? [];
                        dbUserMsgId = data.userMsgId ?? null;
                        if (data.sessionId) {
                            currentSessionId = data.sessionId;
                            setSessionId(data.sessionId);
                        }
                    }
                } catch (error) {
                    console.warn('Mem0 /api/chat call failed, continuing without memories', error);
                }

                const memorySection = usedMemories.length
                    ? usedMemories.map(memory => `- (${memory.type}) ${memory.text}`).join('\n')
                    : 'None yet.';

                const knowledgeSection = ragDocs.length
                    ? ragDocs.map(doc => `- ${doc.text}`).join('\n')
                    : 'None available.';

                // Tool instructions based on whether context is selected
                const toolInstruction = shouldAutoTag
                    ? `\n\nYou have tools available:\n1. suggest_category: The user did NOT select a context category. You MUST use this tool to suggest either an existing category or creating a new one. Available existing categories:\n${categoryList}\n2. create_context_category: If user explicitly asks to create a new category.`
                    : `\n\nYou have the ability to create new context categories using the create_context_category tool. Use this when the user is discussing a new topic that would benefit from its own dedicated space, or when they explicitly ask to create a new category/focus area. Choose appropriate icons and colors that match the topic.`;

                const grokMessages = [
                    systemPrompt
                        ? {
                            role: systemPrompt.role,
                            content: `${systemPrompt.content}\n\nKnown about this user and context (from memory):\n${memorySection}\n\nRelevant knowledge base:\n${knowledgeSection}${toolInstruction}`
                        }
                        : {
                            role: 'system' as const,
                            content: `You are Grok, an adaptive operations co-pilot. Maintain a resilient tone and weave in relevant context signals when responding.\n\nKnown about this user and context (from memory):\n${memorySection}\n\nRelevant knowledge base:\n${knowledgeSection}${toolInstruction}`
                        },
                    ...trimmedConversation.map(message => ({ role: message.role, content: message.content })),
                    { role: 'user' as const, content }
                ] as GrokMessage[];

                let assistantText = '';

                if (grokConfigured) {
                    // Determine which tools to provide
                    const tools = shouldAutoTag
                        ? [suggestCategoryTool, createContextCategoryTool]
                        : [createContextCategoryTool];

                    // First API call with tools
                    let result = await createChatCompletionWithTools(
                        grokMessages,
                        {
                            temperature: 0.6,
                            topP: 0.9,
                            maxTokens: 700,
                            tools,
                            tool_choice: shouldAutoTag ? 'required' : 'auto'
                        }
                    );

                    // Handle tool calls if any
                    if (result.tool_calls && result.tool_calls.length > 0) {
                        // Process each tool call
                        for (const toolCall of result.tool_calls) {
                            if (toolCall.function.name === 'suggest_category') {
                                // Show popup for user to decide
                                const args = JSON.parse(toolCall.function.arguments) as SuggestCategoryArgs;

                                const suggestion: CategorySuggestion = {
                                    type: args.suggestion_type,
                                    existingCategoryId: args.existing_category_id,
                                    newCategory: args.new_category,
                                    reasoning: args.reasoning
                                };

                                // Store state for when user responds to popup
                                setPendingSuggestion(suggestion);
                                setPendingMessageContent(content);
                                setPendingUserMessageId(userMessage.id);
                                pendingGrokMessagesRef.current = grokMessages;
                                pendingToolCallIdRef.current = toolCall.id;

                                // Don't continue - wait for user action
                                setAssistantTyping(false);
                                return;
                            }

                            if (toolCall.function.name === 'create_context_category') {
                                const args = JSON.parse(toolCall.function.arguments) as CreateContextCategoryArgs;

                                // Create the new category
                                const newCategoryId = `focus-${Date.now()}`;
                                const newCategory: ContextCategory = {
                                    id: newCategoryId,
                                    title: args.title,
                                    description: args.description,
                                    icon: iconMap[args.icon || 'Sparkles'] || Sparkles,
                                    accent: args.accent || 'from-grokPurple to-grokBlue',
                                    items: (args.signals || []).map((signal, idx) => ({
                                        id: `signal-${Date.now()}-${idx}`,
                                        title: signal.title,
                                        description: signal.description
                                    }))
                                };

                                // Add to state
                                setCategories(prev => [...prev, newCategory]);

                                // Persist to DB
                                try {
                                    await fetch('/api/categories', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            id: newCategory.id,
                                            title: newCategory.title,
                                            description: newCategory.description || null,
                                            icon: args.icon || 'Sparkles',
                                            accent: newCategory.accent
                                        })
                                    });

                                    // Persist signals
                                    for (const item of newCategory.items) {
                                        await fetch(`/api/categories/${newCategory.id}/items`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                id: item.id,
                                                title: item.title,
                                                description: item.description || null
                                            })
                                        });
                                    }
                                } catch (dbError) {
                                    console.warn('Failed to persist new category from tool call', dbError);
                                }

                                // Add tool result to messages and get follow-up response
                                const toolResultMessage: GrokMessage = {
                                    role: 'tool',
                                    content: JSON.stringify({
                                        success: true,
                                        category_id: newCategoryId,
                                        title: args.title,
                                        description: args.description,
                                        signals_count: newCategory.items.length
                                    }),
                                    tool_call_id: toolCall.id
                                };

                                // Append assistant message with tool_calls and tool result, then get final response
                                const followUpMessages: GrokMessage[] = [
                                    ...grokMessages,
                                    { role: 'assistant' as const, content: result.content || '', tool_calls: result.tool_calls } as unknown as GrokMessage,
                                    toolResultMessage
                                ];

                                // Get final response after tool execution
                                const followUpResult = await createChatCompletionWithTools(
                                    followUpMessages,
                                    {
                                        temperature: 0.6,
                                        topP: 0.9,
                                        maxTokens: 700
                                    }
                                );

                                assistantText = followUpResult.content || `I've created a new context category called "${args.title}"${args.description ? ` - ${args.description}` : ''}.${args.signals && args.signals.length > 0 ? ` I've also added ${args.signals.length} initial signal${args.signals.length > 1 ? 's' : ''} to help organize your thoughts.` : ''}`;
                            }
                        }
                    } else {
                        // No tool calls, use the content directly
                        assistantText = result.content || '';
                    }
                } else {
                    assistantText = synthesizeAssistantReply(content, categories[0]);
                }

                // Use resolved tags (already set if context was selected)
                let resolvedTags = tags;
                // Fallback to first category if still no tags
                if (resolvedTags.length === 0 && categories[0]) {
                    resolvedTags = [categories[0].id];
                }

                // Update user message with resolved tags in state
                setMessages(prev => prev.map(msg =>
                    msg.id === userMessage.id ? { ...msg, tags: resolvedTags } : msg
                ));

                // Update user message tags in DB if needed
                if (dbUserMsgId && resolvedTags.length > 0) {
                    fetch(`/api/messages/${dbUserMsgId}/tags`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tags: resolvedTags })
                    }).catch(error => console.warn('Failed to update user message tags', error));
                }

                const assistantMessage: ChatMessage = {
                    id: `assistant-${createId()}`,
                    role: 'assistant',
                    content: assistantText,
                    timestamp: new Date().toISOString(),
                    tags: resolvedTags
                };

                setMessages(prev => [...prev, assistantMessage]);
                setGrokStatusMessage(null);

                // Persist assistant response to DB
                if (currentSessionId) {
                    fetch('/api/chat/response', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionId: currentSessionId,
                            content: assistantText,
                            tags: resolvedTags
                        })
                    }).catch(error => console.warn('Failed to persist assistant response', error));
                }
            } catch (error) {
                console.error('Grok completion failed', error);
                const fallbackTags = tags.length > 0 ? tags : categories[0] ? [categories[0].id] : [];
                const fallback = synthesizeAssistantReply(content, categories[0]);
                const assistantMessage: ChatMessage = {
                    id: `assistant-${createId()}`,
                    role: 'assistant',
                    content: fallback,
                    timestamp: new Date().toISOString(),
                    tags: fallbackTags
                };
                // Update user message with fallback tags
                setMessages(prev => prev.map(msg =>
                    msg.id === userMessage.id ? { ...msg, tags: fallbackTags } : msg
                ));
                setMessages(prev => [...prev, assistantMessage]);
                const errorMessage =
                    error instanceof Error ? error.message : 'Unexpected error generating Grok response.';
                setGrokStatusMessage(`Grok error: ${errorMessage}`);
            } finally {
                setAssistantTyping(false);
            }
        },
        [categories, grokConfigured, messages, activeCategoryId]
    );

    const handleToggleComposerTag = useCallback((tagId: string) => {
        setComposerTags(prev => {
            if (prev.includes(tagId)) {
                // Allow removing even the last tag - no context is valid
                return prev.filter(id => id !== tagId);
            }
            return [...prev, tagId];
        });
    }, []);

    const handleResetComposerTags = useCallback(() => {
        if (activeCategoryId) {
            setComposerTags([activeCategoryId]);
            return;
        }
        if (categories[0]) {
            setComposerTags([categories[0].id]);
            return;
        }
        setComposerTags([]);
    }, [activeCategoryId, categories]);

    const handleUpdateCategoryItems = useCallback(
        (categoryId: string, items: ContextCategory['items']) => {
            setCategories(prev => prev.map(category => (category.id === categoryId ? { ...category, items } : category)));
        },
        []
    );

    const handleRenameCategory = useCallback((categoryId: string, nextTitle: string) => {
        setCategories(prev => prev.map(category => (category.id === categoryId ? { ...category, title: nextTitle } : category)));

        fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: categoryId, title: nextTitle })
        }).catch(error => {
            console.warn('Failed to persist category rename', error);
        });
    }, []);

    const handleUpdateDescription = useCallback((categoryId: string, description: string) => {
        setCategories(prev => prev.map(category => (category.id === categoryId ? { ...category, description } : category)));

        fetch(`/api/categories/${categoryId}/description`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description })
        }).catch(error => {
            console.warn('Failed to persist category description', error);
        });
    }, []);

    const handleUpdateIcon = useCallback((categoryId: string, iconName: string) => {
        const iconComponent = iconMap[iconName] || Sparkles;
        setCategories(prev => prev.map(category => (category.id === categoryId ? { ...category, icon: iconComponent } : category)));

        fetch(`/api/categories/${categoryId}/icon`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ icon: iconName })
        }).catch(error => {
            console.warn('Failed to persist category icon', error);
        });
    }, []);

    const handleUpdateAccent = useCallback((categoryId: string, accent: string) => {
        setCategories(prev => prev.map(category => (category.id === categoryId ? { ...category, accent } : category)));

        fetch(`/api/categories/${categoryId}/accent`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accent })
        }).catch(error => {
            console.warn('Failed to persist category accent', error);
        });
    }, []);

    const handleAddCategory = useCallback(async () => {
        const baseId = `focus-${Date.now()}`;
        const newCategory: ContextCategory = {
            id: baseId,
            title: 'New Focus',
            icon: Sparkles,
            accent: 'from-grokPurple to-grokBlue',
            items: []
        };

        try {
            await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: newCategory.id,
                    title: newCategory.title,
                    icon: 'Sparkles',
                    accent: newCategory.accent
                })
            });

            setCategories(prev => [...prev, newCategory]);
            setActiveCategoryId(newCategory.id);
            setComposerTags([newCategory.id]);
        } catch (error) {
            console.warn('Failed to add category', error);
        }
    }, []);

    const handleTogglePin = useCallback(async (categoryId: string) => {
        // Optimistically toggle in UI
        setCategories(prev => prev.map(cat =>
            cat.id === categoryId ? { ...cat, pinned: !cat.pinned } : cat
        ));

        try {
            await fetch(`/api/categories/${categoryId}/pin`, { method: 'POST' });
        } catch (error) {
            console.warn('Failed to toggle pin', error);
            // Revert on error
            setCategories(prev => prev.map(cat =>
                cat.id === categoryId ? { ...cat, pinned: !cat.pinned } : cat
            ));
        }
    }, []);

    const handleRemoveCategory = useCallback(async (categoryId: string) => {
        // Optimistically remove from UI
        const removedCategory = categories.find(c => c.id === categoryId);
        setCategories(prev => prev.filter(cat => cat.id !== categoryId));

        // If the removed category was active, clear selection
        if (activeCategoryId === categoryId) {
            setActiveCategoryId(null);
        }

        try {
            await fetch(`/api/categories/${categoryId}`, { method: 'DELETE' });
        } catch (error) {
            console.warn('Failed to remove category', error);
            // Revert on error
            if (removedCategory) {
                setCategories(prev => [...prev, removedCategory]);
            }
        }
    }, [categories, activeCategoryId]);

    const handleDeleteMessage = useCallback((userMessageId: string) => {
        // Find the user message and the following assistant message (if any)
        const userMsgIndex = messages.findIndex(m => m.id === userMessageId);
        if (userMsgIndex === -1) return;

        const userMsg = messages[userMsgIndex];
        if (userMsg.role !== 'user') return;

        // Check if the next message is an assistant response to pair with
        const nextMsg = messages[userMsgIndex + 1];
        const idsToDelete: string[] = [userMessageId];
        if (nextMsg && nextMsg.role === 'assistant') {
            idsToDelete.push(nextMsg.id);
        }

        // Optimistically remove from UI
        setMessages(prev => prev.filter(m => !idsToDelete.includes(m.id)));

        // Persist to DB
        fetch('/api/messages', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageIds: idsToDelete })
        }).catch(error => {
            console.warn('Failed to delete messages from DB', error);
        });
    }, [messages]);

    // Handle category suggestion popup responses
    const handleAcceptSuggestion = useCallback(async () => {
        if (!pendingSuggestion || !pendingUserMessageId) return;

        setSuggestionLoading(true);
        let categoryId: string;

        if (pendingSuggestion.type === 'new' && pendingSuggestion.newCategory) {
            // Create new category
            const newCategoryId = `focus-${Date.now()}`;
            const newCategory: ContextCategory = {
                id: newCategoryId,
                title: pendingSuggestion.newCategory.title,
                description: pendingSuggestion.newCategory.description,
                icon: iconMap[pendingSuggestion.newCategory.icon || 'Sparkles'] || Sparkles,
                accent: pendingSuggestion.newCategory.accent || 'from-grokPurple to-grokBlue',
                items: []
            };

            setCategories(prev => [...prev, newCategory]);
            categoryId = newCategoryId;

            // Persist to DB
            try {
                await fetch('/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: newCategory.id,
                        title: newCategory.title,
                        description: newCategory.description || null,
                        icon: pendingSuggestion.newCategory.icon || 'Sparkles',
                        accent: newCategory.accent
                    })
                });
            } catch (error) {
                console.warn('Failed to persist new category', error);
            }
        } else {
            // Use existing category
            categoryId = pendingSuggestion.existingCategoryId || categories[0]?.id || '';
        }

        // Continue with message flow
        await continueAfterCategorySuggestion(categoryId);
    }, [pendingSuggestion, pendingUserMessageId, categories]);

    const handleSelectExistingCategory = useCallback(async (categoryId: string) => {
        setSuggestionLoading(true);
        await continueAfterCategorySuggestion(categoryId);
    }, []);

    const handleForceClosestCategory = useCallback(async () => {
        setSuggestionLoading(true);
        // Find closest existing category (first one for now, could be smarter)
        const closestId = categories[0]?.id || '';
        await continueAfterCategorySuggestion(closestId);
    }, [categories]);

    const handleDismissSuggestion = useCallback(() => {
        // Use first category as fallback
        const fallbackId = categories[0]?.id || '';
        continueAfterCategorySuggestion(fallbackId);
    }, [categories]);

    const continueAfterCategorySuggestion = useCallback(async (categoryId: string) => {
        if (!pendingUserMessageId || !pendingGrokMessagesRef.current || !pendingToolCallIdRef.current) {
            setPendingSuggestion(null);
            setSuggestionLoading(false);
            return;
        }

        setAssistantTyping(true);

        // Update user message tags
        setMessages(prev => prev.map(msg =>
            msg.id === pendingUserMessageId ? { ...msg, tags: [categoryId] } : msg
        ));

        // Update tags in DB
        fetch(`/api/messages/${pendingUserMessageId}/tags`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: [categoryId] })
        }).catch(error => console.warn('Failed to update message tags', error));

        try {
            // Build tool result and get final response from Grok
            const toolResultMessage: GrokMessage = {
                role: 'tool',
                content: JSON.stringify({
                    user_selected_category_id: categoryId,
                    category_title: categories.find(c => c.id === categoryId)?.title || 'Unknown'
                }),
                tool_call_id: pendingToolCallIdRef.current
            };

            const followUpMessages: GrokMessage[] = [
                ...pendingGrokMessagesRef.current,
                { role: 'assistant' as const, content: '' } as GrokMessage,
                toolResultMessage
            ];

            const result = await createChatCompletionWithTools(
                followUpMessages,
                {
                    temperature: 0.6,
                    topP: 0.9,
                    maxTokens: 700
                }
            );

            const assistantText = result.content || 'I understand. Let me help you with that.';

            const assistantMessage: ChatMessage = {
                id: `assistant-${createId()}`,
                role: 'assistant',
                content: assistantText,
                timestamp: new Date().toISOString(),
                tags: [categoryId]
            };

            setMessages(prev => [...prev, assistantMessage]);

            // Persist assistant response
            if (sessionId) {
                fetch('/api/chat/response', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId,
                        content: assistantText,
                        tags: [categoryId]
                    })
                }).catch(error => console.warn('Failed to persist assistant response', error));
            }
        } catch (error) {
            console.error('Failed to get follow-up response', error);
        } finally {
            // Clear pending state
            setPendingSuggestion(null);
            setSuggestionLoading(false);
            setPendingMessageContent(null);
            setPendingUserMessageId(null);
            pendingGrokMessagesRef.current = null;
            pendingToolCallIdRef.current = null;
            setAssistantTyping(false);
        }
    }, [pendingUserMessageId, categories, sessionId]);

    return (
        <AppLayout
            sidebarProps={{
                isCollapsed: isSidebarCollapsed,
                onToggle: () => setSidebarCollapsed(prev => !prev),
                searchQuery,
                onSearchChange: setSearchQuery,
                categories,
                messages,
                activeCategoryId,
                onSelectCategory: setActiveCategoryId,
                onAddCategory: handleAddCategory,
                onTogglePin: handleTogglePin,
                onRemoveCategory: handleRemoveCategory
            }}
            isMobileMenuOpen={mobileMenuOpen}
            onMobileMenuOpen={() => setMobileMenuOpen(true)}
            onMobileMenuClose={() => setMobileMenuOpen(false)}
        >
            <ChatPanel
                title={activeCategory ? activeCategory.title : 'All contexts'}
                subtitle={activeCategory?.description ?? (activeCategory ? 'Add a description for this context...' : 'Synthesizing strategic context, tagging live signals, and queuing next actions for the team.')}
                messages={messages}
                onSendMessage={handleSendMessage}
                onDeleteMessage={handleDeleteMessage}
                isAssistantTyping={isAssistantTyping}
                activeCategory={activeCategory}
                statusMessage={grokStatusMessage}
                isGrokConnected={grokConfigured && !grokStatusMessage}
                contextCategories={categories}
                recentContexts={recentContexts}
                composerTags={composerTags}
                onToggleComposerTag={handleToggleComposerTag}
                onResetComposerTags={handleResetComposerTags}
                onUpdateCategoryItems={handleUpdateCategoryItems}
                onRenameCategory={handleRenameCategory}
                onUpdateDescription={handleUpdateDescription}
                onUpdateIcon={handleUpdateIcon}
                onUpdateAccent={handleUpdateAccent}
            />

            {/* Category suggestion popup */}
            {pendingSuggestion && (
                <CategorySuggestionPopup
                    suggestion={pendingSuggestion}
                    existingCategories={categories.map(cat => ({
                        id: cat.id,
                        title: cat.title,
                        icon: cat.icon,
                        accent: cat.accent
                    }))}
                    onAcceptSuggestion={handleAcceptSuggestion}
                    onSelectExisting={handleSelectExistingCategory}
                    onForceClosest={handleForceClosestCategory}
                    onDismiss={handleDismissSuggestion}
                    isLoading={suggestionLoading}
                />
            )}
        </AppLayout>
    );
}
