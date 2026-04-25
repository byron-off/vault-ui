'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useConnectionStore } from '@/lib/store';

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { addr, token } = useConnectionStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!addr || !token) {
      router.replace('/login');
    }
  }, [addr, token, router]);

  if (!addr || !token) return null;

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onMenuClick={() => setSidebarOpen((v) => !v)} />
      <main className="md:ml-[220px] mt-12 p-4 md:p-8 max-w-[1280px]">{children}</main>
    </div>
  );
}
