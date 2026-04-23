'use client';

import { useState } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Edit2, Users, X } from 'lucide-react';
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

import {
  listGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
} from '@/lib/vault/api/identity';
import { relativeTime } from '@/lib/utils';
import type { IdentityGroup } from '@/types/vault';

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
// Type badge
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: string }) {
  if (type === 'external') {
    return <Badge variant="outline" className="text-xs">external</Badge>;
  }
  return <Badge variant="secondary" className="text-xs">internal</Badge>;
}

// ---------------------------------------------------------------------------
// Create Group Dialog
// ---------------------------------------------------------------------------

function CreateGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<'internal' | 'external'>('internal');
  const [policies, setPolicies] = useState('');
  const [memberEntityIds, setMemberEntityIds] = useState('');
  const [metaRows, setMetaRows] = useState<KVRow[]>([]);

  function reset() {
    setName('');
    setType('internal');
    setPolicies('');
    setMemberEntityIds('');
    setMetaRows([]);
  }

  const mutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity', 'groups'] });
      toast.success('Group created');
      onOpenChange(false);
      reset();
    },
    onError: (err: Error) => {
      toast.error(`Failed to create group: ${err.message}`);
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
    const parsedEntityIds = memberEntityIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const meta = kvRowsToRecord(metaRows);
    mutation.mutate({
      name: name.trim(),
      type,
      policies: parsedPolicies.length ? parsedPolicies : undefined,
      member_entity_ids: parsedEntityIds.length ? parsedEntityIds : undefined,
      metadata: Object.keys(meta).length ? meta : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-group"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as 'internal' | 'external')}
              >
                <SelectTrigger id="create-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="space-y-1.5">
              <Label htmlFor="create-entity-ids">Member Entity IDs</Label>
              <Input
                id="create-entity-ids"
                value={memberEntityIds}
                onChange={(e) => setMemberEntityIds(e.target.value)}
                placeholder="uuid1, uuid2"
              />
              <p className="text-xs text-muted-foreground">Comma-separated entity IDs</p>
            </div>
            <div className="space-y-1.5">
              <Label>Metadata</Label>
              <KVEditor rows={metaRows} onChange={setMetaRows} />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
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
// Edit Group Dialog
// ---------------------------------------------------------------------------

function EditGroupDialog({
  group,
  open,
  onOpenChange,
}: {
  group: IdentityGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [policies, setPolicies] = useState('');
  const [memberEntityIds, setMemberEntityIds] = useState('');
  const [memberGroupIds, setMemberGroupIds] = useState('');
  const [metaRows, setMetaRows] = useState<KVRow[]>([]);
  const [initialised, setInitialised] = useState(false);

  // Seed form when group data is available
  if (group && !initialised) {
    setName(group.name);
    setPolicies((group.policies ?? []).join(', '));
    setMemberEntityIds((group.member_entity_ids ?? []).join(', '));
    setMemberGroupIds((group.member_group_ids ?? []).join(', '));
    setMetaRows(recordToKVRows(group.metadata));
    setInitialised(true);
  }

  function handleOpenChange(next: boolean) {
    if (!next) setInitialised(false);
    onOpenChange(next);
  }

  const mutation = useMutation({
    mutationFn: ({ id, opts }: { id: string; opts: Parameters<typeof updateGroup>[1] }) =>
      updateGroup(id, opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity', 'groups'] });
      toast.success('Group updated');
      handleOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(`Failed to update group: ${err.message}`);
    },
  });

  function handleSave() {
    if (!group) return;
    const parsedPolicies = policies
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const parsedEntityIds = memberEntityIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const parsedGroupIds = memberGroupIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    mutation.mutate({
      id: group.id,
      opts: {
        name: name.trim() || undefined,
        policies: parsedPolicies,
        member_entity_ids: parsedEntityIds,
        member_group_ids: parsedGroupIds,
        metadata: kvRowsToRecord(metaRows),
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Group</DialogTitle>
        </DialogHeader>
        {!group ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        ) : (
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-4 py-1">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Type — read-only after creation */}
              <div className="space-y-1.5">
                <Label>Type</Label>
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/40 text-sm text-muted-foreground">
                  {group.type}
                  <span className="ml-1 text-xs">(cannot be changed after creation)</span>
                </div>
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

              {/* Member entity IDs */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-entity-ids">Member Entity IDs</Label>
                <Input
                  id="edit-entity-ids"
                  value={memberEntityIds}
                  onChange={(e) => setMemberEntityIds(e.target.value)}
                  placeholder="uuid1, uuid2"
                />
                <p className="text-xs text-muted-foreground">Comma-separated entity IDs</p>
              </div>

              {/* Member group IDs */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-group-ids">Member Group IDs</Label>
                <Input
                  id="edit-group-ids"
                  value={memberGroupIds}
                  onChange={(e) => setMemberGroupIds(e.target.value)}
                  placeholder="uuid1, uuid2"
                />
                <p className="text-xs text-muted-foreground">Comma-separated group IDs</p>
              </div>

              {/* Metadata */}
              <div className="space-y-1.5">
                <Label>Metadata</Label>
                <KVEditor rows={metaRows} onChange={setMetaRows} />
              </div>

              <Separator />

              {/* Read-only info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">ID</span>
                  <p className="font-mono text-xs mt-0.5">{group.id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created</span>
                  <p className="mt-0.5">{relativeTime(group.creation_time)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last updated</span>
                  <p className="mt-0.5">{relativeTime(group.last_update_time)}</p>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending || !group}>
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

function DeleteGroupButton({
  group,
  onDeleted,
}: {
  group: IdentityGroup;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteGroup(group.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity', 'groups'] });
      toast.success(`Group "${group.name}" deleted`);
      onDeleted();
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete group: ${err.message}`);
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
          <AlertDialogTitle>Delete group?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{group.name}</strong>. This action cannot be
            undone.
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

export default function GroupsPage() {
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<IdentityGroup | null>(null);

  // Step 1: list group IDs
  const listQuery = useQuery({
    queryKey: ['identity', 'groups', 'list'],
    queryFn: listGroups,
  });

  // Step 2: batch-fetch details for each ID
  const detailQueries = useQueries({
    queries: (listQuery.data ?? []).map((id) => ({
      queryKey: ['identity', 'groups', 'detail', id],
      queryFn: () => getGroupById(id),
      enabled: !!listQuery.data,
    })),
  });

  const groups = detailQueries.map((q) => q.data).filter(Boolean) as IdentityGroup[];

  const isLoading =
    listQuery.isLoading || (listQuery.data !== undefined && detailQueries.some((q) => q.isLoading));
  const error = listQuery.error ?? detailQueries.find((q) => q.error)?.error ?? null;

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Groups</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Group
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
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load groups</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Policies</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 && !error ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                    <Users className="h-12 w-12 opacity-30" />
                    <p className="text-sm font-medium">No groups</p>
                    <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create your first group
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {group.id.slice(0, 8)}…
                    </span>
                  </TableCell>
                  <TableCell>
                    <TypeBadge type={group.type} />
                  </TableCell>
                  <TableCell>
                    {group.policies && group.policies.length > 0 ? (
                      <PolicyBadges policies={group.policies} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(group.member_entity_ids ?? []).length}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {relativeTime(group.creation_time)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditGroup(group)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <DeleteGroupButton
                        group={group}
                        onDeleted={() => {
                          queryClient.invalidateQueries({ queryKey: ['identity', 'groups'] });
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
      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditGroupDialog
        group={editGroup}
        open={!!editGroup}
        onOpenChange={(open) => {
          if (!open) setEditGroup(null);
        }}
      />
    </div>
  );
}
