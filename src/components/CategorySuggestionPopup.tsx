import { useState, type ComponentType } from 'react';
import clsx from 'clsx';
import { X, Check, Sparkles, Search, Loader2 } from 'lucide-react';

export interface CategorySuggestion {
    type: 'new' | 'existing';
    existingCategoryId?: string;
    newCategory?: {
        title: string;
        description?: string;
        icon?: string;
        accent?: string;
    };
    reasoning: string;
}

export interface ExistingCategory {
    id: string;
    title: string;
    icon: ComponentType<{ className?: string }>;
    accent: string;
}

interface CategorySuggestionPopupProps {
    suggestion: CategorySuggestion;
    existingCategories: ExistingCategory[];
    onAcceptSuggestion: () => void;
    onSelectExisting: (categoryId: string) => void;
    onForceClosest: () => void;
    onDismiss: () => void;
    isLoading?: boolean;
}

export default function CategorySuggestionPopup({
    suggestion,
    existingCategories,
    onAcceptSuggestion,
    onSelectExisting,
    onForceClosest,
    onDismiss,
    isLoading = false
}: CategorySuggestionPopupProps) {
    const [showExistingList, setShowExistingList] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCategories = existingCategories.filter(cat =>
        cat.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const suggestedExisting = suggestion.type === 'existing'
        ? existingCategories.find(c => c.id === suggestion.existingCategoryId)
        : null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-md mx-4 rounded-3xl border border-white/15 bg-[#1a1a2e] shadow-2xl shadow-black/60">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                    <h2 className="text-lg font-semibold text-white">
                        {isLoading ? 'Processing...' : 'Categorize This Message'}
                    </h2>
                    {!isLoading && (
                        <button
                            type="button"
                            onClick={onDismiss}
                            className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="px-6 py-5">
                    {/* Grok's reasoning */}
                    <div className="mb-5 rounded-2xl bg-white/5 p-4 border border-white/10">
                        <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Grok suggests</p>
                        <p className="text-sm text-white/80">{suggestion.reasoning}</p>
                    </div>

                    {/* Suggestion preview */}
                    {suggestion.type === 'new' && suggestion.newCategory && (
                        <div className="mb-5">
                            <p className="text-xs uppercase tracking-wider text-white/40 mb-3">Create new category</p>
                            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-4">
                                <span className={clsx(
                                    'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg',
                                    suggestion.newCategory.accent || 'from-grokPurple to-grokBlue'
                                )}>
                                    <Sparkles className="h-5 w-5" />
                                </span>
                                <div>
                                    <p className="font-semibold text-white">{suggestion.newCategory.title}</p>
                                    {suggestion.newCategory.description && (
                                        <p className="text-xs text-white/50">{suggestion.newCategory.description}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {suggestion.type === 'existing' && suggestedExisting && (
                        <div className="mb-5">
                            <p className="text-xs uppercase tracking-wider text-white/40 mb-3">Use existing category</p>
                            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-4">
                                <span className={clsx(
                                    'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg',
                                    suggestedExisting.accent
                                )}>
                                    <suggestedExisting.icon className="h-5 w-5" />
                                </span>
                                <div>
                                    <p className="font-semibold text-white">{suggestedExisting.title}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-grokPurple" />
                            <p className="text-sm text-white/70">Working on it...</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={onAcceptSuggestion}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-grokPurple to-grokBlue px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl hover:scale-[1.02]"
                            >
                                <Check className="h-4 w-4" />
                                Accept Suggestion
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowExistingList(!showExistingList)}
                                className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                            >
                                Choose Different Category
                            </button>

                            {suggestion.type === 'new' && (
                                <button
                                    type="button"
                                    onClick={onForceClosest}
                                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-white/50 transition hover:bg-white/5 hover:text-white/70"
                                >
                                    Use Closest Existing Category Instead
                                </button>
                            )}
                        </div>
                    )}

                    {/* Existing categories list */}
                    {showExistingList && !isLoading && (
                        <div className="mt-4 border-t border-white/10 pt-4">
                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search categories..."
                                    className="w-full rounded-xl border border-white/15 bg-black/20 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                                />
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                                {filteredCategories.map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => onSelectExisting(cat.id)}
                                        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/10"
                                    >
                                        <span className={clsx(
                                            'flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white',
                                            cat.accent
                                        )}>
                                            <cat.icon className="h-4 w-4" />
                                        </span>
                                        <span className="text-sm text-white/80">{cat.title}</span>
                                    </button>
                                ))}
                                {filteredCategories.length === 0 && (
                                    <p className="text-center text-sm text-white/40 py-4">No categories found</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
