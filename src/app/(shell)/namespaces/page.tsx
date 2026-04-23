'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Globe, Lock, Unlock, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

import { vaultFetch } from '@/lib/vault/client';

type Namespace = { id: string; path: string; custom_metadata?: Record<string, string> };

export default function NamespacesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newPath, setNewPath] = useState('');

  const listQuery = useQuery({
    queryKey: ['namespaces', 'list'],
    queryFn: async () => {
      const res = await vaultFetch<{ data: { keys: string[] } }>('/sys/namespaces', { method: 'LIST' });
      return res.data.keys;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (path: string) => {
      await vaultFetch(`/sys/namespaces/${path}`, { method: 'POST' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['namespaces'] });
      toast.success('Namespace created');
      setCreateOpen(false);
      setNewPath('');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (path: string) => {
      await vaultFetch(`/sys/namespaces/${path}`, { method: 'DELETE' });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['namespaces'] }); toast.success('Namespace deleted'); },
    onError: (e) => toast.error((e as Error).message),
  });

  const lockMutation = useMutation({
    mutationFn: async ({ path, lock }: { path: string; lock: boolean }) => {
      await vaultFetch(`/sys/namespaces/api-lock/${lock ? 'lock' : 'unlock'}/${path}`, { method: 'POST' });
    },
    onSuccess: (_, { lock }) => toast.success(`Namespace ${lock ? 'locked' : 'unlocked'}`),
    onError: (e) => toast.error((e as Error).message),
  });

  const namespaces = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6" />
          <div>
            <h1 className="text-2xl font-bold">Namespaces</h1>
            <p className="text-muted-foreground text-sm">Manage isolated namespace environments.</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> Create Namespace
        </Button>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : listQuery.error ? (
        <Alert variant="destructive"><AlertDescription>{(listQuery.error as Error).message}</AlertDescription></Alert>
      ) : namespaces.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-16">
            <Globe className="w-10 h-10 opacity-30 mx-auto mb-3" />
            <p className="text-sm">No namespaces found</p>
            <p className="text-xs mt-1">Namespaces provide isolated environments within OpenBao.</p>
            <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>Create namespace</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {namespaces.map((ns) => (
            <Card key={ns}>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-mono text-sm flex-1">{ns}</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => lockMutation.mutate({ path: ns, lock: true })} title="Lock namespace">
                    <Lock className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => lockMutation.mutate({ path: ns, lock: false })} title="Unlock namespace">
                    <Unlock className="w-3.5 h-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete namespace?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete the namespace <strong>{ns}</strong> and all its contents.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteMutation.mutate(ns)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Namespace</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Path <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. team-a" value={newPath} onChange={(e) => setNewPath(e.target.value)} />
            <p className="text-xs text-muted-foreground">Namespace path (no leading/trailing slashes)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(newPath)} disabled={!newPath || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
