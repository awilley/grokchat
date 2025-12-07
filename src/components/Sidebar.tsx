import {
    useMemo,
    useState,
    useRef,
    useEffect,
    type ComponentType,
    type MouseEvent as ReactMouseEvent,
    type FocusEvent
} from 'react';
import type { ChatMessage } from '../types/chat';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Search, User, ShieldCheck, PanelsTopLeft, Pin, Trash2 } from 'lucide-react';

export interface ContextCategoryItem {
    id: string;
    title: string;
    description?: string;
    emphasis?: boolean;
    updatedAt?: string;
}

export interface ContextCategory {
    id: string;
    title: string;
    description?: string;
    icon: ComponentType<{ className?: string }>;
    accent: string; // Tailwind gradient classes
    items: ContextCategoryItem[];
    pinned?: boolean;
}

export interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
    searchQuery: string;
    onSearchChange: (value: string) => void;
    categories: ContextCategory[];
    messages: ChatMessage[];
    activeCategoryId: string | null;
    onSelectCategory: (categoryId: string | null) => void;
    onAddCategory: () => void;
    onTogglePin: (categoryId: string) => void;
    onRemoveCategory?: (categoryId: string) => void;
    className?: string;
    variant?: 'desktop' | 'mobile';
}

const profileStatus = [
    { id: 'plan', label: 'xAI Tier', value: 'Builder' },
    { id: 'safety', label: 'Guardrails', value: 'Enabled' }
];

const profileActions = [
    { id: 'settings', label: 'Open Settings', description: 'Tune workspace + guardrails' },
    { id: 'profile', label: 'Profile & Presence', description: 'Update availability' },
    { id: 'signout', label: 'Switch / Sign out', description: 'Swap operators' }
];

const BrandGlyph = () => (
    <svg
        className="h-6 w-6"
        viewBox="0 0 34 33"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <g clipPath="url(#brand_mark_clip)">
            <path
                d="M24.3187 12.8506L13.2371 21.0407L29.1114 5.07631V5.09055L33.6964 0.5C33.6139 0.616757 33.5315 0.730667 33.449 0.844576C29.9647 5.64871 28.2637 7.99809 29.629 13.8758L29.6205 13.8673C30.562 17.8683 29.5551 22.3051 26.304 25.5601C22.2053 29.6665 15.6463 30.5806 10.2449 26.8843L14.0108 25.1386C17.4581 26.4941 21.2297 25.899 23.9404 23.1851C26.651 20.4712 27.2597 16.5185 25.8973 13.2294C25.6384 12.6057 24.8619 12.4491 24.3187 12.8506Z"
                fill="currentColor"
            />
            <path
                d="M11.0498 10.2763C7.74186 13.5853 7.07344 19.3235 10.9503 23.0313L10.9474 23.0341L0.363647 32.5C1.02597 31.5868 1.84612 30.7235 2.66565 29.8609L2.69885 29.826L2.70569 29.8188C5.04711 27.3551 7.36787 24.9131 5.94992 21.4622C4.04991 16.8403 5.15635 11.4239 8.6748 7.90126C12.3326 4.24192 17.7198 3.31926 22.2195 5.17313C23.215 5.54334 24.0826 6.07017 24.7595 6.55998L21.0022 8.2971C17.5036 6.82767 13.4959 7.82722 11.0498 10.2763Z"
                fill="currentColor"
            />
        </g>
        <defs>
            <clipPath id="brand_mark_clip">
                <rect width="33.3328" height="32" fill="white" transform="translate(0.363647 0.5)" />
            </clipPath>
        </defs>
    </svg>
);

