'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Edit2, User, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
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
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';

import {
  listEntities,
  getEntityByName,
  createEntity,
  updateEntity,
  deleteEntity,
} from '@/lib/vault/api/identity';
import { relativeTime } from '@/lib/utils';
import type { IdentityEntity } from '@/types/vault';

// ---------------------------------------------------------------------------
// KV metadata editor
// ---------------------------------------------------------------------------

interface KVRow {
  key: string;
  value: string;
}

function KVEditor({
  rows,
  onChange,
}: {
  rows: KVRow[];
  onChange: (rows: KVRow[]) => void;
}) {
  function updateRow(index: number, field: 'key' | 'value', val: string) {
    const next = rows.map((r, i) => (i === index ? { ...r, [field]: val } : r));
    onChange(next);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...rows, { key: '', value: '' }]);
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            placeholder="key"
            value={row.key}
            onChange={(e) => updateRow(i, 'key', e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="value"
            value={row.value}
            onChange={(e) => updateRow(i, 'value', e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeRow(i)}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        + Add row
      </Button>
    </div>
  );
}

function kvRowsToRecord(rows: KVRow[]): Record<string, string> {
  return Object.fromEntries(rows.filter((r) => r.key).map((r) => [r.key, r.value]));
}

function recordToKVRows(rec: Record<string, string> | null | undefined): KVRow[] {
  if (!rec) return [];
  return Object.entries(rec).map(([key, value]) => ({ key, value }));
}

// ---------------------------------------------------------------------------
// Policy badges helper
// ---------------------------------------------------------------------------

function PolicyBadges({ policies }: { policies: string[] }) {
  const visible = policies.slice(0, 3);
  const extra = policies.length - 3;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((p) => (
        <Badge key={p} variant="secondary" className="text-xs">
          {p}
        </Badge>
      ))}
      {extra > 0 && (
        <Badge variant="outline" className="text-xs">
          +{extra} more
        </Badge>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Entity Dialog
// ---------------------------------------------------------------------------

function CreateEntityDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [policies, setPolicies] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [metaRows, setMetaRows] = useState<KVRow[]>([]);

  const mutation = useMutation({
    mutationFn: createEntity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity', 'entities'] });
      toast.success('Entity created');
      onOpenChange(false);
      setName('');
      setPolicies('');
      setDisabled(false);
      setMetaRows([]);
    },
    onError: (err: Error) => {
      toast.error(`Failed to create entity: ${err.message}`);
    },
  });

  function handleSubmit() {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    const parsedPolicies = policies
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    mutation.mutate({
      name: name.trim(),
      policies: parsedPolicies.length ? parsedPolicies : undefined,
      disabled,
      metadata: Object.keys(kvRowsToRecord(metaRows)).length
        ? kvRowsToRecord(metaRows)
        : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Entity</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-entity"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-policies">Policies</Label>
              <Input
                id="create-policies"
                value={policies}
                onChange={(e) => setPolicies(e.target.value)}
                placeholder="default, my-policy"
              />
              <p className="text-xs text-muted-foreground">Comma-separated policy names</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="create-disabled"
                checked={disabled}
                onCheckedChange={(v) => setDisabled(!!v)}
              />
              <Label htmlFor="create-disabled">Disabled</Label>
            </div>
            <div className="space-y-1.5">
              <Label>Metadata</Label>
              <KVEditor rows={metaRows} onChange={setMetaRows} />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit Entity Dialog
// ---------------------------------------------------------------------------

function EditEntityDialog({
  entityName,
  open,
  onOpenChange,
}: {
  entityName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const { data: entity, isLoading } = useQuery({
    queryKey: ['identity', 'entity', entityName],
    queryFn: () => getEntityByName(entityName!),
    enabled: !!entityName && open,
  });

  // Local form state — initialised from entity when it loads
  const [name, setName] = useState('');
  const [policies, setPolicies] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [metaRows, setMetaRows] = useState<KVRow[]>([]);
  const [initialised, setInitialised] = useState(false);

  // Seed form once data arrives
  if (entity && !initialised) {
    setName(entity.name);
    setPolicies((entity.policies ?? []).join(', '));
    setDisabled(entity.disabled ?? false);
    setMetaRows(recordToKVRows(entity.metadata));
    setInitialised(true);
  }

  // Reset when dialog closes
  function handleOpenChange(next: boolean) {
    if (!next) setInitialised(false);
    onOpenChange(next);
  }

  const mutation = useMutation({
    mutationFn: ({ id, opts }: { id: string; opts: Parameters<typeof updateEntity>[1] }) =>
      updateEntity(id, opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity', 'entities'] });
      queryClient.invalidateQueries({ queryKey: ['identity', 'entity', entityName] });
      toast.success('Entity updated');
      handleOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(`Failed to update entity: ${err.message}`);
    },
  });

  function handleSave() {
    if (!entity) return;
    const parsedPolicies = policies
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    mutation.mutate({
      id: entity.id,
      opts: {
        name: name.trim() || undefined,
        policies: parsedPolicies,
        disabled,
        metadata: kvRowsToRecord(metaRows),
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Entity</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        ) : entity ? (
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-5 py-1">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Policies */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-policies">Policies</Label>
                <Input
                  id="edit-policies"
                  value={policies}
                  onChange={(e) => setPolicies(e.target.value)}
                  placeholder="default, my-policy"
                />
                <p className="text-xs text-muted-foreground">Comma-separated</p>
              </div>

              {/* Disabled */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-disabled"
                  checked={disabled}
                  onCheckedChange={(v) => setDisabled(!!v)}
                />
                <Label htmlFor="edit-disabled">Disabled</Label>
              </div>

              {/* Metadata */}
              <div className="space-y-1.5">
                <Label>Metadata</Label>
                <KVEditor rows={metaRows} onChange={setMetaRows} />
              </div>

              <Separator />

              {/* Aliases (read-only) */}
              <div className="space-y-2">
                <Label>Aliases</Label>
                {entity.aliases && entity.aliases.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mount Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entity.aliases.map((alias) => (
                          <TableRow key={alias.id}>
                            <TableCell>
                              <Badge variant="outline">{alias.mount_type}</Badge>
                            </TableCell>
                            <TableCell>{alias.name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {alias.id.slice(0, 8)}…
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No aliases</p>
                )}
              </div>

              {/* Read-only meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">ID</span>
                  <p className="font-mono text-xs mt-0.5">{entity.id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created</span>
                  <p className="mt-0.5">{relativeTime(entity.creation_time)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last updated</span>
                  <p className="mt-0.5">{relativeTime(entity.last_update_time)}</p>
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <p className="text-sm text-muted-foreground py-4">Entity not found.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending || isLoading || !entity}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------

function DeleteEntityButton({
  entity,
  onDeleted,
}: {
  entity: IdentityEntity;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteEntity(entity.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity', 'entities'] });
      toast.success(`Entity "${entity.name}" deleted`);
      onDeleted();
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete entity: ${err.message}`);
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete entity?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{entity.name}</strong> and all its aliases. This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function EntitiesPage() {
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editEntityName, setEditEntityName] = useState<string | null>(null);

  // List query returns entity names; for each name we need full details.
  // We fetch the list, then useQuery per entity inside rows is wasteful —
  // instead we fetch detail inline by storing names and using getEntityByName
  // when the edit dialog opens. For the table we batch-fetch all entities.
  const namesQuery = useQuery({
    queryKey: ['identity', 'entities'],
    queryFn: listEntities,
  });

  // Batch fetch all entity details so the table is fully populated
  const { data: entities, isLoading, error } = useQuery({
    queryKey: ['identity', 'entities', 'details'],
    queryFn: async () => {
      const names = namesQuery.data ?? [];
      const results = await Promise.all(names.map((n) => getEntityByName(n)));
      return results;
    },
    enabled: !!namesQuery.data,
  });

  const combinedLoading = namesQuery.isLoading || isLoading;
  const combinedError = namesQuery.error ?? error;

  const filtered = (entities ?? []).filter((e) =>
    e.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Entities</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Entity
        </Button>
      </div>

      {/* Filter */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Filter by name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Error */}
      {combinedError && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load entities</AlertTitle>
          <AlertDescription>{(combinedError as Error).message}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Policies</TableHead>
              <TableHead>Disabled</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {combinedLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 && !combinedError ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                    <User className="h-12 w-12 opacity-30" />
                    <p className="text-sm font-medium">No entities</p>
                    <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create your first entity
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((entity) => (
                <TableRow key={entity.id}>
                  <TableCell className="font-medium">{entity.name}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {entity.id.slice(0, 8)}…
                    </span>
                  </TableCell>
                  <TableCell>
                    {entity.policies && entity.policies.length > 0 ? (
                      <PolicyBadges policies={entity.policies} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {entity.disabled ? (
                      <Badge variant="destructive">Disabled</Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {relativeTime(entity.creation_time)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditEntityName(entity.name)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <DeleteEntityButton
                        entity={entity}
                        onDeleted={() => {
                          queryClient.invalidateQueries({ queryKey: ['identity', 'entities'] });
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <CreateEntityDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditEntityDialog
        entityName={editEntityName}
        open={!!editEntityName}
        onOpenChange={(open) => {
          if (!open) setEditEntityName(null);
        }}
      />
    </div>
  );
}
