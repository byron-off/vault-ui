'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Folder,
  FileKey2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  ChevronRight,
  Home,
  Search,
  RotateCcw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  useSecretList,
  useSecret,
  useSecretMetadata,
  useWriteSecret,
  useSoftDeleteVersions,
  useUndeleteVersions,
  useDestroyVersions,
  useDeleteSecretMetadata,
} from '@/hooks/use-secrets';
import { relativeTime } from '@/lib/utils';

// ─── Breadcrumb ──────────────────────────────────────────────────────────────

function SecretsBreadcrumb({ segments }: { segments: string[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
      <Link href="/secrets" className="hover:text-foreground transition-colors">
        <Home className="w-3.5 h-3.5 inline" />
      </Link>
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5 text-border" />
          <Link
            href={`/secrets/${segments.slice(0, i + 1).join('/')}`}
            className={
              i === segments.length - 1
                ? 'text-foreground font-medium'
                : 'hover:text-foreground transition-colors'
            }
          >
            {seg}
          </Link>
        </span>
      ))}
    </nav>
  );
}

// ─── Secret value row ─────────────────────────────────────────────────────────

function SecretValueRow({
  secretKey,
  value,
}: {
  secretKey: string;
  value: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TableRow>
      <TableCell className="font-mono text-sm w-1/3">{secretKey}</TableCell>
      <TableCell className="font-mono text-sm">
        {revealed ? value : '••••••••'}
      </TableCell>
      <TableCell className="w-20">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copy}>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Edit mode row ────────────────────────────────────────────────────────────

type KVRow = { key: string; value: string };

function EditableKVTable({
  rows,
  onChange,
}: {
  rows: KVRow[];
  onChange: (rows: KVRow[]) => void;
}) {
  const add = () => onChange([...rows, { key: '', value: '' }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const update = (i: number, field: 'key' | 'value', val: string) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            placeholder="Key"
            value={row.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            className="flex-1 font-mono text-sm"
          />
          <Input
            placeholder="Value"
            value={row.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            className="flex-1 font-mono text-sm"
          />
          <Button variant="ghost" size="icon" onClick={() => remove(i)} className="h-8 w-8">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} type="button">
        <Plus className="w-3.5 h-3.5" />
        Add row
      </Button>
    </div>
  );
}

// ─── Secret Detail Panel ──────────────────────────────────────────────────────

function SecretDetail({ kvPath, name }: { kvPath: string; name: string }) {
  const fullPath = kvPath ? `${kvPath}/${name}` : name;
  const [editing, setEditing] = useState(false);
  const [editRows, setEditRows] = useState<KVRow[]>([]);

  const { data: secret, isLoading, error } = useSecret(fullPath);
  const { data: metadata } = useSecretMetadata(fullPath);
  const writeSecret = useWriteSecret();
  const softDelete = useSoftDeleteVersions();
  const undelete = useUndeleteVersions();
  const destroy = useDestroyVersions();
  const deleteMeta = useDeleteSecretMetadata();

  const startEdit = () => {
    if (secret) {
      setEditRows(
        Object.entries(secret.data).map(([key, value]) => ({ key, value: String(value) }))
      );
    }
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const save = async () => {
    const data = Object.fromEntries(editRows.filter((r) => r.key).map((r) => [r.key, r.value]));
    writeSecret.mutate(
      { path: fullPath, data },
      {
        onSuccess: () => {
          toast.success('Secret saved');
          setEditing(false);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const versions = metadata?.versions
    ? Object.entries(metadata.versions)
        .map(([v, info]) => ({ ...info, version: parseInt(v) }))
        .sort((a, b) => b.version - a.version)
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between gap-3">
        <div>
          <h3 className="font-mono font-semibold">{name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fullPath} · v{secret?.metadata.version ?? '?'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={writeSecret.isPending}>
                {writeSecret.isPending ? (
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete secret?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete <strong>{name}</strong> and all its versions.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        deleteMeta.mutate(fullPath, {
                          onSuccess: () => toast.success('Secret deleted'),
                          onError: (err) => toast.error(err.message),
                        });
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="current" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 justify-start">
          <TabsTrigger value="current">Current</TabsTrigger>
          <TabsTrigger value="versions">
            Versions{' '}
            {metadata && (
              <span className="ml-1.5 text-xs text-muted-foreground">({versions.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="flex-1 overflow-auto px-4 pb-4">
          {editing ? (
            <EditableKVTable rows={editRows} onChange={setEditRows} />
          ) : secret ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(secret.data).map(([k, v]) => (
                  <SecretValueRow key={k} secretKey={k} value={String(v)} />
                ))}
              </TableBody>
            </Table>
          ) : null}
        </TabsContent>

        <TabsContent value="versions" className="flex-1 overflow-auto px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map(({ version, created_time, deletion_time, destroyed }) => {
                const isCurrent = version === metadata?.current_version;
                const isDeleted = !!deletion_time && !destroyed;
                return (
                  <TableRow key={version}>
                    <TableCell className="font-mono text-sm">
                      v{version}
                      {isCurrent && (
                        <Badge variant="success" className="ml-2">
                          current
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {relativeTime(created_time)}
                    </TableCell>
                    <TableCell>
                      {destroyed ? (
                        <Badge variant="destructive">destroyed</Badge>
                      ) : isDeleted ? (
                        <Badge variant="warning">deleted</Badge>
                      ) : (
                        <Badge variant="secondary">active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isDeleted && !destroyed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              undelete.mutate(
                                { path: fullPath, versions: [version] },
                                { onSuccess: () => toast.success('Version undeleted') }
                              )
                            }
                          >
                            Restore
                          </Button>
                        )}
                        {!destroyed && !isDeleted && !isCurrent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              softDelete.mutate(
                                { path: fullPath, versions: [version] },
                                { onSuccess: () => toast.success('Version deleted') }
                              )
                            }
                          >
                            Delete
                          </Button>
                        )}
                        {!destroyed && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                              >
                                Destroy
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Destroy version {version}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes the data for this version. Cannot be
                                  undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground"
                                  onClick={() =>
                                    destroy.mutate(
                                      { path: fullPath, versions: [version] },
                                      { onSuccess: () => toast.success('Version destroyed') }
                                    )
                                  }
                                >
                                  Destroy
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="metadata" className="flex-1 overflow-auto px-4 pb-4 space-y-3">
          {metadata && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Max Versions</span>
                <span>{metadata.max_versions || 'unlimited'}</span>
                <span className="text-muted-foreground">CAS Required</span>
                <span>{metadata.cas_required ? 'Yes' : 'No'}</span>
                <span className="text-muted-foreground">Created</span>
                <span>{relativeTime(metadata.created_time)}</span>
                <span className="text-muted-foreground">Updated</span>
                <span>{relativeTime(metadata.updated_time)}</span>
              </div>
              {metadata.custom_metadata &&
                Object.keys(metadata.custom_metadata).length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Custom Metadata</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {Object.entries(metadata.custom_metadata).map(([k, v]) => (
                        <>
                          <span key={`k-${k}`} className="text-muted-foreground font-mono text-xs">
                            {k}
                          </span>
                          <span key={`v-${k}`} className="font-mono text-xs">
                            {v}
                          </span>
                        </>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Create Secret Dialog ─────────────────────────────────────────────────────

function CreateSecretDialog({
  open,
  onOpenChange,
  kvPath,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kvPath: string;
}) {
  const [secretName, setSecretName] = useState('');
  const [rows, setRows] = useState<KVRow[]>([{ key: '', value: '' }]);
  const writeSecret = useWriteSecret();

  const submit = () => {
    if (!secretName) return;
    const fullPath = kvPath ? `${kvPath}/${secretName}` : secretName;
    const data = Object.fromEntries(rows.filter((r) => r.key).map((r) => [r.key, r.value]));
    writeSecret.mutate(
      { path: fullPath, data },
      {
        onSuccess: () => {
          toast.success('Secret created');
          onOpenChange(false);
          setSecretName('');
          setRows([{ key: '', value: '' }]);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Secret</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="my-secret"
              value={secretName}
              onChange={(e) => setSecretName(e.target.value)}
              className="font-mono"
            />
            {kvPath && (
              <p className="text-xs text-muted-foreground">
                Path: <span className="font-mono">{kvPath}/{secretName}</span>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Initial Data</Label>
            <EditableKVTable rows={rows} onChange={setRows} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!secretName || writeSecret.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SecretsPage() {
  const params = useParams();
  const router = useRouter();
  const pathSegments: string[] = Array.isArray(params?.path)
    ? params.path
    : params?.path
    ? [params.path as string]
    : [];

  const kvPath = pathSegments.join('/');
  const [selectedSecret, setSelectedSecret] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: keys, isLoading, error } = useSecretList(kvPath || '', true);

  const filteredKeys = (keys ?? []).filter((k) =>
    k.toLowerCase().includes(filter.toLowerCase())
  );

  const handleKeyClick = useCallback(
    (key: string) => {
      if (key.endsWith('/')) {
        const nextPath = kvPath ? `${kvPath}/${key.slice(0, -1)}` : key.slice(0, -1);
        router.push(`/secrets/${nextPath}`);
      } else {
        setSelectedSecret(key);
      }
    },
    [kvPath, router]
  );

  return (
    <div className="flex flex-col md:h-[calc(100vh-theme(spacing.12)-theme(spacing.8))]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Secrets</h1>
          <SecretsBreadcrumb segments={pathSegments} />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          Create Secret
        </Button>
      </div>

      {/* Two-pane layout */}
      <div className="flex flex-col md:flex-row gap-4 md:flex-1 md:overflow-hidden">
        {/* Left: file browser */}
        <div className="md:w-72 border rounded-lg flex flex-col overflow-hidden md:overflow-hidden" style={{ maxHeight: '50vh' }}>
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded" />
              ))
            ) : error ? (
              <div className="p-2">
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">
                    {(error as Error).message}
                  </AlertDescription>
                </Alert>
              </div>
            ) : filteredKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <FileKey2 className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No secrets found</p>
              </div>
            ) : (
              filteredKeys.map((key) => {
                const isFolder = key.endsWith('/');
                const isSelected = !isFolder && key === selectedSecret;
                return (
                  <button
                    key={key}
                    onClick={() => handleKeyClick(key)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors text-left ${
                      isSelected
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    {isFolder ? (
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : (
                      <FileKey2 className="w-4 h-4 text-blue-500 shrink-0" />
                    )}
                    <span className="truncate font-mono text-xs">{key}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 border rounded-lg overflow-hidden min-h-[300px]">
          {selectedSecret ? (
            <SecretDetail kvPath={kvPath} name={selectedSecret} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
              <FileKey2 className="w-12 h-12 opacity-30" />
              <p className="text-sm">Select a secret to view its details</p>
            </div>
          )}
        </div>
      </div>

      <CreateSecretDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        kvPath={kvPath}
      />
    </div>
  );
}
