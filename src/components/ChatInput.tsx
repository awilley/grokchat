import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Paperclip, Sparkles } from 'lucide-react';
import type { ContextCategory } from './Sidebar';

interface ChatInputProps {
    onSend: (message: string, tags: string[]) => Promise<void> | void;
    disabled?: boolean;
    contexts: ContextCategory[];
    selectedTags: string[];
    onToggleTag: (tagId: string) => void;
    onResetTags: () => void;
}

const quickPrompts = [
    'Summarize last deployment risks',
    'Generate follow-up experiment plan',
    'What context is missing?'
];

export default function ChatInput({ onSend, disabled, contexts, selectedTags, onToggleTag, onResetTags }: ChatInputProps) {
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const MAX_TEXTAREA_HEIGHT = 240;

    const submitMessage = async () => {
        if (disabled) {
            return;
        }
        const trimmed = message.trim();
        if (!trimmed) {
            return;
        }

        setMessage('');
        try {
            await onSend(trimmed, selectedTags);
        } catch (error) {
            console.error('Failed to send message', error);
            // Restore the message so the user can retry
            setMessage(trimmed);
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
                <div className="flex flex-wrap gap-1.5">
                    {quickPrompts.map(prompt => (
                        <button
                            key={prompt}
                            type="button"
                            onClick={() => setMessage(prompt)}
                            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-white/70 transition hover:border-grokPurple/60 hover:text-white"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/40">
                        <span>Tag contexts</span>
                        <button
                            type="button"
                            onClick={onResetTags}
                            className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.3em] text-white/60 transition hover:border-white/30 hover:text-white"
                        >
                            Reset
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
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
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 px-2.5 py-2 shadow-lg shadow-black/40">
                    <div className="flex items-end gap-2.5">
                        <button
                            type="button"
                            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/60 transition hover:text-white"
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