// Format relative date
function formatLastUsed(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Sidebar({
    isCollapsed,
    onToggle,
    searchQuery,
    onSearchChange,
    categories,
    messages,
    activeCategoryId,
    onSelectCategory,
    onAddCategory,
    onTogglePin,
    onRemoveCategory,
    className,
    variant = 'desktop'
}: SidebarProps) {
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [activeFilterOpen, setActiveFilterOpen] = useState(false);
    const [hoveredSignal, setHoveredSignal] = useState<{ categoryId: string; top: number; left: number } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ categoryId: string; x: number; y: number } | null>(null);
    const profileButtonRef = useRef<HTMLButtonElement | null>(null);
    const profileMenuRef = useRef<HTMLDivElement | null>(null);
    const sidebarRef = useRef<HTMLElement | null>(null);

    // Close context menu on outside click or escape
    useEffect(() => {
        if (!contextMenu) return;
        const handleClick = () => setContextMenu(null);
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setContextMenu(null);
        };
        window.addEventListener('click', handleClick);
        window.addEventListener('keydown', handleEscape);
        return () => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('keydown', handleEscape);
        };
    }, [contextMenu]);

    const handleContextMenu = (e: ReactMouseEvent, categoryId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ categoryId, x: e.clientX, y: e.clientY });
    };

    // Compute last used date per category from message tags
    const categoryLastUsed = useMemo(() => {
        const lastUsedMap = new Map<string, string>();
        // Messages are in chronological order, so iterate backwards for most recent
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.tags && msg.timestamp) {
                for (const tagId of msg.tags) {
                    if (!lastUsedMap.has(tagId)) {
                        lastUsedMap.set(tagId, msg.timestamp);
                    }
                }
            }
        }
        return lastUsedMap;
    }, [messages]);

    // Compute recent user prompts per category (3 most recent)
    const categoryRecentPrompts = useMemo(() => {
        const promptsMap = new Map<string, { content: string; timestamp: string }[]>();
        // Iterate backwards to get most recent first
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role === 'user' && msg.tags) {
                for (const tagId of msg.tags) {
                    const existing = promptsMap.get(tagId) || [];
                    if (existing.length < 3) {
                        existing.push({ content: msg.content, timestamp: msg.timestamp });
                        promptsMap.set(tagId, existing);
                    }
                }
            }
        }
        return promptsMap;
    }, [messages]);

    const filtered = useMemo(() => {
        let result = categories;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(category => category.title.toLowerCase().includes(query));
        }

        // Sort: pinned first, then by last used (most recent first), then alphabetically
        return [...result].sort((a, b) => {
            // Pinned categories always come first
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;

            // Within same pin status, sort by last used
            const aTime = categoryLastUsed.get(a.id);
            const bTime = categoryLastUsed.get(b.id);
            if (aTime && bTime) {
                return new Date(bTime).getTime() - new Date(aTime).getTime();
            }
            if (aTime) return -1;
            if (bTime) return 1;
            return a.title.localeCompare(b.title);
        });
    }, [categories, searchQuery, categoryLastUsed]);

    const isRailMode = isCollapsed && variant === 'desktop';
    const showExpandedSections = !isRailMode;
    const widthClass = isRailMode ? 'w-[4.75rem]' : 'w-80';

    const positionClass = variant === 'desktop' ? 'fixed inset-y-0 left-0' : 'relative';
    const activeCategory = categories.find(category => category.id === activeCategoryId);

    useEffect(() => {
        function handleClickOutside(event: globalThis.MouseEvent) {
            if (!profileMenuOpen) {
                return;
            }

            const buttonEl = profileButtonRef.current;
            const menuEl = profileMenuRef.current;
            if (buttonEl?.contains(event.target as Node) || menuEl?.contains(event.target as Node)) {
                return;
            }

            setProfileMenuOpen(false);
        }

        window.addEventListener('mousedown', handleClickOutside);
        return () => {
            window.removeEventListener('mousedown', handleClickOutside);
        };
    }, [profileMenuOpen]);

    const hoveredCategory = hoveredSignal
        ? categories.find(category => category.id === hoveredSignal.categoryId)
        : null;

    type HoverEvent = ReactMouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>;

    const handleCategoryHover = (event: HoverEvent, categoryId: string) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const sidebarRect = sidebarRef.current?.getBoundingClientRect();
        setHoveredSignal({
            categoryId,
            top: rect.top + rect.height / 2,
            left: (sidebarRect?.right ?? rect.right) + 16
        });
    };

    const handleCategoryLeave = (categoryId: string) => {
        setHoveredSignal(prev => (prev?.categoryId === categoryId ? null : prev));
    };

    return (
        <aside
            className={clsx(
                'z-40 flex h-screen flex-col bg-secondary/95 text-textPrimary shadow-2xl shadow-black/40 ring-1 ring-white/5 backdrop-blur-xl transition-all duration-300',
                positionClass,
                widthClass,
                className
            )}
            ref={sidebarRef}
        >
            <div className={clsx('flex items-center gap-3 pt-6 pb-4', showExpandedSections ? 'px-5 justify-start' : 'px-3 justify-center')}>
                <button
                    type="button"
                    onClick={onToggle}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-transparent text-white shadow-glow transition hover:border-white/40"
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <BrandGlyph />
                </button>
                {showExpandedSections ? (
                    <div className="flex-1 transition-all duration-200">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Grok</p>
                        <p className="text-lg font-semibold tracking-tight text-white">Context Engine</p>
                    </div>
                ) : null}
                {variant === 'desktop' && !isCollapsed && (
                    <button
                        type="button"
                        onClick={onToggle}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
                        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </button>
                )}
            </div>

            <div className={clsx(showExpandedSections ? 'px-4' : 'px-2')}>
                {showExpandedSections && (
                    <>
                        <div className="mt-4 rounded-2xl border border-white/5 bg-primary/60 p-4 shadow-inner shadow-black/40">
                            <button
                                type="button"
                                onClick={() => setActiveFilterOpen(prev => !prev)}
                                className="flex w-full items-center justify-between text-left text-xs uppercase tracking-[0.3em] text-white/50"
                            >
                                <span>Active Filter</span>
                                <span className="text-[11px] text-white/40">{activeFilterOpen ? 'Collapse' : 'Expand'}</span>
                            </button>
                            <p className="mt-2 text-lg font-semibold text-white">
                                {activeCategory ? activeCategory.title : 'All contexts'}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-white/40">
                                <span>{activeCategory ? 'Filter applied' : 'No filter'}</span>
                                {activeCategory && (
                                    <button
                                        type="button"
                                        onClick={() => onSelectCategory(null)}
                                        className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            {activeFilterOpen && (
                                <p className="mt-1 text-xs text-white/50">
                                    The infinite chat feed only shows prompts tagged with this context. Switch contexts or multi-tag inputs to
                                    remix the stream.
                                </p>
                            )}
                        </div>

                        <div className="mt-4 rounded-2xl border border-white/5 bg-primary/60 p-3 shadow-inner shadow-black/40">
                            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-secondary/80 px-3 py-2 text-sm text-white/70">
                                <Search className="h-4 w-4" />
                                <input
                                    value={searchQuery}
                                    onChange={event => onSearchChange(event.target.value)}
                                    placeholder="Search a context..."
                                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                                />
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/30">
                                <PanelsTopLeft className="h-3.5 w-3.5" />
                                <span>Context Mesh</span>
                                <button
                                    type="button"
                                    onClick={onAddCategory}
                                    className="ml-auto rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.25em] text-white/70 transition hover:border-white/40 hover:text-white"
                                >
                                    Add Context
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <nav className={clsx('mt-4 flex-1 overflow-y-auto pb-6', showExpandedSections ? 'px-3' : 'px-2')}>
                <div className="space-y-2">
                    {filtered.map(category => {
                        const Icon = category.icon;
                        const isActive = category.id === activeCategoryId;
                        return (
                            <div key={category.id} className="group relative">
                                <button
                                    type="button"
                                    onClick={() => onSelectCategory(category.id)}
                                    onContextMenu={e => handleContextMenu(e, category.id)}
                                    onMouseEnter={event => handleCategoryHover(event, category.id)}
                                    onFocus={event => handleCategoryHover(event, category.id)}
                                    onMouseLeave={() => handleCategoryLeave(category.id)}
                                    onBlur={() => handleCategoryLeave(category.id)}
                                    className={clsx(
                                        'flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-1.5 text-left transition',
                                        isActive
                                            ? 'border-white/15 bg-white/10 text-white'
                                            : 'text-white/70 hover:border-white/10 hover:bg-white/5 hover:text-white',
                                        isRailMode && 'justify-center px-0 py-2.5'
                                    )}
                                    title={category.title}
                                >
                                    <span
                                        className={clsx(
                                            'flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg shadow-black/40 transition-all duration-200',
                                            category.accent,
                                            {
                                                'scale-100 opacity-100': !isCollapsed || variant === 'mobile',
                                                'scale-90 opacity-90': isCollapsed && variant === 'desktop'
                                            }
                                        )}
                                    >
                                        <Icon className="h-[18px] w-[18px]" />
                                    </span>
                                    {showExpandedSections && (
                                        <div className="min-w-0 flex-1 transition-all duration-200">
                                            <p className="text-sm font-semibold leading-tight">{category.title}</p>
                                            <p className="text-xs text-white/45">
                                                {categoryLastUsed.get(category.id)
                                                    ? formatLastUsed(categoryLastUsed.get(category.id)!)
                                                    : 'Not used yet'}
                                            </p>
                                        </div>
                                    )}
                                </button>
                                {showExpandedSections && (
                                    <button
                                        type="button"
                                        onClick={e => {
                                            e.stopPropagation();
                                            onTogglePin(category.id);
                                        }}
                                        className={clsx(
                                            'absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition',
                                            category.pinned
                                                ? 'text-grokPink hover:bg-white/10'
                                                : 'text-white/30 opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-white'
                                        )}
                                        title={category.pinned ? 'Unpin' : 'Pin to top'}
                                    >
                                        <Pin className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </nav>

            {hoveredSignal && (() => {
                const recentPrompts = categoryRecentPrompts.get(hoveredSignal.categoryId) || [];
                if (recentPrompts.length === 0) return null;
                return (
                    <div
                        className="pointer-events-none fixed z-50 w-72 -translate-y-1/2 space-y-2 rounded-2xl border border-white/10 bg-secondary/95 p-3 text-sm text-white shadow-2xl shadow-black/40"
                        style={{ top: hoveredSignal.top, left: hoveredSignal.left }}
                    >
                        <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Recent Prompts</p>
                        {recentPrompts.map((prompt, idx) => (
                            <div
                                key={idx}
                                className="rounded-xl border border-white/5 bg-secondary/80 px-3 py-2 text-xs text-white/70 shadow-sm"
                            >
                                <p className="line-clamp-2 font-medium">{prompt.content}</p>
                                <p className="mt-1 text-[10px] text-white/40">{formatLastUsed(prompt.timestamp)}</p>
                            </div>
                        ))}
                    </div>
                );
            })()}

            {showExpandedSections && (
                <div className="space-y-5 px-4 pb-6">
                    <div className="relative group">
                        <button
                            type="button"
                            ref={profileButtonRef}
                            onClick={() => setProfileMenuOpen(prev => !prev)}
                            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-secondary/70 px-3 py-3 text-left transition hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                            aria-haspopup="true"
                            aria-expanded={profileMenuOpen}
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-grokPurple to-grokBlue">
                                <User className="h-5 w-5 text-white" />
                            </div>
                            <div className="min-w-0 flex-1 text-sm">
                                <p className="font-medium text-white">Aaron Willey</p>
                                <p className="text-xs text-white/45">Inference sandbox • 32 contexts</p>
                            </div>
                            <div className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.25em] text-white/35">
                                {profileStatus.map(item => (
                                    <div key={item.id} className="flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3" />
                                        <span>{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </button>

                        <div
                            ref={profileMenuRef}
                            className={clsx(
                                'absolute bottom-[calc(100%+0.75rem)] right-0 z-50 w-64 flex-col rounded-2xl border border-white/10 bg-secondary/95 p-3 text-sm text-white shadow-2xl shadow-black/50 transition',
                                profileMenuOpen ? 'flex' : 'hidden'
                            )}
                        >
                            <p className="text-[11px] uppercase tracking-[0.3em] text-white/45">Workspace</p>
                            <div className="mt-2 space-y-1.5">
                                {profileActions.map(action => (
                                    <button
                                        key={action.id}
                                        type="button"
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/80 transition hover:border-white/30 hover:text-white"
                                    >
                                        <p className="font-medium uppercase tracking-[0.25em] text-[11px]">{action.label}</p>
                                        <p className="mt-1 text-[11px] text-white/50">{action.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Right-click context menu */}
            {contextMenu && onRemoveCategory && (
                <div
                    className="fixed z-[400] min-w-[160px] rounded-xl border border-white/20 bg-[#1a1a2e] py-1 shadow-2xl shadow-black/60"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={() => {
                            onRemoveCategory(contextMenu.categoryId);
                            setContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/10 transition"
                    >
                        <Trash2 className="h-4 w-4" />
                        Remove Category
                    </button>
                </div>
            )}
        </aside>
    );
}
