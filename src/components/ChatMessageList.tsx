import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import type { ChatMessage } from '../types/chat';

interface ChatMessageListProps {
    messages: ChatMessage[];
    isAssistantTyping: boolean;
    messageRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

const roleConfig = {
    assistant: {
        bubble: 'bg-white/8 border-white/10 text-white',
        label: 'Grok'
    },
    user: {
        bubble: 'bg-grokBlue/10 border-grokBlue/40 text-white',
        label: 'You'
    },
    system: {
        bubble: 'bg-grokPurple/10 border-grokPurple/40 text-white/80',
        label: 'System'
    }
} as const;

export default function ChatMessageList({ messages, isAssistantTyping, messageRefs }: ChatMessageListProps) {
    const endRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages, isAssistantTyping]);

    return (
        <div className="px-6 pt-8 pb-28">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                {messages.map(message => {
                    const config = roleConfig[message.role];
                    const isUser = message.role === 'user';
                    return (
                        <div
                            key={message.id}
                            ref={el => {
                                if (el && messageRefs) {
                                    messageRefs.current.set(message.id, el);
                                }
                            }}
                            className={clsx('flex w-full flex-col gap-2', isUser && 'items-end')}
                        >
                            <div
                                className={clsx(
                                    'flex w-full flex-wrap items-baseline gap-3 text-xs text-white/45',
                                    isUser && 'justify-end text-right text-white/60'
                                )}
                            >
                                <span
                                    className={clsx(
                                        'font-semibold uppercase tracking-[0.3em] text-white/60',
                                        isUser && 'text-white'
                                    )}
                                >
                                    {config.label}
                                </span>
                                <span className={clsx('text-white/50', isUser && 'text-white/70')}>
                                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {message.tags && message.tags.length > 0 && (
                                    <div className={clsx('flex flex-wrap gap-1', isUser && 'justify-end w-full')}>
                                        {message.tags.map(tag => (
                                            <span key={tag} className="rounded-lg bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/40">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div
                                className={clsx(
                                    'w-full rounded-3xl border p-4 shadow-lg shadow-black/30 backdrop-blur-sm',
                                    config.bubble,
                                    'sm:max-w-[75%]',
                                    isUser && 'self-end'
                                )}
                            >
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{message.content}</p>
                                {message.summary && (
                                    <p className="mt-3 text-xs text-white/60">{message.summary}</p>
                                )}
                            </div>
                        </div>
                    );
                })}

                {isAssistantTyping && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 text-xs text-white/45">
                            <span className="font-semibold uppercase tracking-[0.3em] text-white/60">Grok</span>
                            <span>Drafting insight…</span>
                        </div>
                        <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/30">
                            <div className="flex gap-2">
                                <span className="h-2 w-2 animate-pulse rounded-full bg-white/60" />
                                <span className="h-2 w-2 animate-pulse rounded-full bg-white/40 delay-150" />
                                <span className="h-2 w-2 animate-pulse rounded-full bg-white/25 delay-300" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={endRef} />
            </div>
        </div>
    );
}
