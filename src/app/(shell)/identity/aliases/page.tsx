'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

import { listEntityAliases, deleteEntityAlias, createEntityAlias } from '@/lib/vault/api/identity';
import { vaultFetch } from '@/lib/vault/client';
import { truncate } from '@/lib/utils';

type AliasDetail = {
  id: string; name: string; canonical_id: string;
  mount_accessor: string; mount_type: string; creation_time: string;
};

export default function AliasesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', canonical_id: '', mount_accessor: '' });

  const listQuery = useQuery({
    queryKey: ['identity', 'aliases', 'list'],
    queryFn: listEntityAliases,
  });

  const detailQueries = useQuery({
    queryKey: ['identity', 'aliases', 'details', listQuery.data],
    queryFn: async () => {
      if (!listQuery.data?.length) return [];
      const results = await Promise.allSettled(
        listQuery.data.map((id) =>
          vaultFetch<{ data: AliasDetail }>(`/identity/entity-alias/id/${id}`).then((r) => r.data)
        )
      );
      return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    },
    enabled: !!listQuery.data?.length,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEntityAlias,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['identity', 'aliases'] }); toast.success('Alias deleted'); },
    onError: (e) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: () => createEntityAlias(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['identity', 'aliases'] });
      toast.success('Alias created');
      setCreateOpen(false);
      setForm({ name: '', canonical_id: '', mount_accessor: '' });
    },
    onError: (e) => toast.error(e.message),
  });

  const aliases = detailQueries.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entity Aliases</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage aliases that map auth backend identities to entities.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> Create Alias
        </Button>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : listQuery.error ? (
        <Alert variant="destructive"><AlertDescription>{(listQuery.error as Error).message}</AlertDescription></Alert>
      ) : aliases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <User className="w-10 h-10 opacity-30" />
          <p className="text-sm">No entity aliases found</p>
          <Button variant="outline" onClick={() => setCreateOpen(true)}>Create your first alias</Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Mount Type</TableHead>
              <TableHead>Mount Accessor</TableHead>
              <TableHead>Canonical ID</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aliases.map((alias) => (
              <TableRow key={alias.id}>
                <TableCell className="font-mono text-sm">{alias.name}</TableCell>
                <TableCell><Badge variant="secondary">{alias.mount_type}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{truncate(alias.mount_accessor, 16)}</TableCell>
                <TableCell className="font-mono text-xs">{truncate(alias.canonical_id, 16)}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete alias?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently remove the alias <strong>{alias.name}</strong>.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteMutation.mutate(alias.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Entity Alias</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {[
              ['name', 'Alias Name', 'e.g. john.doe'],
              ['canonical_id', 'Entity ID', 'Entity canonical ID'],
              ['mount_accessor', 'Mount Accessor', 'Auth mount accessor'],
            ].map(([field, label, placeholder]) => (
              <div key={field} className="space-y-1.5">
                <Label>{label} <span className="text-destructive">*</span></Label>
                <Input placeholder={placeholder} value={form[field as keyof typeof form]}
                  onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.canonical_id || !form.mount_accessor || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
