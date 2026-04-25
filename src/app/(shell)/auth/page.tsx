'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Key,
  Shield,
  Globe,
  User,
  Users,
  GitBranch,
  Settings2,
  Trash2,
  Plus,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useAuthMounts, useEnableAuthMethod, useDisableAuthMethod } from '@/hooks/use-mounts';
import type { AuthMount } from '@/types/vault';

// ─── Auth type icon ──────────────────────────────────────────────────────────

function AuthTypeIcon({ type }: { type: string }) {
  const cls = 'w-4 h-4 shrink-0';
  switch (type) {
    case 'token':
      return <Key className={cls} />;
    case 'approle':
      return <Shield className={cls} />;
    case 'jwt':
    case 'oidc':
      return <Globe className={cls} />;
    case 'userpass':
      return <User className={cls} />;
    case 'ldap':
      return <Users className={cls} />;
    case 'github':
      return <GitBranch className={cls} />;
    default:
      return <Shield className={cls} />;
  }
}

// ─── Auth type display name ───────────────────────────────────────────────────

function authTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    token: 'Token',
    approle: 'AppRole',
    jwt: 'JWT',
    oidc: 'OIDC',
    userpass: 'Username & Password',
    ldap: 'LDAP',
    github: 'GitHub',
    radius: 'RADIUS',
    kubernetes: 'Kubernetes',
    aws: 'AWS',
  };
  return labels[type] ?? type;
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-24" />
            </div>
          </TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell />
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}

// ─── Enable Auth Dialog ───────────────────────────────────────────────────────

const AUTH_TYPES = [
  'approle',
  'jwt',
  'oidc',
  'userpass',
  'ldap',
  'github',
  'token',
  'radius',
  'kubernetes',
  'aws',
] as const;

interface EnableAuthDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function EnableAuthDialog({ open, onOpenChange }: EnableAuthDialogProps) {
  const [authType, setAuthType] = useState('');
  const [path, setPath] = useState('');
  const [description, setDescription] = useState('');

  const enableAuth = useEnableAuthMethod();

  function reset() {
    setAuthType('');
    setPath('');
    setDescription('');
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleTypeChange(value: string) {
    setAuthType(value);
    if (!path || path === authType) {
      setPath(value);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authType || !path) return;

    const normalizedPath = path.endsWith('/') ? path : `${path}/`;

    enableAuth.mutate(
      { path: normalizedPath, opts: { type: authType, description: description || undefined } },
      {
        onSuccess: () => {
          toast.success(`Auth method "${normalizedPath}" enabled`);
          handleOpenChange(false);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enable Auth Method</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="auth-type">
              Type <span className="text-destructive">*</span>
            </Label>
            <Select value={authType} onValueChange={handleTypeChange}>
              <SelectTrigger id="auth-type">
                <SelectValue placeholder="Select auth method type…" />
              </SelectTrigger>
              <SelectContent>
                {AUTH_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {authTypeLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-path">
              Path <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-1">
              <Input
                id="auth-path"
                placeholder="e.g. approle"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="font-mono"
              />
              <span className="text-muted-foreground text-sm font-mono shrink-0">/</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Mount path: <span className="font-mono">{path ? `${path}/` : '<path>/'}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-desc">Description</Label>
            <Input
              id="auth-desc"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!authType || !path || enableAuth.isPending}>
              {enableAuth.isPending ? 'Enabling…' : 'Enable'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Auth mount row ───────────────────────────────────────────────────────────

function AuthMountRow({
  mountPath,
  mount,
  onDisable,
}: {
  mountPath: string;
  mount: AuthMount;
  onDisable: (path: string) => void;
}) {
  // Strip trailing slash for link
  const cleanPath = mountPath.replace(/\/$/, '');

  return (
    <TableRow className="group cursor-pointer hover:bg-muted/50">
      <TableCell>
        <Link
          href={`/auth/${cleanPath}`}
          className="flex items-center gap-2 text-sm font-medium"
        >
          <AuthTypeIcon type={mount.type} />
          <span>{authTypeLabel(mount.type)}</span>
        </Link>
      </TableCell>
      <TableCell>
        <Link href={`/auth/${cleanPath}`} className="font-mono text-sm text-muted-foreground hover:text-foreground">
          {mountPath}
        </Link>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-[200px]">
        <span className="truncate block">{mount.description || <span className="italic opacity-50">—</span>}</span>
      </TableCell>
      <TableCell>
        <span className="font-mono text-xs text-muted-foreground truncate block max-w-[140px]" title={mount.accessor}>
          {mount.accessor}
        </span>
      </TableCell>
      <TableCell>
        {mount.local && (
          <Badge variant="secondary" className="text-xs">local</Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href={`/auth/${cleanPath}`}>
              <Settings2 className="w-3.5 h-3.5" />
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                disabled={mount.type === 'token'}
                title={mount.type === 'token' ? 'Token auth cannot be disabled' : 'Disable auth method'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disable auth method?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will disable the <strong>{mountPath}</strong> auth method. All tokens issued
                  through this method will be immediately revoked. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => onDisable(mountPath)}
                >
                  Disable
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuthMethodsPage() {
  const [enableOpen, setEnableOpen] = useState(false);

  const { data: mounts, isLoading, error } = useAuthMounts();
  const disableAuth = useDisableAuthMethod();

  function handleDisable(path: string) {
    disableAuth.mutate(path, {
      onSuccess: () => toast.success(`Auth method "${path}" disabled`),
      onError: (err) => toast.error(err.message),
    });
  }

  const entries = mounts ? Object.entries(mounts) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auth Methods</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage authentication backends for your OpenBao instance.
          </p>
        </div>
        <Button onClick={() => setEnableOpen(true)}>
          <Plus className="w-4 h-4" />
          Enable Method
        </Button>
      </div>

      <Separator />

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Type</TableHead>
              <TableHead className="w-[160px]">Path</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[160px]">Accessor</TableHead>
              <TableHead className="w-[80px]" />
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                  No auth methods found.
                </TableCell>
              </TableRow>
            ) : (
              entries.map(([mountPath, mount]) => (
                <AuthMountRow
                  key={mountPath}
                  mountPath={mountPath}
                  mount={mount}
                  onDisable={handleDisable}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EnableAuthDialog open={enableOpen} onOpenChange={setEnableOpen} />
    </div>
  );
}
