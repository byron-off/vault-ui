'use client';

import { Menu, Clock } from 'lucide-react';
import { useConnectionStore } from '@/lib/store';
import { formatTTL } from '@/lib/utils';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { tokenInfo } = useConnectionStore();

  return (
    <header className="fixed top-0 left-0 right-0 md:left-[220px] h-12 border-b bg-background flex items-center px-4 md:px-6 gap-3 z-10">
      {/* Hamburger — only visible on mobile */}
      <button
        className="md:hidden p-1 -ml-1 rounded hover:bg-accent text-muted-foreground"
        onClick={onMenuClick}
        aria-label="Toggle navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      {tokenInfo && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3 shrink-0" />
          {tokenInfo.ttl > 0 ? (
            <span>TTL: {formatTTL(tokenInfo.ttl)}</span>
          ) : (
            <span>No expiry</span>
          )}
          <span className="text-border hidden sm:inline">|</span>
          <span className="font-mono hidden sm:inline">{tokenInfo.accessor.slice(0, 12)}…</span>
        </div>
      )}
    </header>
  );
}
