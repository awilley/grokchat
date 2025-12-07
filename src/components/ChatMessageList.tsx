import { useEffect, useRef, type HTMLAttributes } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';
import { Trash2, File, Image, FileText } from 'lucide-react';
import type { ChatMessage } from '../types/chat';
import type { ContextCategory } from './Sidebar';

interface ChatMessageListProps {
    messages: ChatMessage[];
    isAssistantTyping: boolean;
    categories?: ContextCategory[];
    messageRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
    onDeleteMessage?: (messageId: string) => void;
}

const roleConfig = {
    assistant: {
        bubble: 'bg-white/8 border-white/10 text-white',
        label: 'Grok'
    },
    user: {
        bubble: 'bg-white/8 border-white/10 text-white',
        label: 'You'
    },
    system: {
        bubble: 'bg-grokPurple/10 border-grokPurple/40 text-white/80',
        label: 'System'
    }
} as const;

const CodeRenderer = ({ inline, ...props }: HTMLAttributes<HTMLElement> & { inline?: boolean }) =>
    inline ? (
        <code className="rounded-md bg-white/10 px-1 py-0.5 text-xs text-white" {...props} />
    ) : (
        <code className="block rounded-2xl bg-black/40 px-4 py-3 text-xs text-white" {...props} />
    );

const markdownComponents: Components = {
    p: ({ node, ...props }) => (
        <p className="mb-3 text-sm leading-relaxed text-white/90 last:mb-0" {...props} />
    ),
    ul: ({ node, ...props }) => (
        <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-white/90 last:mb-0" {...props} />
    ),
    ol: ({ node, ...props }) => (
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-white/90 last:mb-0" {...props} />
    ),
    li: ({ node, ...props }) => (
        <li className="text-sm leading-relaxed text-white/90" {...props} />
    ),
    strong: ({ node, ...props }) => (
        <strong className="text-white" {...props} />
    ),
    a: ({ node, ...props }) => (
        <a className="text-grokBlue underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />
    ),
    code: CodeRenderer
};

export default function ChatMessageList({ messages, isAssistantTyping, messageRefs, categories, onDeleteMessage }: ChatMessageListProps) {
    const endRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages, isAssistantTyping]);

    return (
        <div className="px-6 pt-8 pb-28">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                {messages.filter(m => m.role !== 'system').map(message => {
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
                            className={clsx('group relative flex w-full flex-col gap-2', isUser && 'items-end')}
                        >
                            {/* Delete button - only show for user messages (which will delete the pair) */}
                            {isUser && onDeleteMessage && (
                                <button
                                    type="button"
                                    onClick={() => onDeleteMessage(message.id)}
                                    className="absolute -left-2 top-0 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-secondary/90 text-white/40 opacity-0 transition hover:border-red-500/50 hover:text-red-400 group-hover:opacity-100"
                                    title="Delete this message pair"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            )}
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
                                        {message.tags.map(tagId => {
                                            const label = categories?.find(cat => cat.id === tagId)?.title ?? tagId;
                                            return (
                                                <span
                                                    key={tagId}
                                                    className="rounded-lg bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/40"
                                                >
                                                    {label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div
                                className={clsx(
                                    'w-full rounded-3xl border p-4 shadow-lg shadow-black/30 backdrop-blur-sm',
                                    config.bubble,
                                    'sm:max-w-[85%]',
                                    isUser && 'self-end'
                                )}
                            >
                                <div className="space-y-3">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                        {message.content}
                                    </ReactMarkdown>
                                </div>
                                {/* Display attachments as compact pills */}
                                {message.attachments && message.attachments.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {message.attachments.map((file, idx) => {
                                            const FileIcon = file.type === 'image' ? Image : file.type === 'pdf' ? FileText : File;
                                            return (
                                                <div
                                                    key={`${file.name}-${idx}`}
                                                    className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs"
                                                >
                                                    {file.type === 'image' && file.content?.startsWith('data:') ? (
                                                        <img src={file.content} alt={file.name} className="h-5 w-5 rounded object-cover" />
                                                    ) : (
                                                        <FileIcon className={clsx(
                                                            "h-3.5 w-3.5",
                                                            file.type === 'pdf' ? 'text-red-400' : file.type === 'image' ? 'text-blue-400' : 'text-white/50'
                                                        )} />
                                                    )}
                                                    <span className="max-w-[120px] truncate text-white/70">{file.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
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
