'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Database,
  Plus,
  Trash2,
  Settings,
  Key,
  Shield,
  Lock,
  Clock,
  Zap,
  Globe,
  Server,
  GitBranch,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

import { useMounts, useEnableMount, useDisableMount } from '@/hooks/use-mounts';
import { vaultFetch } from '@/lib/vault/client';
import { formatTTL } from '@/lib/utils';
import type { MountConfig } from '@/types/vault';

// ---------------------------------------------------------------------------
// Engine type icon
// ---------------------------------------------------------------------------

function EngineIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? 'h-4 w-4';
  switch (type) {
    case 'kv':
      return <Database className={cls} />;
    case 'pki':
      return <Lock className={cls} />;
    case 'transit':
      return <Zap className={cls} />;
    case 'totp':
      return <Clock className={cls} />;
    case 'database':
      return <Server className={cls} />;
    case 'ssh':
      return <GitBranch className={cls} />;
    case 'aws':
    case 'azure':
    case 'gcp':
      return <Globe className={cls} />;
    case 'cubbyhole':
      return <Key className={cls} />;
    default:
      return <Shield className={cls} />;
  }
}

// ---------------------------------------------------------------------------
// Enable Engine Dialog
// ---------------------------------------------------------------------------

const ENGINE_TYPES = [
  'kv-v2',
  'kv',
  'pki',
  'transit',
  'totp',
  'database',
  'ssh',
  'aws',
  'azure',
  'gcp',
  'cubbyhole',
  'generic',
] as const;

interface EnableEngineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EnableEngineDialog({ open, onOpenChange }: EnableEngineDialogProps) {
  const enableMount = useEnableMount();

  const [engineType, setEngineType] = useState('kv-v2');
  const [path, setPath] = useState('');
  const [description, setDescription] = useState('');
  const [kvVersion, setKvVersion] = useState('2');
  const [defaultTTL, setDefaultTTL] = useState('');
  const [maxTTL, setMaxTTL] = useState('');
  const [pathError, setPathError] = useState('');

