'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  AppWindow,
  KeyRound,
  Database,
  Shield,
  Users,
  Clock,
  Globe,
  Settings,
  ChevronDown,
  ChevronRight,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConnectionStore } from '@/lib/store';
import { useState, useEffect } from 'react';

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Applications', href: '/apps', icon: AppWindow },
  { label: 'Secrets', href: '/secrets', icon: KeyRound },
  { label: 'Secret Engines', href: '/engines', icon: Database },
  { label: 'Auth Methods', href: '/auth', icon: Shield },
  { label: 'Policies', href: '/policies', icon: Shield },
  {
    label: 'Identity',
    icon: Users,
    children: [
      { label: 'Entities', href: '/identity/entities' },
      { label: 'Groups', href: '/identity/groups' },
      { label: 'Aliases', href: '/identity/aliases' },
      { label: 'OIDC', href: '/identity/oidc' },
      { label: 'MFA', href: '/identity/mfa' },
    ],
  },
  { label: 'Leases', href: '/leases', icon: Clock },
  { label: 'Namespaces', href: '/namespaces', icon: Globe },
  { label: 'System', href: '/system', icon: Settings },
];

function NavLink({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {label}
    </Link>
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { addr, tokenInfo, disconnect } = useConnectionStore();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ Identity: true });

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const truncatedAddr = addr
    ? addr.replace(/^https?:\/\//, '').slice(0, 24) + (addr.length > 32 ? '…' : '')
    : null;

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-[220px] flex flex-col border-r bg-background z-30',
          'transition-transform duration-200 ease-in-out',
          // Mobile: slide in/out. Desktop: always visible.
          open ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0 md:z-10'
        )}
      >
        {/* Logo + close button (mobile) */}
        <div className="px-4 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">OpenBao UI</span>
          </div>
          <button
            className="md:hidden p-1 rounded hover:bg-accent text-muted-foreground"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            if (item.children) {
              const isExpanded = expandedGroups[item.label];
              const isActive = item.children.some((c) => pathname.startsWith(c.href));
              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleGroup(item.label)}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="ml-6 mt-0.5 space-y-0.5">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.href}
                          href={child.href}
                          label={child.label}
                          active={pathname === child.href || pathname.startsWith(child.href + '/')}
                          onNavigate={onClose}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href!}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  pathname === item.href || pathname.startsWith(item.href! + '/')
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Connection status */}
        <div className="px-3 py-3 border-t space-y-1">
          <div className="flex items-center gap-2">
            {addr ? (
              <Wifi className="w-3 h-3 text-green-600 shrink-0" />
            ) : (
              <WifiOff className="w-3 h-3 text-muted-foreground shrink-0" />
            )}
            <span className="text-xs text-muted-foreground font-mono truncate" title={addr || ''}>
              {truncatedAddr || 'Not connected'}
            </span>
          </div>
          {tokenInfo && (
            <p className="text-xs text-muted-foreground truncate pl-5">{tokenInfo.display_name}</p>
          )}
          <button
            onClick={disconnect}
            className="text-xs text-muted-foreground hover:text-destructive pl-5 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </aside>
    </>
  );
}
