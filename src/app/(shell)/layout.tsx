'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useConnectionStore } from '@/lib/store';

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { addr, token } = useConnectionStore();

  useEffect(() => {
    if (!addr || !token) {
      router.replace('/login');
    }
  }, [addr, token, router]);

  if (!addr || !token) return null;

  return (
    <div className="min-h-screen">
      <Sidebar />
      <Header />
      <main className="ml-[220px] mt-12 p-8 max-w-[1280px]">{children}</main>
    </div>
  );
}
