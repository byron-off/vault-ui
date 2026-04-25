'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { Plus, Search, Trash2, Eye, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

import { useApplications } from '@/hooks/use-apps';
import { getApplication } from '@/lib/vault/api/apps';
import { deleteAclPolicy } from '@/lib/vault/api/policies';
import { deleteAppRole } from '@/lib/vault/api/approle';
import { deleteApplicationMetadata } from '@/lib/vault/api/apps';
import { relativeTime } from '@/lib/utils';
import type { Application } from '@/types/app';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EnvFilter = 'all' | 'prod' | 'staging' | 'dev';

function EnvBadge({ env }: { env: Application['env'] }) {
  if (env === 'prod') {
    return <Badge className="border-transparent bg-green-100 text-green-800">prod</Badge>;
  }
  if (env === 'staging') {
    return <Badge className="border-transparent bg-blue-100 text-blue-800">staging</Badge>;
  }
  return <Badge className="border-transparent bg-yellow-100 text-yellow-800">dev</Badge>;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation with sequential cleanup
// ---------------------------------------------------------------------------

function DeleteAppDialog({
  app,
  onDeleted,
}: {
  app: Application;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAclPolicy(app.policy_name);
    } catch {
      // best-effort; policy may already be gone
    }
    try {
      await deleteAppRole(app.approle_name);
    } catch {
      // best-effort
    }
    try {
      await deleteApplicationMetadata(app.app_name);
    } catch (err) {
      toast.error('Failed to delete application metadata', {
        description: err instanceof Error ? err.message : String(err),
      });
      setDeleting(false);
      setOpen(false);
      return;
    }
    toast.success(`Application "${app.app_name}" deleted`);
    setDeleting(false);
    setOpen(false);
    onDeleted();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete {app.app_name}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete application?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the application{' '}
            <span className="font-semibold text-foreground">{app.app_name}</span>, along with its
            ACL policy (<code className="text-xs">{app.policy_name}</code>) and AppRole (
            <code className="text-xs">{app.approle_name}</code>). This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AppsPage() {
  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState<EnvFilter>('all');
  const [deletedNames, setDeletedNames] = useState<Set<string>>(new Set());

  const { data: names, isLoading: namesLoading, error: namesError } = useApplications();

  // Batch-fetch all app details once the name list is available
  const appQueries = useQueries({
    queries: (names ?? []).map((name) => ({
      queryKey: ['apps', 'detail', name],
      queryFn: () => getApplication(name),
      enabled: !!name,
    })),
  });

  const isLoading = namesLoading || (appQueries.length > 0 && appQueries.some((q) => q.isLoading));

  // Flatten loaded apps
  const apps: Application[] = appQueries
    .filter((q) => q.data !== undefined)
    .map((q) => q.data as Application)
    .filter((app) => !deletedNames.has(app.app_name));

  // Filter
  const filtered = apps.filter((app) => {
    const matchesSearch =
      search.trim() === '' ||
      app.app_name.toLowerCase().includes(search.toLowerCase()) ||
      app.description?.toLowerCase().includes(search.toLowerCase());
    const matchesEnv = envFilter === 'all' || app.env === envFilter;
    return matchesSearch && matchesEnv;
  });

  function handleDeleted(name: string) {
    setDeletedNames((prev) => new Set(prev).add(name));
  }

  // ---- Error state ----
  if (namesError) {
    return (
      <div className="space-y-4">
        <PageHeader />
        <Alert variant="destructive">
          <AlertTitle>Failed to load applications</AlertTitle>
          <AlertDescription>
            {namesError instanceof Error ? namesError.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const showEmpty = !isLoading && filtered.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search applications…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={envFilter} onValueChange={(v) => setEnvFilter(v as EnvFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Environment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All environments</SelectItem>
            <SelectItem value="prod">prod</SelectItem>
            <SelectItem value="staging">staging</SelectItem>
            <SelectItem value="dev">dev</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Env</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>KV Path</TableHead>
              <TableHead>Policy</TableHead>
              <TableHead>AppRole</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <SkeletonRows />
            ) : showEmpty ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState hasFilter={search !== '' || envFilter !== 'all'} />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((app) => (
                <TableRow key={app.app_name}>
                  {/* Name */}
                  <TableCell className="font-medium">
                    <Link
                      href={`/apps/${app.app_name}`}
                      className="text-primary hover:underline underline-offset-2"
                    >
                      {app.app_name}
                    </Link>
                  </TableCell>

                  {/* Env badge */}
                  <TableCell>
                    <EnvBadge env={app.env} />
                  </TableCell>

                  {/* Description */}
                  <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                    {app.description || <span className="text-muted-foreground/50 italic">—</span>}
                  </TableCell>

                  {/* KV Path */}
                  <TableCell>
                    <code className="text-xs text-muted-foreground font-mono">{app.kv_path}</code>
                  </TableCell>

                  {/* Policy */}
                  <TableCell className="text-sm text-muted-foreground">{app.policy_name}</TableCell>

                  {/* AppRole */}
                  <TableCell className="text-sm text-muted-foreground">{app.approle_name}</TableCell>

                  {/* Created */}
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {relativeTime(app.created_at)}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/apps/${app.app_name}`}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View {app.app_name}</span>
                        </Link>
                      </Button>
                      <DeleteAppDialog
                        app={app}
                        onDeleted={() => handleDeleted(app.app_name)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PageHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage applications and their associated secrets, policies, and credentials.
        </p>
      </div>
      <Button asChild>
        <Link href="/apps/new">
          <Plus className="h-4 w-4 mr-2" />
          Create Application
        </Link>
      </Button>
    </div>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  if (hasFilter) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground text-sm">No applications match your filters.</p>
        <p className="text-muted-foreground text-xs mt-1">Try adjusting your search or environment filter.</p>
      </div>
    );
  }

  return (
    <div className="py-16 text-center">
      <p className="text-lg font-medium">No applications yet</p>
      <p className="text-muted-foreground text-sm mt-1 mb-6">
        Create your first application to get started.
      </p>
      <Button asChild>
        <Link href="/apps/new">
          <Plus className="h-4 w-4 mr-2" />
          Create Application
        </Link>
      </Button>
    </div>
  );
}
