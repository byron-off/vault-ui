'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useConnectionStore } from '@/lib/store';
import { vaultFetch } from '@/lib/vault/client';

const WARN_THRESHOLD = 5 * 60;   // warn at 5 min remaining
const AUTO_RENEW_THRESHOLD = 60; // auto-renew at 60 s remaining
const CHECK_INTERVAL = 30_000;   // check every 30 s

export function useTokenRenewal() {
  const { tokenInfo, setTokenInfo, token } = useConnectionStore();
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!token || !tokenInfo || tokenInfo.ttl <= 0) return;

    const check = async () => {
      const { tokenInfo: current } = useConnectionStore.getState();
      if (!current || current.ttl <= 0) return;

      // Re-fetch current TTL
      try {
        const res = await vaultFetch<{ data: typeof current }>('/auth/token/lookup-self');
        const fresh = res.data;
        setTokenInfo(fresh);

        if (fresh.ttl <= AUTO_RENEW_THRESHOLD && fresh.renewable) {
          const renewed = await vaultFetch<{ auth: { lease_duration: number } }>(
            '/auth/token/renew-self', { method: 'POST', body: {} }
          );
          const newTtl = renewed.auth?.lease_duration ?? fresh.ttl;
          setTokenInfo({ ...fresh, ttl: newTtl });
          toast.success(`Token auto-renewed (TTL: ${newTtl}s)`);
          warnedRef.current = false;
          return;
        }

        if (fresh.ttl <= WARN_THRESHOLD && !warnedRef.current) {
          warnedRef.current = true;
          toast.warning(`Token expires in ${Math.round(fresh.ttl / 60)} min`, {
            duration: 10_000,
            action: fresh.renewable
              ? {
                  label: 'Renew now',
                  onClick: async () => {
                    try {
                      const r = await vaultFetch<{ auth: { lease_duration: number } }>(
                        '/auth/token/renew-self', { method: 'POST', body: {} }
                      );
                      setTokenInfo({ ...fresh, ttl: r.auth?.lease_duration ?? fresh.ttl });
                      toast.success('Token renewed');
                      warnedRef.current = false;
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  },
                }
              : undefined,
          });
        } else if (fresh.ttl > WARN_THRESHOLD) {
          warnedRef.current = false;
        }
      } catch {
        // Ignore transient errors; disconnection is handled elsewhere
      }
    };

    const id = setInterval(check, CHECK_INTERVAL);
    return () => clearInterval(id);
  }, [token, tokenInfo?.ttl, setTokenInfo]); // eslint-disable-line react-hooks/exhaustive-deps
}
