'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Search,
  Layers,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  listLeasePrefixes,
  lookupLease,
  renewLease,
  revokeLease,
  revokePrefix,
  revokeForce,
  tidyLeases,
  getLeasesCount,
} from '@/lib/vault/api/leases';
import type { LeaseInfo } from '@/types/vault';
import { formatTTL, relativeTime } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function looksLikeLeaseId(key: string): boolean {
  return UUID_RE.test(key);
}

// ---------------------------------------------------------------------------
// Prefix tree node
// ---------------------------------------------------------------------------

interface TreeNodeProps {
  prefix: string;
  depth: number;
  selected: string | null;
  onSelect: (prefix: string) => void;
  expanded: Set<string>;
  onToggle: (prefix: string) => void;
  childMap: Map<string, string[]>;
  loadingSet: Set<string>;
}

function TreeNode({
  prefix,
  depth,
  selected,
  onSelect,
  expanded,
  onToggle,
  childMap,
  loadingSet,
}: TreeNodeProps) {
  const isExpanded = expanded.has(prefix);
  const isSelected = selected === prefix;
  const isLoading = loadingSet.has(prefix);
  const children = childMap.get(prefix) ?? [];
  // Show expand arrow only for folder-like prefixes (end with /)
  const isFolder = prefix.endsWith('/');

  return (
    <div>
      <button
        onClick={() => {
          onSelect(prefix);
          if (isFolder) onToggle(prefix);
        }}
        className={`flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${
          isSelected ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {isFolder ? (
          isLoading ? (
            <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {isFolder ? (
          <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        ) : (
          <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
        )}
        <span className="truncate font-mono text-xs">{prefix}</span>
      </button>

      {isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child}
              prefix={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              expanded={expanded}
              onToggle={onToggle}
              childMap={childMap}
              loadingSet={loadingSet}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Left pane — prefix tree
// ---------------------------------------------------------------------------

interface PrefixTreeProps {
  selected: string | null;
  onSelect: (prefix: string) => void;
}

function PrefixTree({ selected, onSelect }: PrefixTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childMap, setChildMap] = useState<Map<string, string[]>>(new Map());
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set());

  const {
    data: roots,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['leases', 'prefixes', ''],
    queryFn: async () => {
      try {
        return await listLeasePrefixes('');
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });

  async function handleToggle(prefix: string) {
    if (expanded.has(prefix)) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(prefix);
        return next;
      });
      return;
    }
    // Expand — load children if not already loaded
    if (!childMap.has(prefix)) {
      setLoadingSet((prev) => new Set(prev).add(prefix));
      try {
        const children = await listLeasePrefixes(prefix);
        setChildMap((prev) => new Map(prev).set(prefix, children));
      } catch {
        setChildMap((prev) => new Map(prev).set(prefix, []));
      } finally {
        setLoadingSet((prev) => {
          const next = new Set(prev);
          next.delete(prefix);
          return next;
        });
      }
    }
    setExpanded((prev) => new Set(prev).add(prefix));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Lease Prefixes
        </span>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => refetch()}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="p-1">
          {isLoading ? (
            <div className="space-y-1 p-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-7 w-full rounded-md" />
              ))}
            </div>
          ) : error ? (
            <p className="px-3 py-2 text-xs text-destructive">Failed to load prefixes.</p>
          ) : !roots || roots.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Layers className="h-8 w-8 opacity-30" />
              <p className="text-xs">No leases found.</p>
            </div>
          ) : (
            roots.map((prefix) => (
              <TreeNode
                key={prefix}
                prefix={prefix}
                depth={0}
                selected={selected}
                onSelect={onSelect}
                expanded={expanded}
                onToggle={handleToggle}
                childMap={childMap}
                loadingSet={loadingSet}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lease detail dialog
// ---------------------------------------------------------------------------

interface LeaseDetailDialogProps {
  leaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function LeaseDetailDialog({ leaseId, open, onOpenChange }: LeaseDetailDialogProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['leases', 'lookup', leaseId],
    queryFn: () => lookupLease(leaseId),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lease Details</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to lookup lease.'}
            </AlertDescription>
          </Alert>
        ) : data ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Lease ID
              </dt>
              <dd className="mt-1 break-all font-mono text-xs">{data.id}</dd>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Issued
                </dt>
                <dd className="mt-1">{relativeTime(data.issue_time)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Expires
                </dt>
                <dd className="mt-1">{relativeTime(data.expire_time)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  TTL Remaining
                </dt>
                <dd className="mt-1">{data.ttl > 0 ? formatTTL(data.ttl) : 'expired'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Renewable
                </dt>
                <dd className="mt-1">
                  <Badge variant={data.renewable ? 'success' : 'secondary'}>
                    {data.renewable ? 'Yes' : 'No'}
                  </Badge>
                </dd>
              </div>
              {data.last_renewal && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Last Renewed
                  </dt>
                  <dd className="mt-1">{relativeTime(data.last_renewal)}</dd>
                </div>
              )}
            </div>
          </dl>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Renew lease dialog
// ---------------------------------------------------------------------------

interface RenewLeaseDialogProps {
  leaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RenewLeaseDialog({ leaseId, open, onOpenChange }: RenewLeaseDialogProps) {
  const [increment, setIncrement] = useState('');
  const queryClient = useQueryClient();

  const renewMut = useMutation({
    mutationFn: () => renewLease(leaseId, increment ? parseInt(increment, 10) : undefined),
    onSuccess: (data) => {
      toast.success(`Lease renewed. New TTL: ${formatTTL(data.ttl)}`);
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(`Failed to renew lease: ${err.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Renew Lease</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Optionally specify an increment in seconds. Leave blank to use the default.
          </p>
          <div className="space-y-1">
            <label className="text-xs font-medium">Increment (seconds)</label>
            <Input
              type="number"
              placeholder="e.g. 3600"
              value={increment}
              onChange={(e) => setIncrement(e.target.value)}
              min={1}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => renewMut.mutate()} disabled={renewMut.isPending}>
            {renewMut.isPending ? 'Renewing…' : 'Renew'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Lease row
// ---------------------------------------------------------------------------

interface LeaseRowProps {
  leaseId: string;
  onRevoked: () => void;
}

function LeaseRow({ leaseId, onRevoked }: LeaseRowProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: lease, isLoading } = useQuery({
    queryKey: ['leases', 'lookup', leaseId],
    queryFn: async () => {
      try {
        return await lookupLease(leaseId);
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  const revokeMut = useMutation({
    mutationFn: () => revokeLease(leaseId),
    onSuccess: () => {
      toast.success('Lease revoked.');
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      onRevoked();
    },
    onError: (err: Error) => {
      toast.error(`Failed to revoke lease: ${err.message}`);
    },
  });

  return (
    <>
      <TableRow>
        <TableCell className="font-mono text-xs max-w-[220px]">
          <span className="truncate block" title={leaseId}>
            {leaseId}
          </span>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {isLoading ? <Skeleton className="h-4 w-24" /> : lease ? relativeTime(lease.issue_time) : '—'}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {isLoading ? <Skeleton className="h-4 w-24" /> : lease ? relativeTime(lease.expire_time) : '—'}
        </TableCell>
        <TableCell className="text-xs">
          {isLoading ? (
            <Skeleton className="h-4 w-12" />
          ) : lease ? (
            <span className={lease.ttl <= 300 ? 'text-amber-600 font-medium' : ''}>
              {formatTTL(lease.ttl)}
            </span>
          ) : (
            '—'
          )}
        </TableCell>
        <TableCell>
          {isLoading ? (
            <Skeleton className="h-5 w-12" />
          ) : lease ? (
            <Badge variant={lease.renewable ? 'success' : 'secondary'}>
              {lease.renewable ? 'Yes' : 'No'}
            </Badge>
          ) : null}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDetailOpen(true)}>
              <Search className="mr-1 h-3 w-3" />
              Lookup
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setRenewOpen(true)}
              disabled={!lease?.renewable}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Renew
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  disabled={revokeMut.isPending}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Revoke
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke this lease?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The lease <span className="font-mono text-xs">{leaseId}</span> will be
                    immediately revoked. Associated credentials will be invalidated.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => revokeMut.mutate()}
                  >
                    Revoke
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TableCell>
      </TableRow>

      <LeaseDetailDialog leaseId={leaseId} open={detailOpen} onOpenChange={setDetailOpen} />
      <RenewLeaseDialog leaseId={leaseId} open={renewOpen} onOpenChange={setRenewOpen} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Right pane — prefix details
// ---------------------------------------------------------------------------

interface PrefixPaneProps {
  prefix: string;
}

function PrefixPane({ prefix }: PrefixPaneProps) {
  const queryClient = useQueryClient();
  const [revokedLeases, setRevokedLeases] = useState<Set<string>>(new Set());

  // Fetch children of this prefix
  const {
    data: keys,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['leases', 'prefixes', prefix],
    queryFn: async () => {
      try {
        return await listLeasePrefixes(prefix);
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });

  const leaseIds = (keys ?? []).filter(looksLikeLeaseId).filter((id) => !revokedLeases.has(id));
  const subPrefixes = (keys ?? []).filter((k) => !looksLikeLeaseId(k));
  const isRoot = prefix === '' || prefix === '/';

  // Bulk actions
  const revokePrefixMut = useMutation({
    mutationFn: () => revokePrefix(prefix),
    onSuccess: () => {
      toast.success(`All leases under "${prefix}" revoked.`);
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      refetch();
    },
    onError: (err: Error) => toast.error(`Revoke prefix failed: ${err.message}`),
  });

  const revokeForceMut = useMutation({
    mutationFn: () => revokeForce(prefix),
    onSuccess: () => {
      toast.success(`Force-revoked all leases under "${prefix}".`);
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      refetch();
    },
    onError: (err: Error) => toast.error(`Force revoke failed: ${err.message}`),
  });

  const tidyMut = useMutation({
    mutationFn: tidyLeases,
    onSuccess: () => toast.success('Lease tidy operation started.'),
    onError: (err: Error) => toast.error(`Tidy failed: ${err.message}`),
  });

  // Double confirmation state for force revoke
  const [forceConfirm1, setForceConfirm1] = useState(false);
  const [forceConfirm2, setForceConfirm2] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Selected prefix</p>
          <p className="font-mono text-sm font-medium break-all">{prefix || '(root)'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isRoot && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => tidyMut.mutate()}
              disabled={tidyMut.isPending}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${tidyMut.isPending ? 'animate-spin' : ''}`} />
              {tidyMut.isPending ? 'Tidying…' : 'Tidy'}
            </Button>
          )}

          {/* Revoke Prefix */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={revokePrefixMut.isPending}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Revoke Prefix
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke all leases under this prefix?</AlertDialogTitle>
                <AlertDialogDescription>
                  All leases under <span className="font-mono font-medium">"{prefix}"</span> will be
                  revoked. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => revokePrefixMut.mutate()}
                >
                  Revoke All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Force Revoke — two-step */}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setForceConfirm1(true)}
            disabled={revokeForceMut.isPending}
          >
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
            Revoke Force
          </Button>

          {/* Step 1 */}
          <AlertDialog open={forceConfirm1} onOpenChange={setForceConfirm1}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Force revoke all leases?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will forcefully revoke all leases under{' '}
                  <span className="font-mono font-medium">"{prefix}"</span>, bypassing normal
                  revocation logic. Use with extreme caution.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    setForceConfirm1(false);
                    setForceConfirm2(true);
                  }}
                >
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Step 2 — extra dangerous */}
          <AlertDialog open={forceConfirm2} onOpenChange={setForceConfirm2}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Final confirmation — force revoke
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Are you absolutely sure? Force-revoking leases under{' '}
                  <span className="font-mono font-medium">"{prefix}"</span> will skip all
                  revocation plugins. Secrets may not be properly cleaned up in the backend.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    setForceConfirm2(false);
                    revokeForceMut.mutate();
                  }}
                >
                  Force Revoke
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : 'Failed to load leases.'}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Sub-prefixes */}
              {subPrefixes.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Folder className="h-4 w-4 text-amber-500" />
                    Sub-prefixes
                    <Badge variant="secondary">{subPrefixes.length}</Badge>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {subPrefixes.map((sp) => (
                      <Badge key={sp} variant="outline" className="font-mono text-xs">
                        {sp}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Lease table */}
              {leaseIds.length > 0 ? (
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    Leases
                    <Badge variant="secondary">{leaseIds.length}</Badge>
                  </h3>
                  <div className="rounded-md border overflow-hidden">
                    <div className="overflow-x-auto"><Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Lease ID</TableHead>
                          <TableHead className="text-xs">Issued</TableHead>
                          <TableHead className="text-xs">Expires</TableHead>
                          <TableHead className="text-xs">TTL</TableHead>
                          <TableHead className="text-xs">Renewable</TableHead>
                          <TableHead className="text-xs">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaseIds.map((id) => (
                          <LeaseRow
                            key={id}
                            leaseId={id}
                            onRevoked={() =>
                              setRevokedLeases((prev) => new Set(prev).add(id))
                            }
                          />
                        ))}
                      </TableBody>
                    </Table></div>
                  </div>
                </div>
              ) : subPrefixes.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                  <Clock className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No leases found under this prefix.</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lease count badge
// ---------------------------------------------------------------------------

function LeaseCountBadge() {
  const { data } = useQuery({
    queryKey: ['leases', 'count'],
    queryFn: async () => {
      try {
        return await getLeasesCount();
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  if (!data) return null;

  return (
    <Badge variant="secondary" className="ml-2">
      {data.count} lease{data.count !== 1 ? 's' : ''}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LeasesPage() {
  const [selectedPrefix, setSelectedPrefix] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Leases
            <LeaseCountBadge />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse, inspect, and manage active leases.
          </p>
        </div>
      </div>

      {/* Two-pane layout */}
      <div className="flex flex-col md:flex-row gap-0 border rounded-lg overflow-hidden" style={{ minHeight: '400px', height: 'calc(100vh - 180px)' }}>
        {/* Left pane */}
        <div className="md:w-72 shrink-0 border-b md:border-b-0 md:border-r bg-muted/20" style={{ maxHeight: '40vh', overflow: 'auto' }}>
          <PrefixTree selected={selectedPrefix} onSelect={setSelectedPrefix} />
        </div>

        {/* Right pane */}
        <div className="flex-1 overflow-auto min-h-[250px]">
          {selectedPrefix !== null ? (
            <PrefixPane key={selectedPrefix} prefix={selectedPrefix} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <Layers className="h-12 w-12 opacity-20" />
              <p className="text-sm">Select a lease prefix to browse leases.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
