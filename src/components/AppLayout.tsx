import { Menu } from 'lucide-react';
import Sidebar, { type SidebarProps } from './Sidebar';
import clsx from 'clsx';

interface AppLayoutProps {
    sidebarProps: SidebarProps;
    isMobileMenuOpen: boolean;
    onMobileMenuOpen: () => void;
    onMobileMenuClose: () => void;
    children: React.ReactNode;
}

export default function AppLayout({
    sidebarProps,
    isMobileMenuOpen,
    onMobileMenuClose,
    onMobileMenuOpen,
    children
}: AppLayoutProps) {
    const desktopPadding = sidebarProps.isCollapsed ? 'sm:pl-[4.75rem]' : 'sm:pl-80';

    return (
        <div className="flex min-h-screen bg-primary text-textPrimary">
            <div className="hidden sm:block">
                <Sidebar {...sidebarProps} />
            </div>

            {isMobileMenuOpen && (
                <div className="sm:hidden fixed inset-0 z-40">
                    <div className="absolute inset-0 bg-black/60" onClick={onMobileMenuClose} aria-hidden="true" />
                    <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">
                        <Sidebar {...sidebarProps} isCollapsed={false} variant="mobile" />
                    </div>
                </div>
            )}

            <main
                className={clsx(
                    'flex-1 w-full h-screen max-h-screen overflow-hidden transition-all duration-300 flex flex-col',
                    desktopPadding
                )}
            >
                <div className="sm:hidden sticky top-0 z-30 border-b border-white/5 bg-secondary/90 backdrop-blur">
                    <div className="flex items-center justify-between px-4 py-3">
                        <button
                            type="button"
                            onClick={onMobileMenuOpen}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
                            aria-label="Open navigation menu"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">Grok Chat</span>
                        <span className="inline-block h-11 w-11" aria-hidden="true" />
                    </div>
                </div>
                <div className="flex-1 min-h-0 flex flex-col">
                    {children}
                </div>
            </main>
        </div>
    );
}
