import { useEffect, useMemo, useRef, useState, type ReactNode, type KeyboardEvent, type ComponentType } from 'react';
import clsx from 'clsx';
import {
    FileText,
    ImageIcon,
    MessageSquare,
    ChevronDown,
    Search,
    X,
    Hash,
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
    Database,
    Activity,
    Palette
} from 'lucide-react';
import type { ChatMessage, AttachedFile } from '../types/chat';
import type { ContextCategory, ContextCategoryItem } from './Sidebar';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';

// Available icons for category customization
const availableIcons: { name: string; component: ComponentType<{ className?: string }> }[] = [
    { name: 'Sparkles', component: Sparkles },
    { name: 'Rocket', component: Rocket },
    { name: 'Aperture', component: Aperture },
    { name: 'CircuitBoard', component: CircuitBoard },
    { name: 'Compass', component: Compass },
    { name: 'Share2', component: Share2 },
    { name: 'Target', component: Target },
    { name: 'Brain', component: Brain },
    { name: 'Users', component: Users },
    { name: 'Zap', component: Zap },
    { name: 'Globe', component: Globe },
    { name: 'Shield', component: Shield },
    { name: 'FileText', component: FileText },
    { name: 'Database', component: Database },
    { name: 'Activity', component: Activity }
];

// Available color themes
const availableAccents = [
    { name: 'Purple Blue', value: 'from-grokPurple to-grokBlue' },
    { name: 'Pink Purple', value: 'from-grokPink to-grokPurple' },
    { name: 'Blue Cyan', value: 'from-grokBlue to-cyan-400' },
    { name: 'Orange Red', value: 'from-orange-500 to-red-500' },
    { name: 'Green Teal', value: 'from-emerald-500 to-teal-500' },
    { name: 'Violet Indigo', value: 'from-violet-500 to-indigo-500' },
    { name: 'Rose Pink', value: 'from-rose-500 to-pink-500' },
    { name: 'Amber Yellow', value: 'from-amber-500 to-yellow-500' }
];

interface ChatPanelProps {
    title: string;
    subtitle: string;
    messages: ChatMessage[];
    onSendMessage: (content: string, tags: string[], attachments?: AttachedFile[]) => void;
    onDeleteMessage: (messageId: string) => void;
    isAssistantTyping: boolean;
    activeCategory: ContextCategory | null;
    isGrokConnected: boolean;
    statusMessage: string | null;
    contextCategories: ContextCategory[];
    recentContexts: ContextCategory[];
    composerTags: string[];
    onToggleComposerTag: (tagId: string) => void;
    onResetComposerTags: () => void;
    onUpdateCategoryItems: (categoryId: string, items: ContextCategoryItem[]) => void;
    onRenameCategory: (categoryId: string, title: string) => void;
    onUpdateDescription: (categoryId: string, description: string) => void;
    onUpdateIcon: (categoryId: string, iconName: string) => void;
    onUpdateAccent: (categoryId: string, accent: string) => void;
}

