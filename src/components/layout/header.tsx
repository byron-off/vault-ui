'use client';

import { useConnectionStore } from '@/lib/store';
import { formatTTL } from '@/lib/utils';
import { Clock } from 'lucide-react';

export function Header() {
  const { tokenInfo } = useConnectionStore();

  return (
    <header className="fixed top-0 left-[220px] right-0 h-12 border-b bg-background flex items-center px-6 gap-4 z-10">
      <div className="flex-1" />
      {tokenInfo && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {tokenInfo.ttl > 0 ? (
            <span>TTL: {formatTTL(tokenInfo.ttl)}</span>
          ) : (
            <span>No expiry</span>
          )}
          <span className="text-border">|</span>
          <span className="font-mono">{tokenInfo.accessor.slice(0, 12)}…</span>
        </div>
      )}
    </header>
  );
}
