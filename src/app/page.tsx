'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useConnectionStore } from '@/lib/store';
import { lookupSelfToken } from '@/lib/vault/api/auth';

export default function RootPage() {
  const router = useRouter();
  const { addr, token, setTokenInfo, disconnect } = useConnectionStore();

  useEffect(() => {
    if (!addr || !token) {
      router.replace('/login');
      return;
    }

    lookupSelfToken()
      .then((info) => {
        setTokenInfo(info);
        router.replace('/dashboard');
      })
      .catch(() => {
        disconnect();
        router.replace('/login');
      });
  }, [addr, token, router, setTokenInfo, disconnect]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