export default function ChatPanel({
    title,
    subtitle,
    messages,
    onSendMessage,
    onDeleteMessage,
    isAssistantTyping,
    activeCategory,
    isGrokConnected,
    statusMessage,
    contextCategories,
    recentContexts,
    composerTags,
    onToggleComposerTag,
    onResetComposerTags,
    onUpdateCategoryItems,
    onRenameCategory,
    onUpdateDescription,
    onUpdateIcon,
    onUpdateAccent
}: ChatPanelProps) {
    const signalContext = activeCategory ?? contextCategories[0];
    const topSignals = useMemo<ContextCategoryItem[]>(() => signalContext?.items.slice(0, 3) ?? [], [signalContext]);

    // Compute thread stats
    const threadStats = useMemo(() => {
        const relevantMessages = activeCategory
            ? messages.filter(m => m.role !== 'system' && m.tags?.includes(activeCategory.id))
            : messages.filter(m => m.role !== 'system');

        let fileCount = 0;
        let imageCount = 0;
        let totalChars = 0;

        for (const msg of relevantMessages) {
            totalChars += msg.content.length;
            // Count file references (common patterns)
            const fileMatches = msg.content.match(/\.(txt|pdf|doc|docx|csv|json|xml|md|py|js|ts|tsx|jsx|html|css)\b/gi);
            if (fileMatches) fileCount += fileMatches.length;
            // Count image references
            const imageMatches = msg.content.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp)\b/gi);
            if (imageMatches) imageCount += imageMatches.length;
        }

        // Approximate token count (rough estimate: 4 chars per token)
        const approxTokens = Math.round(totalChars / 4);
        const contextDisplay = approxTokens >= 1000
            ? `${(approxTokens / 1000).toFixed(1)}k tokens`
            : `${approxTokens} tokens`;

        return {
            messageCount: relevantMessages.length,
            fileCount,
            imageCount,
            contextDisplay
        };
    }, [messages, activeCategory]);

    const orderedMessages = useMemo(() => {
        const base = activeCategory
            ? messages.filter(message => {
                if (message.role === 'system') {
                    return true;
                }
                if (!message.tags || message.tags.length === 0) {
                    return false;
                }
                return message.tags.includes(activeCategory.id);
            })
            : messages;

        return [...base].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
    }, [activeCategory, messages]);

    const INITIAL_VISIBLE = 20;
    const LOAD_CHUNK = 15;
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const drawerRef = useRef<HTMLDivElement | null>(null);
    const filterButtonRef = useRef<HTMLDivElement | null>(null);
    const pendingScrollAdjustment = useRef<{ prevHeight: number; prevTop: number } | null>(null);
    const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    useEffect(() => {
        setDrawerOpen(false);
    }, [activeCategory?.id]);

    useEffect(() => {
        if (!drawerOpen) {
            return;
        }

        const handleClick = (event: MouseEvent) => {
            const drawer = drawerRef.current;
            const button = filterButtonRef.current;
            if (!drawer || !button) {
                return;
            }
            const target = event.target as Node;
            if (!drawer.contains(target) && !button.contains(target)) {
                setDrawerOpen(false);
            }
        };

        window.addEventListener('mousedown', handleClick);
        return () => {
            window.removeEventListener('mousedown', handleClick);
        };
    }, [drawerOpen]);

    useEffect(() => {
        if (orderedMessages.length === 0) {
            setVisibleCount(0);
            return;
        }

        if (!activeCategory) {
            setVisibleCount(orderedMessages.length);
            return;
        }

        setVisibleCount(prev => {
            const baseline = Math.min(INITIAL_VISIBLE, orderedMessages.length);
            if (prev > orderedMessages.length) {
                return orderedMessages.length;
            }
            return Math.max(prev, baseline);
        });
    }, [activeCategory, orderedMessages.length]);

    useEffect(() => {
        const adjust = pendingScrollAdjustment.current;
        if (!adjust) {
            return;
        }
        const container = scrollRef.current;
        if (!container) {
            pendingScrollAdjustment.current = null;
            return;
        }

        const diff = container.scrollHeight - adjust.prevHeight;
        container.scrollTop = adjust.prevTop + diff;
        pendingScrollAdjustment.current = null;
    }, [visibleCount, orderedMessages.length]);

    const handleScroll = () => {
        const container = scrollRef.current;
        if (!container || orderedMessages.length === 0) {
            return;
        }

        if (container.scrollTop <= 120 && visibleCount < orderedMessages.length) {
            const prevHeight = container.scrollHeight;
            const prevTop = container.scrollTop;
            setVisibleCount(prev => {
                const next = Math.min(prev + LOAD_CHUNK, orderedMessages.length);
                if (next !== prev) {
                    pendingScrollAdjustment.current = { prevHeight, prevTop };
                }
                return next;
            });
        }
    };

    const visibleMessages = useMemo(
        () => orderedMessages.slice(-visibleCount),
        [orderedMessages, visibleCount]
    );

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) {
            return [];
        }
        const query = searchQuery.toLowerCase();
        return orderedMessages
            .filter(msg => msg.role !== 'system' && msg.content.toLowerCase().includes(query))
            .slice(0, 8);
    }, [searchQuery, orderedMessages]);

    const handleJumpToMessage = (messageId: string) => {
        const messageIndex = orderedMessages.findIndex(msg => msg.id === messageId);
        if (messageIndex === -1) {
            return;
        }

        if (messageIndex >= orderedMessages.length - visibleCount) {
            const ref = messageRefs.current.get(messageId);
            ref?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            setVisibleCount(orderedMessages.length - messageIndex + 5);
            setTimeout(() => {
                const ref = messageRefs.current.get(messageId);
                ref?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 150);
        }

        setSearchQuery('');
        setSearchFocused(false);
    };

    return (
        <div className="flex flex-1 min-h-0 flex-col relative">
            <div className="flex-1 basis-0 min-h-0 overflow-y-auto" ref={scrollRef} onScroll={handleScroll}>
                <div className="sticky top-0 z-30 border-b border-white/5 bg-secondary/80 backdrop-blur-md">
                    <div className="relative mx-auto w-full max-w-4xl px-4 py-2">
                        <div ref={filterButtonRef} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-secondary/70 px-4 py-2.5 text-white transition hover:border-white/30 hover:bg-secondary/80">
                            <button
                                type="button"
                                onClick={() => setDrawerOpen(prev => !prev)}
                                className="flex flex-1 items-center justify-between gap-4 text-left focus-visible:outline-none"
                                aria-expanded={drawerOpen}
                            >
                                <div className="flex flex-col">
                                    <span className="text-[11px] uppercase tracking-[0.3em] text-white/50">Context Filtering</span>
                                    <p className="text-sm font-semibold text-white">
                                        {activeCategory ? activeCategory.title : 'All contexts'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-white/70">
                                    <span>{orderedMessages.length} entries</span>
                                    <span
                                        className={clsx(
                                            'inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 transition-transform',
                                            drawerOpen ? 'rotate-180' : 'rotate-0'
                                        )}
                                    >
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    </span>
                                </div>
                            </button>

                            <div className="h-8 w-px bg-white/10" />

                            <div className="relative flex flex-1 items-center gap-2">
                                <Search className="h-4 w-4 text-white/50" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onFocus={() => setSearchFocused(true)}
                                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                                    placeholder="Search history..."
                                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="text-white/50 transition hover:text-white"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}

                                {searchFocused && searchResults.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full z-40 mt-3 max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-secondary/95 shadow-2xl shadow-black/50 backdrop-blur-xl">
                                        <div className="p-2">
                                            {searchResults.map(msg => (
                                                <button
                                                    key={msg.id}
                                                    type="button"
                                                    onClick={() => handleJumpToMessage(msg.id)}
                                                    className="flex w-full flex-col gap-1 rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-white/20 hover:bg-white/5"
                                                >
                                                    <div className="flex items-center gap-2 text-xs text-white/50">
                                                        <span className="font-semibold uppercase tracking-[0.2em] text-white/70">
                                                            {msg.role === 'user' ? 'You' : 'Grok'}
                                                        </span>
                                                        <span className="text-white/40">
                                                            {new Date(msg.timestamp).toLocaleString([], {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                    <p className="line-clamp-2 text-sm text-white/80">{msg.content}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <ChatMessageList
                    messages={visibleMessages}
                    isAssistantTyping={isAssistantTyping}
                    messageRefs={messageRefs}
                    categories={contextCategories}
                    onDeleteMessage={onDeleteMessage}
                />
            </div>
            <ChatInput
                onSend={onSendMessage}
                disabled={isAssistantTyping}
                contexts={recentContexts}
                allContexts={contextCategories}
                selectedTags={composerTags}
                onToggleTag={onToggleComposerTag}
                onResetTags={onResetComposerTags}
            />

            {/* Portal-style drawer overlay with dedicated backdrop */}
            {drawerOpen && (
                <div className="absolute inset-0 z-40">
                    <button
                        type="button"
                        aria-label="Close filtering panel"
                        className="absolute inset-0 w-full h-full cursor-default bg-transparent"
                        onClick={() => setDrawerOpen(false)}
                    />
                </div>
            )}

            <div
                ref={drawerRef}
                className={clsx(
                    'absolute left-0 right-0 top-16 origin-top transition-all duration-300 z-50 px-4',
                    drawerOpen
                        ? 'translate-y-0 opacity-100 pointer-events-auto'
                        : '-translate-y-2 opacity-0 pointer-events-none'
                )}
            >
                <div className="mx-auto w-full max-w-4xl">
                    <div className="rounded-3xl border border-white/10 bg-secondary/95 shadow-2xl shadow-black/50 backdrop-blur-xl max-h-[calc(100vh-10rem)] overflow-visible">
                        <ContextDrawer
                            title={title}
                            subtitle={subtitle}
                            statusMessage={statusMessage}
                            topSignals={topSignals}
                            activeCategory={activeCategory}
                            onUpdateCategoryItems={onUpdateCategoryItems}
                            onRenameCategory={onRenameCategory}
                            onUpdateDescription={onUpdateDescription}
                            onUpdateIcon={onUpdateIcon}
                            onUpdateAccent={onUpdateAccent}
                        />
                        <div className="relative z-0 border-t border-white/5 bg-white/5 px-6 py-6">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <InsightCard
                                    icon={<MessageSquare className="h-5 w-5" />}
                                    title="Messages"
                                    value={`${threadStats.messageCount} in thread`}
                                />
                                <InsightCard
                                    icon={<FileText className="h-5 w-5" />}
                                    title="Files"
                                    value={threadStats.fileCount > 0 ? `${threadStats.fileCount} referenced` : 'None referenced'}
                                />
                                <InsightCard
                                    icon={<Hash className="h-5 w-5" />}
                                    title="Context Length"
                                    value={threadStats.contextDisplay}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface InsightCardProps {
    icon: ReactNode;
    title: string;
    value: string;
}

interface ContextDrawerProps {
    title: string;
    subtitle: string;
    statusMessage: string | null;
    topSignals: ContextCategoryItem[];
    activeCategory: ContextCategory | null;
    onUpdateCategoryItems: (categoryId: string, items: ContextCategoryItem[]) => void;
    onRenameCategory: (categoryId: string, title: string) => void;
    onUpdateDescription: (categoryId: string, description: string) => void;
    onUpdateIcon: (categoryId: string, iconName: string) => void;
    onUpdateAccent: (categoryId: string, accent: string) => void;
}

function ContextDrawer({
    title,
    subtitle,
    statusMessage,
    topSignals,
    activeCategory,
    onUpdateCategoryItems,
    onRenameCategory,
    onUpdateDescription,
    onUpdateIcon,
    onUpdateAccent
}: ContextDrawerProps) {
    const canEdit = !!activeCategory;
    const [titleDraft, setTitleDraft] = useState(activeCategory?.title ?? title);
    const [descriptionDraft, setDescriptionDraft] = useState(activeCategory?.description ?? subtitle);
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    useEffect(() => {
        setTitleDraft(activeCategory?.title ?? title);
        setDescriptionDraft(activeCategory?.description ?? subtitle);
    }, [activeCategory?.title, activeCategory?.description, title, subtitle]);

    const handleDeleteSignal = (id: string) => {
        if (!activeCategory) return;
        const next = activeCategory.items.filter(item => item.id !== id);
        onUpdateCategoryItems(activeCategory.id, next);
    };

    const handleAddSignal = () => {
        if (!activeCategory) return;
        const next: ContextCategoryItem[] = [
            ...activeCategory.items,
            {
                id: `custom-${Date.now()}`,
                title: 'New signal',
                description: 'Click to edit description.'
            }
        ];
        onUpdateCategoryItems(activeCategory.id, next);
    };

    const handleSignalChange = (id: string, updates: Partial<ContextCategoryItem>) => {
        if (!activeCategory) return;
        const next = activeCategory.items.map(item => (item.id === id ? { ...item, ...updates } : item));
        onUpdateCategoryItems(activeCategory.id, next);
    };

    const commitTitle = () => {
        if (!activeCategory) return;
        const trimmed = titleDraft.trim() || 'Untitled Context';
        setTitleDraft(trimmed);
        onRenameCategory(activeCategory.id, trimmed);
    };

    const commitDescription = () => {
        if (!activeCategory) return;
        const trimmed = descriptionDraft.trim();
        setDescriptionDraft(trimmed);
        onUpdateDescription(activeCategory.id, trimmed);
    };

    const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
        }
    };

    const handleDescriptionKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
        }
    };

    return (
        <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-primary via-secondary/80 to-primary">
            <div className="absolute -left-32 -top-32 h-64 w-64 rounded-full bg-grokPurple/30 blur-3xl" aria-hidden="true" />
            <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-grokPink/20 blur-3xl" aria-hidden="true" />
            <div className="absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-grokBlue/20 blur-3xl" aria-hidden="true" />

            <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
                <div className="flex flex-col gap-2">
                    {canEdit ? (
                        <input
                            value={titleDraft}
                            onChange={event => setTitleDraft(event.target.value)}
                            onBlur={commitTitle}
                            onKeyDown={handleTitleKeyDown}
                            className="text-3xl font-semibold tracking-tight text-white bg-transparent border-b border-transparent focus:border-white/40 focus:outline-none"
                        />
                    ) : (
                        <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
                    )}
                    {canEdit ? (
                        <input
                            value={descriptionDraft}
                            onChange={event => setDescriptionDraft(event.target.value)}
                            onBlur={commitDescription}
                            onKeyDown={handleDescriptionKeyDown}
                            placeholder="Add a description..."
                            className="text-sm text-white/60 bg-transparent border-b border-transparent focus:border-white/40 focus:outline-none placeholder:text-white/30"
                        />
                    ) : (
                        <p className="text-sm text-white/60">{subtitle}</p>
                    )}
                    {canEdit && (
                        <div className="mt-3 flex flex-wrap gap-2 relative z-[100]">
                            {/* Icon Picker */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => { setShowIconPicker(!showIconPicker); setShowColorPicker(false); }}
                                    className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white"
                                >
                                    {(() => {
                                        const Icon = activeCategory.icon;
                                        return <Icon className="h-4 w-4" />;
                                    })()}
                                    <span>Icon</span>
                                </button>
                                {showIconPicker && (
                                    <div className="absolute left-0 top-full z-[200] mt-2 grid w-[220px] grid-cols-5 gap-2 rounded-2xl border border-white/15 bg-[#1a1a2e] p-3 shadow-2xl shadow-black/60 backdrop-blur-xl">
                                        {availableIcons.map(({ name, component: IconComp }) => (
                                            <button
                                                key={name}
                                                type="button"
                                                onClick={() => {
                                                    onUpdateIcon(activeCategory.id, name);
                                                    setShowIconPicker(false);
                                                }}
                                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent bg-white/5 transition hover:border-white/20 hover:bg-white/15"
                                                title={name}
                                            >
                                                <IconComp className="h-4 w-4 text-white/80" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Color Picker */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => { setShowColorPicker(!showColorPicker); setShowIconPicker(false); }}
                                    className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white"
                                >
                                    <span className={clsx('h-4 w-4 rounded-full bg-gradient-to-br', activeCategory.accent)} />
                                    <span>Color</span>
                                </button>
                                {showColorPicker && (
                                    <div className="absolute left-0 top-full z-[200] mt-2 flex flex-col gap-1 rounded-2xl border border-white/15 bg-[#1a1a2e] p-2 shadow-2xl shadow-black/60 backdrop-blur-xl min-w-[180px]">
                                        {availableAccents.map(({ name, value }) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => {
                                                    onUpdateAccent(activeCategory.id, value);
                                                    setShowColorPicker(false);
                                                }}
                                                className={clsx(
                                                    'flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-white/80 transition hover:bg-white/10',
                                                    activeCategory.accent === value && 'bg-white/15 ring-1 ring-white/20'
                                                )}
                                            >
                                                <span className={clsx('h-5 w-5 rounded-full bg-gradient-to-br shadow-inner', value)} />
                                                <span className="font-medium">{name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {statusMessage && (
                        <div className="mt-2">
                            <span className="rounded-full border border-grokPink/50 bg-grokPink/10 px-3 py-1 text-[11px] text-grokPink/80">
                                {statusMessage}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/45">Context Signals</p>
                    {canEdit && (
                        <button
                            type="button"
                            onClick={handleAddSignal}
                            className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-white/70 transition hover:border-white/40 hover:text-white"
                        >
                            Add Signal
                        </button>
                    )}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    {(canEdit ? activeCategory?.items : topSignals).map(signal => (
                        <div
                            key={signal.id}
                            className="group relative rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/40"
                        >
                            <p className="text-xs uppercase tracking-[0.25em] text-white/40">Context Signal</p>
                            {canEdit ? (
                                <>
                                    <input
                                        className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm font-semibold text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                                        value={signal.title}
                                        onChange={event => handleSignalChange(signal.id, { title: event.target.value })}
                                    />
                                    <textarea
                                        className="mt-2 w-full rounded-2xl border border-white/15 bg-black/15 px-3 py-2 text-xs text-white/80 placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                                        value={signal.description ?? ''}
                                        onChange={event => handleSignalChange(signal.id, { description: event.target.value })}
                                        rows={3}
                                    />
                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/40">
                                        <button
                                            type="button"
                                            onClick={() => handleSignalChange(signal.id, { emphasis: !signal.emphasis })}
                                            className={clsx(
                                                'rounded-full border px-3 py-1 text-[10px] transition',
                                                signal.emphasis
                                                    ? 'border-grokPink/60 bg-grokPink/10 text-white'
                                                    : 'border-white/15 text-white/70 hover:border-white/40'
                                            )}
                                        >
                                            {signal.emphasis ? 'Highlighted' : 'Mark highlight'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleSignalChange(signal.id, {
                                                    updatedAt: new Date().toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })
                                                })
                                            }
                                            className="rounded-full border border-white/15 px-3 py-1 text-[10px] text-white/70 transition hover:border-white/40"
                                        >
                                            Stamp time
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="mt-2 text-sm font-semibold text-white">{signal.title}</p>
                                    {signal.description && <p className="mt-2 text-xs text-white/50">{signal.description}</p>}
                                </>
                            )}
                            {signal.updatedAt && (
                                <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-white/35">Updated {signal.updatedAt}</p>
                            )}
                            {canEdit && (
                                <button
                                    type="button"
                                    onClick={() => handleDeleteSignal(signal.id)}
                                    className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.25em] text-white/70 opacity-0 transition group-hover:opacity-100"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    ))}
                    {canEdit && activeCategory?.items.length === 0 && (
                        <div className="sm:col-span-3 rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
                            No context signals yet. Use “Add Signal” to seed this context.
                        </div>
                    )}
                    {!canEdit && topSignals.length === 0 && (
                        <div className="sm:col-span-3 rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
                            No context signals yet. Tag a document or pull a prior thread to start.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function InsightCard({ icon, title, value }: InsightCardProps) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/40">
            <div className="flex items-center gap-3 text-white/70">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-grokPurple via-grokPink to-grokBlue text-white">
                    {icon}
                </div>
                <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-white/45">{title}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{value}</p>
                </div>
            </div>
        </div>
    );
}
