import { FormEvent, KeyboardEvent, useEffect, useRef, useState, useMemo, ChangeEvent } from 'react';
import clsx from 'clsx';
import { Paperclip, Sparkles, Plus, X, Search, File, Image, FileText } from 'lucide-react';
import type { ContextCategory } from './Sidebar';
import type { AttachedFile } from '../types/chat';

interface ChatInputProps {
    onSend: (message: string, tags: string[], attachments?: AttachedFile[]) => Promise<void> | void;
    disabled?: boolean;
    contexts: ContextCategory[];
    allContexts: ContextCategory[];
    selectedTags: string[];
    onToggleTag: (tagId: string) => void;
    onResetTags: () => void;
}

export default function ChatInput({ onSend, disabled, contexts, allContexts, selectedTags, onToggleTag, onResetTags }: ChatInputProps) {
    const [message, setMessage] = useState('');
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [contextSearch, setContextSearch] = useState('');
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const addMenuRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const MAX_TEXTAREA_HEIGHT = 240;

    // Filter contexts not already shown in recent list
    const availableToAdd = useMemo(() => {
        const recentIds = new Set(contexts.map(c => c.id));
        return allContexts.filter(c => !recentIds.has(c.id));
    }, [contexts, allContexts]);

    // Filter by search query
    const filteredContexts = useMemo(() => {
        if (!contextSearch.trim()) return availableToAdd;
        const query = contextSearch.toLowerCase();
        return availableToAdd.filter(c => c.title.toLowerCase().includes(query));
    }, [availableToAdd, contextSearch]);

    // Close menu on outside click
    useEffect(() => {
        if (!addMenuOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
                setAddMenuOpen(false);
                setContextSearch('');
            }
        };
        window.addEventListener('mousedown', handleClick);
        return () => window.removeEventListener('mousedown', handleClick);
    }, [addMenuOpen]);

    const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const newFiles: AttachedFile[] = [];
        for (const file of Array.from(files)) {
            // Size limits: 5MB for images/PDFs, 100KB for text
            const isImage = file.type.startsWith('image/');
            const isPdf = file.type === 'application/pdf';
            const maxSize = isImage || isPdf ? 5 * 1024 * 1024 : 100000;

            if (file.size > maxSize) {
                console.warn(`File ${file.name} is too large (max ${isImage || isPdf ? '5MB' : '100KB'})`);
                continue;
            }

            try {
                if (isImage) {
                    // Convert image to base64
                    const base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    newFiles.push({
                        name: file.name,
                        content: base64,
                        size: file.size,
                        type: 'image',
                        mimeType: file.type
                    });
                } else if (isPdf) {
                    // For PDFs, store as base64 for potential server-side processing
                    const base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    newFiles.push({
                        name: file.name,
                        content: base64,
                        size: file.size,
                        type: 'pdf',
                        mimeType: 'application/pdf'
                    });
                } else {
                    // Text-based files
                    const content = await file.text();
                    newFiles.push({
                        name: file.name,
                        content,
                        size: file.size,
                        type: 'text'
                    });
                }
            } catch (err) {
                console.warn(`Failed to read file ${file.name}`, err);
            }
        }
        setAttachedFiles(prev => [...prev, ...newFiles]);
        // Reset input so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeFile = (fileName: string) => {
        setAttachedFiles(prev => prev.filter(f => f.name !== fileName));
    };

    const submitMessage = async () => {
        if (disabled) {
            return;
        }
        const trimmed = message.trim();
        if (!trimmed && attachedFiles.length === 0) {
            return;
        }

        // Pass files separately - App.tsx will handle building the full message for Grok
        const filesToSend = attachedFiles.length > 0 ? [...attachedFiles] : undefined;

        setMessage('');
        setAttachedFiles([]);
        try {
            await onSend(trimmed, selectedTags, filesToSend);
        } catch (error) {
            console.error('Failed to send message', error);
            // Restore the message so the user can retry
            setMessage(trimmed);
            if (filesToSend) setAttachedFiles(filesToSend);
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await submitMessage();
    };

    const handleKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            await submitMessage();
        }
    };

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
            return;
        }

        textarea.style.height = 'auto';
        const nextHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
        textarea.style.height = `${nextHeight}px`;
    }, [message]);

    return (
        <div className="sticky bottom-0 left-0 right-0 bg-transparent px-3 py-2 backdrop-blur z-20">
            <div className="mx-auto w-full max-w-4xl space-y-2.5">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/40">
                        <span>Recent contexts</span>
                        {selectedTags.length === 0 && (
                            <span className="text-grokPink/70 normal-case tracking-normal">(Grok will auto-tag)</span>
                        )}
                        <div className="relative" ref={addMenuRef}>
                            <button
                                type="button"
                                onClick={() => setAddMenuOpen(prev => !prev)}
                                className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.3em] text-white/60 transition hover:border-white/30 hover:text-white"
                            >
                                <Plus className="h-3 w-3" />
                                <span>Add</span>
                            </button>
                            {addMenuOpen && (
                                <div className="absolute left-0 bottom-full mb-2 z-50 w-56 rounded-2xl border border-white/10 bg-secondary/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
                                    <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-2 py-1.5 mb-2">
                                        <Search className="h-3.5 w-3.5 text-white/40" />
                                        <input
                                            type="text"
                                            value={contextSearch}
                                            onChange={e => setContextSearch(e.target.value)}
                                            placeholder="Search contexts..."
                                            className="flex-1 bg-transparent text-xs text-white placeholder:text-white/40 focus:outline-none"
                                            autoFocus
                                        />
                                        {contextSearch && (
                                            <button type="button" onClick={() => setContextSearch('')} className="text-white/40 hover:text-white">
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                        {filteredContexts.length > 0 ? (
                                            filteredContexts.map(ctx => (
                                                <button
                                                    key={ctx.id}
                                                    type="button"
                                                    onClick={() => {
                                                        onToggleTag(ctx.id);
                                                        setAddMenuOpen(false);
                                                        setContextSearch('');
                                                    }}
                                                    className="w-full rounded-xl border border-transparent px-3 py-1.5 text-left text-xs text-white/70 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
                                                >
                                                    {ctx.title}
                                                </button>
                                            ))
                                        ) : (
                                            <p className="px-3 py-2 text-xs text-white/40">No contexts found</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {/* Show recent contexts */}
                        {contexts.map(context => {
                            const isSelected = selectedTags.includes(context.id);
                            return (
                                <button
                                    key={context.id}
                                    type="button"
                                    onClick={() => onToggleTag(context.id)}
                                    className={clsx(
                                        'rounded-full border px-3 py-1 text-xs font-medium transition',
                                        isSelected
                                            ? 'border-white/40 bg-gradient-to-r from-grokPurple/70 via-grokPink/70 to-grokBlue/70 text-white shadow-lg shadow-black/30'
                                            : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30 hover:text-white'
                                    )}
                                >
                                    {context.title}
                                </button>
                            );
                        })}
                        {/* Show additional selected tags not in recent list */}
                        {selectedTags
                            .filter(tagId => !contexts.some(c => c.id === tagId))
                            .map(tagId => {
                                const context = allContexts.find(c => c.id === tagId);
                                if (!context) return null;
                                return (
                                    <button
                                        key={context.id}
                                        type="button"
                                        onClick={() => onToggleTag(context.id)}
                                        className="rounded-full border border-white/40 bg-gradient-to-r from-grokPurple/70 via-grokPink/70 to-grokBlue/70 px-3 py-1 text-xs font-medium text-white shadow-lg shadow-black/30 transition"
                                    >
                                        {context.title}
                                    </button>
                                );
                            })}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 px-2.5 py-2 shadow-lg shadow-black/40">
                    {/* Attached files display */}
                    {attachedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2 px-1">
                            {attachedFiles.map(file => {
                                const FileIcon = file.type === 'image' ? Image : file.type === 'pdf' ? FileText : File;
                                return (
                                    <div
                                        key={file.name}
                                        className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs text-white/80"
                                    >
                                        {file.type === 'image' && file.content ? (
                                            <img src={file.content} alt={file.name} className="h-6 w-6 rounded object-cover" />
                                        ) : (
                                            <FileIcon className={clsx("h-3 w-3", file.type === 'pdf' ? 'text-red-400' : file.type === 'image' ? 'text-blue-400' : 'text-white/50')} />
                                        )}
                                        <span className="max-w-[150px] truncate">{file.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(file.name)}
                                            className="ml-1 text-white/40 hover:text-red-400 transition"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="flex items-end gap-2.5">
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".txt,.md,.json,.csv,.xml,.html,.css,.js,.ts,.tsx,.jsx,.py,.yaml,.yml,.log,.sql,.sh,.bat,.ps1,.env,.gitignore,.dockerfile,.pdf,image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={clsx(
                                "flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition hover:text-white",
                                attachedFiles.length > 0 ? "text-grokPurple" : "text-white/60"
                            )}
                            title="Attach file"
                        >
                            <Paperclip className="h-5 w-5" />
                        </button>
                        <div className="flex-1">
                            <textarea
                                value={message}
                                onChange={event => setMessage(event.target.value)}
                                onKeyDown={handleKeyDown}
                                ref={textareaRef}
                                rows={1}
                                placeholder="Ask Grok to synthesize context…"
                                className="min-h-[2.2rem] max-h-60 w-full resize-none bg-transparent text-sm leading-relaxed text-white placeholder:text-white/40 focus:outline-none"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={disabled || !message.trim()}
                            aria-label="Send message"
                            className="group flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r from-grokPurple via-grokPink to-grokBlue text-white shadow-lg shadow-grokPurple/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Sparkles className="h-5 w-5 transition-transform group-hover:rotate-12" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
