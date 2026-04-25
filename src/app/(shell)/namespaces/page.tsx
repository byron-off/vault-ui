'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Globe, Lock, Unlock, ChevronRight, FolderOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { vaultFetch } from '@/lib/vault/client';
import { VaultError } from '@/lib/vault/errors';

type NSNode = {
  path: string;       // full path e.g. "team-a/sub/"
  name: string;       // display segment e.g. "sub/"
  depth: number;
  children: NSNode[];
};

function buildTree(paths: string[]): NSNode[] {
  // Sort so parents always precede children
  const sorted = [...paths].sort();
  const roots: NSNode[] = [];
  const nodeMap = new Map<string, NSNode>();

  for (const path of sorted) {
    const depth = (path.match(/\//g) ?? []).length - 1;
    const segments = path.split('/').filter(Boolean);
    const name = segments[segments.length - 1] + '/';
    const parentPath = depth === 0 ? null : segments.slice(0, -1).join('/') + '/';

    const node: NSNode = { path, name, depth, children: [] };
    nodeMap.set(path, node);

    if (parentPath && nodeMap.has(parentPath)) {
      nodeMap.get(parentPath)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ─── Namespace row ─────────────────────────────────────────────────────────────

function NSRow({
  node,
  onLock,
  onUnlock,
  onDelete,
}: {
  node: NSNode;
  onLock: (path: string) => void;
  onUnlock: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const indent = node.depth * 20;

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="py-2.5 px-4 flex items-center gap-2">
          <div style={{ width: indent }} className="shrink-0" />

          <button
            type="button"
            onClick={() => hasChildren && setExpanded((v) => !v)}
            className={`shrink-0 ${hasChildren ? 'cursor-pointer' : 'cursor-default opacity-30'}`}
          >
            {hasChildren ? (
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          <span className="font-mono text-sm flex-1 truncate">{node.path}</span>

          {node.depth > 0 && (
            <Badge variant="outline" className="text-xs shrink-0">nested</Badge>
          )}

          <TooltipProvider>
            <div className="flex items-center gap-1 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => onLock(node.path)}
                  >
                    <Lock className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Lock namespace</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => onUnlock(node.path)}
                  >
                    <Unlock className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Unlock namespace</TooltipContent>
              </Tooltip>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete namespace?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete <strong>{node.path}</strong> and all its
                      contents including child namespaces, secrets engines, and auth methods.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground"
                      onClick={() => onDelete(node.path)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      {expanded && node.children.map((child) => (
        <NSRow
          key={child.path}
          node={child}
          onLock={onLock}
          onUnlock={onUnlock}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function NamespacesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [parentPath, setParentPath] = useState('');

  const listQuery = useQuery({
    queryKey: ['namespaces', 'list'],
    queryFn: async () => {
      try {
        const res = await vaultFetch<{ data: { keys: string[] } }>(
          '/sys/namespaces', { method: 'LIST' }
        );
        return res.data.keys ?? [];
      } catch (err) {
        if (err instanceof VaultError && err.status === 404) return [];
        throw err;
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: (path: string) =>
      vaultFetch(`/sys/namespaces/${path}`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['namespaces'] });
      toast.success('Namespace created');
      setCreateOpen(false);
      setNewPath('');
      setParentPath('');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (path: string) =>
      vaultFetch(`/sys/namespaces/${path}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['namespaces'] });
      toast.success('Namespace deleted');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const lockMutation = useMutation({
    mutationFn: ({ path, lock }: { path: string; lock: boolean }) =>
      vaultFetch(`/sys/namespaces/api-lock/${lock ? 'lock' : 'unlock'}/${path}`, { method: 'POST' }),
    onSuccess: (_, { lock }) => toast.success(`Namespace ${lock ? 'locked' : 'unlocked'}`),
    onError: (e) => toast.error((e as Error).message),
  });

  const allPaths = listQuery.data ?? [];
  const tree = buildTree(allPaths);

  const fullPath = parentPath
    ? `${parentPath.replace(/\/$/, '')}/${newPath}`
    : newPath;

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
          <Plus className="w-4 h-4 mr-1" /> Create Namespace
        </Button>
      </div>

      {/* Stats bar */}
      {allPaths.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {allPaths.length} namespace{allPaths.length !== 1 ? 's' : ''} total
          {tree.length !== allPaths.length &&
            ` · ${tree.length} root, ${allPaths.length - tree.length} nested`}
        </p>
      )}

      {listQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : listQuery.error ? (
        <Card>
          <CardContent className="pt-6 text-center text-destructive py-8 text-sm">
            {(listQuery.error as Error).message}
          </CardContent>
        </Card>
      ) : tree.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-16">
            <Globe className="w-10 h-10 opacity-30 mx-auto mb-3" />
            <p className="text-sm">No namespaces found</p>
            <p className="text-xs mt-1">Namespaces provide isolated environments within OpenBao.</p>
            <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
              Create namespace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {tree.map((node) => (
            <NSRow
              key={node.path}
              node={node}
              onLock={(p) => lockMutation.mutate({ path: p, lock: true })}
              onUnlock={(p) => lockMutation.mutate({ path: p, lock: false })}
              onDelete={(p) => deleteMutation.mutate(p)}
            />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Namespace</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Parent Namespace (optional)</Label>
              <Input
                placeholder="Leave empty for root namespace"
                value={parentPath}
                onChange={(e) => setParentPath(e.target.value)}
                list="ns-list"
              />
              <datalist id="ns-list">
                {allPaths.map((p) => <option key={p} value={p} />)}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Type or select an existing namespace to create a child.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Path <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. team-a"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
              />
            </div>
            {fullPath && (
              <div className="rounded-md bg-muted px-3 py-2 text-xs font-mono text-muted-foreground">
                Full path: {fullPath}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(fullPath)}
              disabled={!newPath || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
