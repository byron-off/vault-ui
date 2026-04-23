'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck,
  ShieldOff,
  Database,
  KeyRound,
  FileText,
  User,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

import { getSealStatus, getVersionHistory } from '@/lib/vault/api/sys';
import { listMounts, listAuthMounts } from '@/lib/vault/api/mounts';
import { listAclPolicies } from '@/lib/vault/api/policies';
import { lookupSelfToken } from '@/lib/vault/api/auth';
import { useConnectionStore } from '@/lib/store';
import { formatTTL, relativeTime } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

function ErrorAlert({ title, message }: { title: string; message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// Status Banner
// ---------------------------------------------------------------------------

function StatusBanner() {
  const { data: sealStatus, isLoading, error } = useQuery({
    queryKey: ['sys', 'seal-status'],
    queryFn: getSealStatus,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-60" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !sealStatus) {
    return (
      <ErrorAlert
        title="Could not load seal status"
        message={error instanceof Error ? error.message : 'Unknown error'}
      />
    );
  }

  const sealed = sealStatus.sealed;

  return (
    <Card
      className={
        sealed
          ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700'
          : 'border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-700'
      }
    >
      <CardContent className="py-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {/* Icon + seal state */}
          <div className="flex items-center gap-3">
            {sealed ? (
              <ShieldOff className="h-8 w-8 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400 shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base">Seal State</span>
                <Badge variant={sealed ? 'warning' : 'success'}>
                  {sealed ? 'Sealed' : 'Unsealed'}
                </Badge>
              </div>
              {sealed && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Unseal progress: {sealStatus.progress}/{sealStatus.t} keys provided
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-8 border-l border-current opacity-20 hidden sm:block" />

          {/* Version */}
          <div className="text-sm">
            <span className="text-muted-foreground">Version</span>
            <p className="font-mono font-medium">{sealStatus.version}</p>
          </div>

          {/* Cluster name */}
          {sealStatus.cluster_name && (
            <>
              <div className="h-8 border-l border-current opacity-20 hidden sm:block" />
              <div className="text-sm">
                <span className="text-muted-foreground">Cluster</span>
                <p className="font-medium">{sealStatus.cluster_name}</p>
              </div>
            </>
          )}

          {/* Seal type */}
          <div className="text-sm">
            <span className="text-muted-foreground">Seal Type</span>
            <p className="font-medium capitalize">{sealStatus.type}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Stat Cards Grid
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  title,
  value,
  description,
  isLoading,
  error,
}: {
  icon: React.ElementType;
  title: string;
  value: React.ReactNode;
  description?: string;
  isLoading: boolean;
  error: Error | null;
}) {
  if (isLoading) return <StatCardSkeleton />;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">Failed to load</p>
        ) : (
          <>
            <div className="text-3xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatsGrid() {
  const {
    data: mounts,
    isLoading: mountsLoading,
    error: mountsError,
  } = useQuery({
    queryKey: ['sys', 'mounts'],
    queryFn: listMounts,
    staleTime: 60_000,
  });

  const {
    data: authMounts,
    isLoading: authLoading,
    error: authError,
  } = useQuery({
    queryKey: ['sys', 'auth-mounts'],
    queryFn: listAuthMounts,
    staleTime: 60_000,
  });

  const {
    data: policies,
    isLoading: policiesLoading,
    error: policiesError,
  } = useQuery({
    queryKey: ['policies', 'acl'],
    queryFn: listAclPolicies,
    staleTime: 60_000,
  });

  const {
    data: selfToken,
    isLoading: tokenLoading,
    error: tokenError,
  } = useQuery({
    queryKey: ['auth', 'lookup-self'],
    queryFn: lookupSelfToken,
    staleTime: 30_000,
  });

  const mountCount = mounts ? Object.keys(mounts).length : null;
  const authCount = authMounts ? Object.keys(authMounts).length : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        icon={Database}
        title="Secret Engines"
        value={mountCount ?? '—'}
        description={
          mountCount !== null
            ? `${mountCount} mount${mountCount !== 1 ? 's' : ''} configured`
            : undefined
        }
        isLoading={mountsLoading}
        error={mountsError as Error | null}
      />
      <StatCard
        icon={KeyRound}
        title="Auth Methods"
        value={authCount ?? '—'}
        description={
          authCount !== null
            ? `${authCount} method${authCount !== 1 ? 's' : ''} enabled`
            : undefined
        }
        isLoading={authLoading}
        error={authError as Error | null}
      />
      <StatCard
        icon={FileText}
        title="ACL Policies"
        value={policies?.length ?? '—'}
        description={
          policies !== undefined
            ? `${policies.length} polic${policies.length !== 1 ? 'ies' : 'y'} defined`
            : undefined
        }
        isLoading={policiesLoading}
        error={policiesError as Error | null}
      />
      <StatCard
        icon={User}
        title="Token"
        value={
          selfToken
            ? selfToken.display_name
            : '—'
        }
        description={
          selfToken?.ttl
            ? `TTL: ${formatTTL(selfToken.ttl)}`
            : selfToken
              ? 'No expiry'
              : undefined
        }
        isLoading={tokenLoading}
        error={tokenError as Error | null}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Token Info Card
// ---------------------------------------------------------------------------

function TokenInfoCard() {
  const { tokenInfo } = useConnectionStore();

  const {
    data: selfToken,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['auth', 'lookup-self'],
    queryFn: lookupSelfToken,
    staleTime: 30_000,
  });

  // Prefer live data from API; fall back to store
  const token = selfToken ?? tokenInfo;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Current Token</CardTitle>
        </div>
        <CardDescription>Details about the authenticated session token.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && !token ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : error && !token ? (
          <ErrorAlert
            title="Could not load token info"
            message={error instanceof Error ? error.message : 'Unknown error'}
          />
        ) : token ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {/* Display name */}
            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Display Name
              </dt>
              <dd className="font-medium">{token.display_name || '—'}</dd>
            </div>

            {/* Accessor */}
            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Accessor
              </dt>
              <dd className="font-mono text-xs break-all">{token.accessor || '—'}</dd>
            </div>

            {/* TTL */}
            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                TTL
              </dt>
              <dd>
                {token.ttl
                  ? formatTTL(token.ttl)
                  : token.expire_time
                    ? relativeTime(token.expire_time)
                    : 'No expiry'}
              </dd>
            </div>

            {/* Renewable */}
            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Renewable
              </dt>
              <dd>
                <Badge variant={token.renewable ? 'success' : 'secondary'}>
                  {token.renewable ? 'Yes' : 'No'}
                </Badge>
              </dd>
            </div>

            {/* Policies */}
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Policies
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {token.policies && token.policies.length > 0 ? (
                  token.policies.map((policy) => (
                    <Badge key={policy} variant="secondary">
                      {policy}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs">No policies attached</span>
                )}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No token information available.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Version History
// ---------------------------------------------------------------------------

function VersionHistorySection() {
  const [expanded, setExpanded] = useState(false);

  const {
    data: versions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sys', 'version-history'],
    queryFn: getVersionHistory,
    staleTime: 300_000,
  });

  const displayedVersions = expanded ? versions : versions?.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Version History</CardTitle>
            <CardDescription className="mt-1">
              Past OpenBao versions deployed on this cluster.
            </CardDescription>
          </div>
          {versions && versions.length > 3 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <>
                  Show less <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Show all ({versions.length}) <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorAlert
            title="Could not load version history"
            message={error instanceof Error ? error.message : 'Unknown error'}
          />
        ) : !versions || versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No version history available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium">Version</th>
                  <th className="text-left py-2 pr-4 font-medium">Build Date</th>
                  <th className="text-left py-2 font-medium">Previous Version</th>
                </tr>
              </thead>
              <tbody>
                {displayedVersions?.map((v, idx) => (
                  <tr
                    key={v.version}
                    className={`border-b last:border-0 transition-colors ${
                      idx === 0 ? 'bg-muted/30' : ''
                    }`}
                  >
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{v.version}</span>
                        {idx === 0 && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                            current
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {v.build_date ? relativeTime(v.build_date) : '—'}
                    </td>
                    <td className="py-2.5 text-muted-foreground font-mono text-xs">
                      {v.previous_version ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Cluster overview and status.</p>
      </div>

      {/* Status banner */}
      <StatusBanner />

      {/* 4-column stat cards */}
      <StatsGrid />

      {/* Token info card */}
      <TokenInfoCard />

      {/* Version history (collapsible) */}
      <VersionHistorySection />
    </div>
  );
}