  function resetForm() {
    setEngineType('kv-v2');
    setPath('');
    setDescription('');
    setKvVersion('2');
    setDefaultTTL('');
    setMaxTTL('');
    setPathError('');
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  function validatePath(value: string) {
    if (!value.trim()) {
      setPathError('Path is required.');
      return false;
    }
    if (value.includes('/')) {
      setPathError('Path must not contain slashes.');
      return false;
    }
    setPathError('');
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validatePath(path)) return;

    const normalizedPath = path.endsWith('/') ? path : `${path}/`;
    const isKv = engineType === 'kv-v2' || engineType === 'kv';

    const opts: { type: string; description?: string; options?: Record<string, string> } = {
      type: engineType === 'kv-v2' ? 'kv' : engineType,
      description: description || undefined,
    };

    const options: Record<string, string> = {};
    if (isKv) {
      options.version = engineType === 'kv-v2' ? '2' : kvVersion;
    }
    if (defaultTTL) options.default_lease_ttl = defaultTTL;
    if (maxTTL) options.max_lease_ttl = maxTTL;
    if (Object.keys(options).length > 0) opts.options = options;

    try {
      await enableMount.mutateAsync({ path: normalizedPath, opts });
      toast.success(`Engine "${normalizedPath}" enabled.`);
      handleOpenChange(false);
    } catch (err: unknown) {
      toast.error(`Failed to enable engine: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const isKvType = engineType === 'kv' || engineType === 'kv-v2';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enable Secret Engine</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Engine type */}
          <div className="space-y-1.5">
            <Label htmlFor="engine-type">Engine Type</Label>
            <Select value={engineType} onValueChange={setEngineType}>
              <SelectTrigger id="engine-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGINE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Path */}
          <div className="space-y-1.5">
            <Label htmlFor="engine-path">
              Path <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-1">
              <Input
                id="engine-path"
                placeholder="my-engine"
                value={path}
                onChange={(e) => {
                  setPath(e.target.value);
                  if (pathError) validatePath(e.target.value);
                }}
                onBlur={() => validatePath(path)}
              />
              <span className="text-muted-foreground text-sm">/</span>
            </div>
            {pathError && <p className="text-xs text-destructive">{pathError}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="engine-description">Description</Label>
            <Input
              id="engine-description"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* KV version selector (only for plain kv) */}
          {engineType === 'kv' && (
            <div className="space-y-1.5">
              <Label htmlFor="kv-version">KV Version</Label>
              <Select value={kvVersion} onValueChange={setKvVersion}>
                <SelectTrigger id="kv-version">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">v1 (unversioned)</SelectItem>
                  <SelectItem value="2">v2 (versioned)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* TTL options */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="default-ttl">Default Lease TTL</Label>
              <Input
                id="default-ttl"
                placeholder="e.g. 768h"
                value={defaultTTL}
                onChange={(e) => setDefaultTTL(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max-ttl">Max Lease TTL</Label>
              <Input
                id="max-ttl"
                placeholder="e.g. 8760h"
                value={maxTTL}
                onChange={(e) => setMaxTTL(e.target.value)}
              />
            </div>
          </div>

          {/* isKvType note — suppress unused warning */}
          {isKvType && engineType === 'kv-v2' && (
            <p className="text-xs text-muted-foreground">
              KV v2 enables secret versioning. Version will be set to 2.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={enableMount.isPending}>
              {enableMount.isPending ? 'Enabling…' : 'Enable Engine'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Tune Dialog
// ---------------------------------------------------------------------------

interface TuneDialogProps {
  mount: MountConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function TuneDialog({ mount, open, onOpenChange }: TuneDialogProps) {
  const [description, setDescription] = useState('');
  const [defaultTTL, setDefaultTTL] = useState('');
  const [maxTTL, setMaxTTL] = useState('');
  const [saving, setSaving] = useState(false);

  // Populate from mount when dialog opens
  function handleOpenChange(next: boolean) {
    if (next && mount) {
      setDescription(mount.description ?? '');
      setDefaultTTL(
        mount.config.default_lease_ttl > 0 ? String(mount.config.default_lease_ttl) : ''
      );
      setMaxTTL(mount.config.max_lease_ttl > 0 ? String(mount.config.max_lease_ttl) : '');
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mount) return;
    setSaving(true);
    try {
      const cleanPath = mount.path.replace(/\/$/, '');
      await vaultFetch(`/sys/mounts/${cleanPath}/tune`, {
        method: 'POST',
        body: {
          description,
          default_lease_ttl: defaultTTL ? Number(defaultTTL) : 0,
          max_lease_ttl: maxTTL ? Number(maxTTL) : 0,
        },
      });
      toast.success(`Tuning for "${mount.path}" saved.`);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(`Failed to tune engine: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tune Engine — {mount?.path}</DialogTitle>
        </DialogHeader>

        {mount && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-md bg-muted px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{mount.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Accessor</span>
                <span className="font-mono text-xs truncate max-w-[220px]">{mount.accessor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Default TTL</span>
                <span>
                  {mount.config.default_lease_ttl > 0
                    ? formatTTL(mount.config.default_lease_ttl)
                    : 'system default'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Max TTL</span>
                <span>
                  {mount.config.max_lease_ttl > 0
                    ? formatTTL(mount.config.max_lease_ttl)
                    : 'system default'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tune-description">Description</Label>
              <Input
                id="tune-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tune-default-ttl">Default Lease TTL (s)</Label>
                <Input
                  id="tune-default-ttl"
                  type="number"
                  min="0"
                  placeholder="0 = system"
                  value={defaultTTL}
                  onChange={(e) => setDefaultTTL(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tune-max-ttl">Max Lease TTL (s)</Label>
                <Input
                  id="tune-max-ttl"
                  type="number"
                  min="0"
                  placeholder="0 = system"
                  value={maxTTL}
                  onChange={(e) => setMaxTTL(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EnginesPage() {
  const router = useRouter();
  const { data: mounts, isLoading, error } = useMounts();
  const disableMount = useDisableMount();

  const [enableOpen, setEnableOpen] = useState(false);
  const [tuneMount, setTuneMount] = useState<MountConfig | null>(null);
  const [tuneOpen, setTuneOpen] = useState(false);

  function handleRowClick(path: string) {
    const cleanPath = path.replace(/\/$/, '');
    router.push(`/engines/${cleanPath}`);
  }

  function openTune(e: React.MouseEvent, mount: MountConfig) {
    e.stopPropagation();
    setTuneMount(mount);
    setTuneOpen(true);
  }

  async function handleDisable(e: React.MouseEvent, path: string) {
    e.stopPropagation();
    try {
      await disableMount.mutateAsync(path);
      toast.success(`Engine "${path}" disabled.`);
    } catch (err: unknown) {
      toast.error(`Failed to disable engine: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const mountList = mounts ? Object.values(mounts) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Secret Engines</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage mounted secret engines for your OpenBao instance.
          </p>
        </div>
        <Button onClick={() => setEnableOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Enable Engine
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load engines</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      {/* Table */}
      {!error && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Accessor</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-4 rounded" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-8 w-16" />
                      </TableCell>
                    </TableRow>
                  ))
                : mountList.length === 0
                  ? (
                    <TableRow key="empty">
                      <TableCell colSpan={5}>
                        <div className="py-16 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                          <Database className="h-12 w-12 opacity-25" />
                          <div className="text-center">
                            <p className="font-medium text-base text-foreground">No secret engines</p>
                            <p className="text-sm mt-1">Get started by enabling your first secret engine.</p>
                          </div>
                          <Button variant="outline" onClick={() => setEnableOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Enable Engine
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                  : mountList.map((mount) => (
                    <TableRow
                      key={mount.path}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(mount.path)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <EngineIcon type={mount.type} />
                          <span className="font-medium capitalize">{mount.type}</span>
                          {mount.options?.version === '2' && (
                            <Badge variant="secondary" className="text-[10px]">v2</Badge>
                          )}
                          {mount.local && (
                            <Badge variant="outline" className="text-[10px]">local</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="font-mono text-sm">{mount.path}</code>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">
                          {mount.description || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <code className="font-mono text-xs text-muted-foreground truncate block max-w-[180px]">
                          {mount.accessor}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => openTune(e, mount)}
                            title="Tune engine"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={(e) => e.stopPropagation()}
                                title="Disable engine"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Disable engine "{mount.path}"?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  All secrets stored in this engine will be permanently deleted
                                  and cannot be recovered. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={(e) => handleDisable(e, mount.path)}
                                >
                                  Disable Engine
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Enable dialog */}
      <EnableEngineDialog open={enableOpen} onOpenChange={setEnableOpen} />

      {/* Tune dialog */}
      <TuneDialog mount={tuneMount} open={tuneOpen} onOpenChange={setTuneOpen} />
    </div>
  );
}
