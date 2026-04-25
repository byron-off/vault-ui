'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TokenInfo } from '@/types/vault';

const STORAGE_KEY = 'vault-ui:connection';
const TOKEN_INFO_KEY = 'vault-ui:token-info';
const RECENT_ADDRS_KEY = 'vault-ui:recent-addrs';

type ConnectionStore = {
  addr: string | null;
  token: string | null;
  namespace: string;
  tokenInfo: TokenInfo | null;
  recentAddrs: string[];
  setConnection: (addr: string, token: string, tokenInfo: TokenInfo, namespace?: string) => void;
  setTokenInfo: (info: TokenInfo) => void;
  disconnect: () => void;
};

function loadRecentAddrs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_ADDRS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentAddrs(addrs: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RECENT_ADDRS_KEY, JSON.stringify(addrs));
}

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set, get) => ({
      addr: null,
      token: null,
      namespace: '',
      tokenInfo: null,
      recentAddrs: [],

      setConnection: (addr, token, tokenInfo, namespace = '') => {
        const current = get().recentAddrs;
        const filtered = current.filter((a) => a !== addr);
        const updated = [addr, ...filtered].slice(0, 5);
        saveRecentAddrs(updated);

        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_INFO_KEY, JSON.stringify(tokenInfo));
        }

        set({ addr, token, namespace, tokenInfo, recentAddrs: updated });
      },

      setTokenInfo: (tokenInfo) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_INFO_KEY, JSON.stringify(tokenInfo));
        }
        set({ tokenInfo });
      },

      disconnect: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(TOKEN_INFO_KEY);
        }
        set({ addr: null, token: null, namespace: '', tokenInfo: null });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        addr: state.addr,
        token: state.token,
        namespace: state.namespace,
        recentAddrs: loadRecentAddrs(),
      }),
      onRehydrateStorage: () => (state) => {
        if (state && typeof window !== 'undefined') {
          state.recentAddrs = loadRecentAddrs();
          try {
            const raw = localStorage.getItem(TOKEN_INFO_KEY);
            if (raw) state.tokenInfo = JSON.parse(raw);
          } catch {}
        }
      },
    }
  )
);
