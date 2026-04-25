'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Trash2, Copy, Check, ChevronLeft, AlertTriangle, RotateCcw, Pencil,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { CidrInput } from '@/components/ui/cidr-input';

import { vaultFetch } from '@/lib/vault/client';
import { truncate, formatTTL } from '@/lib/utils';

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="outline" size="icon" className="h-7 w-7 shrink-0"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

// ─── AppRole ──────────────────────────────────────────────────────────────────

function AppRoleAuth({ mount }: { mount: string }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [secretIdDialog, setSecretIdDialog] = useState<string | null>(null);
  const [newRole, setNewRole] = useState({
    name: '', token_ttl: '1h', token_max_ttl: '24h',
    secret_id_ttl: '24h', policies: '', bind_secret_id: true,
    bound_cidr_list: [] as string[],
    secret_id_bound_cidrs: [] as string[],
    token_bound_cidrs: [] as string[],
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    token_ttl: '', token_max_ttl: '', secret_id_ttl: '', policies: '', bind_secret_id: true,
    bound_cidr_list: [] as string[],
    secret_id_bound_cidrs: [] as string[],
    token_bound_cidrs: [] as string[],
  });

  const rolesQ = useQuery({
    queryKey: ['auth', mount, 'roles'],
    queryFn: () => vaultFetch<{ data: { keys: string[] } }>(`/auth/${mount}/role`, { method: 'LIST' })
      .then(r => r.data.keys).catch(() => [] as string[]),
  });

  const roleDetailQ = useQuery({
    queryKey: ['auth', mount, 'role', selected],
    queryFn: () => vaultFetch<{ data: Record<string, unknown> }>(`/auth/${mount}/role/${selected}`).then(r => r.data),
    enabled: !!selected,
  });

  const roleIdQ = useQuery({
    queryKey: ['auth', mount, 'role-id', selected],
    queryFn: () => vaultFetch<{ data: { role_id: string } }>(`/auth/${mount}/role/${selected}/role-id`).then(r => r.data.role_id),
    enabled: !!selected,
  });

  const secretIdsQ = useQuery({
    queryKey: ['auth', mount, 'secret-ids', selected],
    queryFn: () => vaultFetch<{ data: { keys: string[] } }>(`/auth/${mount}/role/${selected}/secret-id`, { method: 'LIST' })
      .then(r => r.data.keys).catch(() => [] as string[]),
    enabled: !!selected,
  });

  const createRole = useMutation({
    mutationFn: () => vaultFetch(`/auth/${mount}/role/${newRole.name}`, {
      method: 'POST',
      body: {
        token_ttl: newRole.token_ttl, token_max_ttl: newRole.token_max_ttl,
        secret_id_ttl: newRole.secret_id_ttl, bind_secret_id: newRole.bind_secret_id,
        token_policies: newRole.policies.split(',').map(p => p.trim()).filter(Boolean),
        bound_cidr_list: newRole.bound_cidr_list,
        secret_id_bound_cidrs: newRole.secret_id_bound_cidrs,
        token_bound_cidrs: newRole.token_bound_cidrs,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', mount, 'roles'] }); toast.success('Role created'); setCreateOpen(false);
      setNewRole({ name: '', token_ttl: '1h', token_max_ttl: '24h', secret_id_ttl: '24h', policies: '', bind_secret_id: true, bound_cidr_list: [], secret_id_bound_cidrs: [], token_bound_cidrs: [] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteRole = useMutation({
    mutationFn: (name: string) => vaultFetch(`/auth/${mount}/role/${name}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth', mount, 'roles'] }); setSelected(null); toast.success('Role deleted'); },
    onError: (e) => toast.error((e as Error).message),
  });

  const generateSecretId = useMutation({
    mutationFn: (name: string) => vaultFetch<{ data: { secret_id: string; secret_id_accessor: string } }>(`/auth/${mount}/role/${name}/secret-id`, { method: 'POST', body: {} }),
    onSuccess: (r) => { setSecretIdDialog(r.data.secret_id); qc.invalidateQueries({ queryKey: ['auth', mount, 'secret-ids', selected] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const destroySecretId = useMutation({
    mutationFn: ({ name, accessor }: { name: string; accessor: string }) =>
      vaultFetch(`/auth/${mount}/role/${name}/secret-id-accessor/destroy`, { method: 'POST', body: { secret_id_accessor: accessor } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth', mount, 'secret-ids', selected] }); toast.success('Secret ID destroyed'); },
    onError: (e) => toast.error((e as Error).message),
  });

  const editRole = useMutation({
    mutationFn: () => vaultFetch(`/auth/${mount}/role/${selected}`, {
      method: 'POST',
      body: {
        token_ttl: editForm.token_ttl, token_max_ttl: editForm.token_max_ttl,
        secret_id_ttl: editForm.secret_id_ttl, bind_secret_id: editForm.bind_secret_id,
        token_policies: editForm.policies.split(',').map((p) => p.trim()).filter(Boolean),
        bound_cidr_list: editForm.bound_cidr_list,
        secret_id_bound_cidrs: editForm.secret_id_bound_cidrs,
        token_bound_cidrs: editForm.token_bound_cidrs,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', mount, 'role', selected] });
      setEditOpen(false);
      toast.success('Role updated');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const tidyMutation = useMutation({
    mutationFn: () => vaultFetch(`/auth/${mount}/tidy/secret-id`, { method: 'POST' }),
    onSuccess: () => toast.success('Tidy initiated'),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Tabs defaultValue="roles">
      <TabsList><TabsTrigger value="roles">Roles</TabsTrigger><TabsTrigger value="tidy">Tidy</TabsTrigger></TabsList>

      <TabsContent value="roles" className="mt-4">
        <div className="flex gap-4">
          {/* Role list */}
          <div className="w-56 shrink-0 border rounded-lg overflow-hidden">
            <div className="p-2 border-b flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Roles</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCreateOpen(true)}><Plus className="w-3.5 h-3.5" /></Button>
            </div>
            <div className="overflow-y-auto max-h-96">
              {rolesQ.isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 mx-2 my-1" />) :
                (rolesQ.data ?? []).length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">No roles</p> :
                (rolesQ.data ?? []).map(r => (
                  <button key={r} onClick={() => setSelected(r)}
                    className={`w-full text-left px-3 py-2 text-sm font-mono transition-colors ${selected === r ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted text-foreground'}`}>
                    {r}
                  </button>
                ))
              }
            </div>
          </div>

          {/* Role detail */}
          <div className="flex-1">
            {!selected ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">
                Select a role to view details
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono font-semibold">{selected}</h3>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" />Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete role?</AlertDialogTitle><AlertDialogDescription>This will permanently delete AppRole <strong>{selected}</strong>.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteRole.mutate(selected)}>Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {/* Config */}
                {roleDetailQ.isLoading ? <Skeleton className="h-32 w-full" /> : roleDetailQ.data && (
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm">Configuration</CardTitle>
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => {
                          const d = roleDetailQ.data!;
                          setEditForm({
                            token_ttl: String(d.token_ttl ?? ''),
                            token_max_ttl: String(d.token_max_ttl ?? ''),
                            secret_id_ttl: String(d.secret_id_ttl ?? ''),
                            policies: ((d.token_policies ?? []) as string[]).join(', '),
                            bind_secret_id: Boolean(d.bind_secret_id ?? true),
                            bound_cidr_list: (d.bound_cidr_list ?? []) as string[],
                            secret_id_bound_cidrs: (d.secret_id_bound_cidrs ?? []) as string[],
                            token_bound_cidrs: (d.token_bound_cidrs ?? []) as string[],
                          });
                          setEditOpen(true);
                        }}>
                        Edit
                      </Button>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {[
                        ['Token TTL', String(roleDetailQ.data.token_ttl ?? '—')],
                        ['Token Max TTL', String(roleDetailQ.data.token_max_ttl ?? '—')],
                        ['Secret ID TTL', String(roleDetailQ.data.secret_id_ttl ?? '—')],
                        ['Bind Secret ID', roleDetailQ.data.bind_secret_id ? 'Yes' : 'No'],
                        ['Policies', ((roleDetailQ.data.token_policies ?? []) as string[]).join(', ') || '—'],
                      ].map(([k, v]) => (
                        <>
                          <span key={`k-${k}`} className="text-muted-foreground">{k}</span>
                          <span key={`v-${k}`} className="font-mono text-xs">{v}</span>
                        </>
                      ))}
                      {((roleDetailQ.data.bound_cidr_list ?? []) as string[]).length > 0 && (
                        <>
                          <span className="text-muted-foreground">Bound CIDRs</span>
                          <span className="font-mono text-xs">{((roleDetailQ.data.bound_cidr_list ?? []) as string[]).join(', ')}</span>
                        </>
                      )}
                      {((roleDetailQ.data.secret_id_bound_cidrs ?? []) as string[]).length > 0 && (
                        <>
                          <span className="text-muted-foreground">Secret ID CIDRs</span>
                          <span className="font-mono text-xs">{((roleDetailQ.data.secret_id_bound_cidrs ?? []) as string[]).join(', ')}</span>
                        </>
                      )}
                      {((roleDetailQ.data.token_bound_cidrs ?? []) as string[]).length > 0 && (
                        <>
                          <span className="text-muted-foreground">Token CIDRs</span>
                          <span className="font-mono text-xs">{((roleDetailQ.data.token_bound_cidrs ?? []) as string[]).join(', ')}</span>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Role ID */}
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Role ID</CardTitle></CardHeader>
                  <CardContent>
                    {roleIdQ.isLoading ? <Skeleton className="h-8 w-full" /> : (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 font-mono text-xs bg-muted rounded px-3 py-2 break-all">{roleIdQ.data}</code>
                        {roleIdQ.data && <CopyBtn text={roleIdQ.data} />}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Secret IDs */}
                <Card><CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Secret IDs</CardTitle>
                  <Button size="sm" onClick={() => generateSecretId.mutate(selected)} disabled={generateSecretId.isPending}>
                    {generateSecretId.isPending && <RotateCcw className="w-3.5 h-3.5 animate-spin" />}
                    Generate
                  </Button>
                </CardHeader>
                  <CardContent>
                    {secretIdsQ.isLoading ? <Skeleton className="h-16 w-full" /> :
                      (secretIdsQ.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No active Secret IDs</p> : (
                        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Accessor</TableHead><TableHead className="w-20">Actions</TableHead></TableRow></TableHeader>
                          <TableBody>{(secretIdsQ.data ?? []).map(acc => (
                            <TableRow key={acc}>
                              <TableCell className="font-mono text-xs">{truncate(acc, 20)}</TableCell>
                              <TableCell>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Destroy</Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Destroy Secret ID?</AlertDialogTitle><AlertDialogDescription>This will permanently invalidate this accessor.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => destroySecretId.mutate({ name: selected, accessor: acc })}>Destroy</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          ))}</TableBody>
                        </Table></div>
                      )
                    }
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="tidy" className="mt-4">
        <Card><CardContent className="pt-6 space-y-4">
          <p className="text-sm text-muted-foreground">Tidy cleans up invalid Secret ID entries that may be left behind due to client errors.</p>
          <Button onClick={() => tidyMutation.mutate()} disabled={tidyMutation.isPending}>
            {tidyMutation.isPending && <RotateCcw className="w-4 h-4 animate-spin" />}
            Run Tidy
          </Button>
        </CardContent></Card>
      </TabsContent>

      {/* Create role dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create AppRole</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Name <span className="text-destructive">*</span></Label><Input value={newRole.name} onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))} className="font-mono" /></div>
            <div className="grid grid-cols-2 gap-3">
              {(['token_ttl', 'token_max_ttl', 'secret_id_ttl'] as const).map(f => (
                <div key={f} className="space-y-1.5"><Label>{f.replace(/_/g, ' ')}</Label><Input value={newRole[f]} onChange={e => setNewRole(p => ({ ...p, [f]: e.target.value }))} /></div>
              ))}
            </div>
            <div className="space-y-1.5"><Label>Policies (comma-separated)</Label><Input value={newRole.policies} onChange={e => setNewRole(p => ({ ...p, policies: e.target.value }))} placeholder="default,my-policy" /></div>
            <div className="flex items-center gap-2"><Switch checked={newRole.bind_secret_id} onCheckedChange={v => setNewRole(p => ({ ...p, bind_secret_id: v }))} /><Label>Bind Secret ID</Label></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Bound CIDR List (optional)</Label><CidrInput value={newRole.bound_cidr_list} onChange={v => setNewRole(p => ({ ...p, bound_cidr_list: v }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Secret ID Bound CIDRs (optional)</Label><CidrInput value={newRole.secret_id_bound_cidrs} onChange={v => setNewRole(p => ({ ...p, secret_id_bound_cidrs: v }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Token Bound CIDRs (optional)</Label><CidrInput value={newRole.token_bound_cidrs} onChange={v => setNewRole(p => ({ ...p, token_bound_cidrs: v }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createRole.mutate()} disabled={!newRole.name || createRole.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit role dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Role — {selected}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              {(['token_ttl', 'token_max_ttl', 'secret_id_ttl'] as const).map(f => (
                <div key={f} className="space-y-1.5">
                  <Label className="text-xs">{f.replace(/_/g, ' ')}</Label>
                  <Input value={editForm[f]} onChange={e => setEditForm(p => ({ ...p, [f]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Policies (comma-separated)</Label><Input value={editForm.policies} onChange={e => setEditForm(p => ({ ...p, policies: e.target.value }))} placeholder="default,my-policy" /></div>
            <div className="flex items-center gap-2"><Switch checked={editForm.bind_secret_id} onCheckedChange={v => setEditForm(p => ({ ...p, bind_secret_id: v }))} /><Label className="text-xs">Bind Secret ID</Label></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Bound CIDR List</Label><CidrInput value={editForm.bound_cidr_list} onChange={v => setEditForm(p => ({ ...p, bound_cidr_list: v }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Secret ID Bound CIDRs</Label><CidrInput value={editForm.secret_id_bound_cidrs} onChange={v => setEditForm(p => ({ ...p, secret_id_bound_cidrs: v }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Token Bound CIDRs</Label><CidrInput value={editForm.token_bound_cidrs} onChange={v => setEditForm(p => ({ ...p, token_bound_cidrs: v }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => editRole.mutate()} disabled={editRole.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret ID shown-once dialog */}
      <Dialog open={!!secretIdDialog} onOpenChange={() => setSecretIdDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Secret ID Generated</DialogTitle></DialogHeader>
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-xs">This Secret ID will <strong>not be shown again</strong>.</AlertDescription>
          </Alert>
          {secretIdDialog && (
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs bg-muted rounded px-3 py-2 break-all">{secretIdDialog}</code>
              <CopyBtn text={secretIdDialog} />
            </div>
          )}
          <DialogFooter><Button onClick={() => setSecretIdDialog(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

// ─── Token ────────────────────────────────────────────────────────────────────

function TokenAuth() {
  const qc = useQueryClient();
  const [selAccessor, setSelAccessor] = useState<string | null>(null);
  const [accessorDetail, setAccessorDetail] = useState<Record<string, unknown> | null>(null);

  const accessorsQ = useQuery({
    queryKey: ['auth', 'token', 'accessors'],
    queryFn: () => vaultFetch<{ data: { keys: string[] } }>('/auth/token/accessors', { method: 'LIST' })
      .then(r => r.data.keys).catch(() => [] as string[]),
  });

  const lookupMutation = useMutation({
    mutationFn: (accessor: string) => vaultFetch<{ data: Record<string, unknown> }>('/auth/token/lookup-accessor', { method: 'POST', body: { accessor } }).then(r => r.data),
    onSuccess: (data) => setAccessorDetail(data),
    onError: (e) => toast.error((e as Error).message),
  });

  const revokeMutation = useMutation({
    mutationFn: (accessor: string) => vaultFetch('/auth/token/revoke-accessor', { method: 'POST', body: { accessor } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth', 'token', 'accessors'] }); setSelAccessor(null); setAccessorDetail(null); toast.success('Token revoked'); },
    onError: (e) => toast.error((e as Error).message),
  });

  const tidyMutation = useMutation({
    mutationFn: () => vaultFetch('/auth/token/tidy', { method: 'POST' }),
    onSuccess: () => toast.success('Tidy initiated'),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Tabs defaultValue="accessors">
      <TabsList><TabsTrigger value="accessors">Accessors</TabsTrigger><TabsTrigger value="tidy">Tidy</TabsTrigger></TabsList>

      <TabsContent value="accessors" className="mt-4">
        <div className="flex gap-4">
          <div className="w-56 shrink-0 border rounded-lg overflow-hidden">
            <div className="p-2 border-b"><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accessors</span></div>
            <div className="overflow-y-auto max-h-96">
              {accessorsQ.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 mx-2 my-1" />) :
                (accessorsQ.data ?? []).map(acc => (
                  <button key={acc} onClick={() => { setSelAccessor(acc); lookupMutation.mutate(acc); }}
                    className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors truncate ${selAccessor === acc ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}>
                    {truncate(acc, 18)}
                  </button>
                ))
              }
            </div>
          </div>

          <div className="flex-1">
            {!selAccessor ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">Select an accessor</div>
            ) : accessorDetail ? (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-mono">{truncate(selAccessor, 24)}</CardTitle>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" />Revoke</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Revoke token?</AlertDialogTitle><AlertDialogDescription>This will permanently revoke the token associated with this accessor.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => revokeMutation.mutate(selAccessor)}>Revoke</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {[
                    ['Display Name', String(accessorDetail.display_name ?? '—')],
                    ['Policies', ((accessorDetail.policies ?? []) as string[]).join(', ')],
                    ['TTL', formatTTL(Number(accessorDetail.ttl ?? 0))],
                    ['Renewable', accessorDetail.renewable ? 'Yes' : 'No'],
                    ['Entity ID', truncate(String(accessorDetail.entity_id ?? '—'), 20)],
                  ].map(([k, v]) => (
                    <>
                      <span key={`k-${k}`} className="text-muted-foreground">{k}</span>
                      <span key={`v-${k}`} className="font-mono text-xs">{v}</span>
                    </>
                  ))}
                </CardContent>
              </Card>
            ) : lookupMutation.isPending ? <Skeleton className="h-40 w-full" /> : null}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="tidy" className="mt-4">
        <Card><CardContent className="pt-6 space-y-4">
          <p className="text-sm text-muted-foreground">Cleans up orphaned token storage entries. Safe to run at any time.</p>
          <Button onClick={() => tidyMutation.mutate()} disabled={tidyMutation.isPending}>
            {tidyMutation.isPending && <RotateCcw className="w-4 h-4 animate-spin" />}
            Run Tidy
          </Button>
        </CardContent></Card>
      </TabsContent>
    </Tabs>
  );
}

// ─── JWT / OIDC ───────────────────────────────────────────────────────────────

function JWTAuth({ mount }: { mount: string }) {
  const qc = useQueryClient();
  const [authUrl, setAuthUrl] = useState('');
  const [selRole, setSelRole] = useState('');

  const configQ = useQuery({
    queryKey: ['auth', mount, 'config'],
    queryFn: () => vaultFetch<{ data: Record<string, unknown> }>(`/auth/${mount}/config`).then(r => r.data),
  });

  const rolesQ = useQuery({
    queryKey: ['auth', mount, 'roles'],
    queryFn: () => vaultFetch<{ data: { keys: string[] } }>(`/auth/${mount}/role`, { method: 'LIST' })
      .then(r => r.data.keys).catch(() => [] as string[]),
  });

  const [configEdit, setConfigEdit] = useState<Record<string, string>>({});

  const saveConfig = useMutation({
    mutationFn: () => vaultFetch(`/auth/${mount}/config`, { method: 'POST', body: configEdit }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth', mount, 'config'] }); toast.success('Config saved'); },
    onError: (e) => toast.error((e as Error).message),
  });

  const getAuthUrl = useMutation({
    mutationFn: () => vaultFetch<{ data: { auth_url: string } }>(`/auth/${mount}/oidc/auth_url`, {
      method: 'POST',
      body: { redirect_uri: `${window.location.origin}/oidc-callback`, role: selRole },
    }),
    onSuccess: (r) => setAuthUrl(r.data.auth_url),
    onError: (e) => toast.error((e as Error).message),
  });

  const cfg = configQ.data;

  return (
    <Tabs defaultValue="config">
      <TabsList><TabsTrigger value="config">Config</TabsTrigger><TabsTrigger value="roles">Roles</TabsTrigger><TabsTrigger value="test">OIDC Test</TabsTrigger></TabsList>

      <TabsContent value="config" className="mt-4">
        {configQ.isLoading ? <Skeleton className="h-40 w-full" /> : cfg && (
          <Card><CardContent className="pt-6 space-y-4">
            {[
              ['oidc_discovery_url', 'OIDC Discovery URL', 'https://accounts.example.com'],
              ['oidc_client_id', 'Client ID', ''],
              ['oidc_client_secret', 'Client Secret', ''],
              ['bound_issuer', 'Bound Issuer', ''],
            ].map(([key, label, placeholder]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Input defaultValue={String(cfg[key] ?? '')} type={key.includes('secret') ? 'password' : 'text'}
                  placeholder={placeholder}
                  onChange={e => setConfigEdit(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="flex justify-end">
              <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>Save</Button>
            </div>
          </CardContent></Card>
        )}
      </TabsContent>

      <TabsContent value="roles" className="mt-4">
        <RolesCRUD mount={mount} path={`/auth/${mount}/role`} queryKey={['auth', mount, 'roles']}
          fields={[
            { name: 'name', label: 'Name', required: true },
            { name: 'role_type', label: 'Role Type', placeholder: 'oidc or jwt' },
            { name: 'bound_audiences', label: 'Bound Audiences (comma-sep)' },
            { name: 'user_claim', label: 'User Claim', placeholder: 'sub' },
            { name: 'token_policies', label: 'Policies (comma-sep)' },
            { name: 'token_ttl', label: 'Token TTL', placeholder: '1h' },
          ]}
        />
      </TabsContent>

      <TabsContent value="test" className="mt-4">
        <Card><CardContent className="pt-6 space-y-4">
          <p className="text-sm text-muted-foreground">Generate an OIDC authorization URL to test the login flow.</p>
          <div className="space-y-1.5">
            <Label>Role (optional)</Label>
            <Input value={selRole} onChange={e => setSelRole(e.target.value)} placeholder="default" />
          </div>
          <Button onClick={() => getAuthUrl.mutate()} disabled={getAuthUrl.isPending}>Get Auth URL</Button>
          {authUrl && (
            <div className="space-y-2">
              <Label>Auth URL</Label>
              <a href={authUrl} target="_blank" rel="noopener noreferrer"
                className="block text-xs font-mono text-primary underline break-all bg-muted rounded px-3 py-2">
                {authUrl}
              </a>
            </div>
          )}
        </CardContent></Card>
      </TabsContent>
    </Tabs>
  );
}

// Reusable simple roles CRUD table (create + edit + delete)
function RolesCRUD({ mount, path, queryKey, fields }: {
  mount: string;
  path: string;
  queryKey: string[];
  fields: { name: string; label: string; required?: boolean; placeholder?: string }[];
}) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editName, setEditName] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const listQ = useQuery({
    queryKey,
    queryFn: () => vaultFetch<{ data: { keys: string[] } }>(path, { method: 'LIST' })
      .then(r => r.data.keys).catch(() => [] as string[]),
  });

  const openEdit = async (name: string) => {
    try {
      const res = await vaultFetch<{ data: Record<string, unknown> }>(`${path}/${name}`);
      const flat: Record<string, string> = {};
      for (const f of fields.filter(f => f.name !== 'name')) {
        const v = res.data[f.name];
        flat[f.name] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
      }
      setEditForm(flat);
      setEditName(name);
    } catch {
      toast.error('Failed to load role config');
    }
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const { name, ...rest } = form;
      return vaultFetch(`${path}/${name}`, { method: 'POST', body: rest });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success('Created'); setCreateOpen(false); setForm({}); },
    onError: (e) => toast.error((e as Error).message),
  });

  const editMutation = useMutation({
    mutationFn: () => vaultFetch(`${path}/${editName}`, { method: 'POST', body: editForm }),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success('Saved'); setEditName(null); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => vaultFetch(`${path}/${name}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success('Deleted'); },
    onError: (e) => toast.error((e as Error).message),
  });

  const editFields = fields.filter(f => f.name !== 'name');

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" />Create</Button>
      </div>
      {listQ.isLoading ? <Skeleton className="h-24 w-full" /> :
        (listQ.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No roles configured</p> : (
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{(listQ.data ?? []).map(r => (
              <TableRow key={r}>
                <TableCell className="font-mono text-sm">{r}</TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete role?</AlertDialogTitle><AlertDialogDescription>This will delete <strong>{r}</strong>.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteMutation.mutate(r)}>Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>
        )
      }

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Role</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {fields.map(f => (
              <div key={f.name} className="space-y-1.5">
                <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                <Input placeholder={f.placeholder ?? f.label} value={form[f.name] ?? ''}
                  onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form['name'] || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editName !== null} onOpenChange={(o) => { if (!o) setEditName(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Role: {editName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {editFields.map(f => (
              <div key={f.name} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input placeholder={f.placeholder ?? f.label} value={editForm[f.name] ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, [f.name]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditName(null)}>Cancel</Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Generic fallback ─────────────────────────────────────────────────────────

function GenericAuth({ mount, type, info }: { mount: string; type: string; info: Record<string, unknown> }) {
  const [path, setPath] = useState('');
  const [method, setMethod] = useState('GET');
  const [body, setBody] = useState('');
  const [result, setResult] = useState('');
  const [err, setErr] = useState('');

  return (
    <div className="space-y-4">
      <Card><CardContent className="pt-6">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {[['Type', type], ['Accessor', String(info.accessor ?? '—')], ['Description', String(info.description ?? '—')]].map(([k, v]) => (
            <><span key={`k-${k}`} className="text-muted-foreground">{k}</span><span key={`v-${k}`} className="font-mono text-xs">{v}</span></>
          ))}
        </div>
      </CardContent></Card>
      <Alert><AlertDescription>Direct configuration via CLI is recommended for <strong>{type}</strong>. Use the API explorer below for advanced operations.</AlertDescription></Alert>
      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex gap-2 items-end">
          <div className="space-y-1.5">
            <Label>Method</Label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              {['GET','LIST','POST','DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1 space-y-1.5"><Label>Path (relative to /auth/{mount}/)</Label><Input value={path} onChange={e => setPath(e.target.value)} /></div>
        </div>
        {method === 'POST' && <Textarea rows={4} value={body} onChange={e => setBody(e.target.value)} placeholder="{}" className="font-mono text-xs" />}
        <Button onClick={async () => { setResult(''); setErr(''); try { const r = await vaultFetch<unknown>(`/auth/${mount}/${path}`, { method: method as 'GET'|'POST'|'DELETE'|'LIST', body: body ? JSON.parse(body) : undefined }); setResult(JSON.stringify(r, null, 2)); } catch(e) { setErr((e as Error).message); } }}>Run</Button>
        {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
        {result && <pre className="text-xs font-mono bg-muted rounded p-3 overflow-auto max-h-64">{result}</pre>}
      </CardContent></Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuthDetailPage() {
  const params = useParams();
  const router = useRouter();
  const mount = Array.isArray(params?.mount) ? params.mount[0] : (params?.mount as string);

  const mountsQ = useQuery({
    queryKey: ['mounts', 'auth', 'detail'],
    queryFn: () => vaultFetch<{ data: Record<string, { type: string; description: string; accessor: string }> }>('/sys/auth').then(r => r.data),
  });

  const mountInfo = mountsQ.data?.[`${mount}/`];
  const authType = mountInfo?.type ?? '';

  if (mountsQ.isLoading) return <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!mountInfo) return <Alert variant="destructive"><AlertDescription>Auth mount <strong>{mount}</strong> not found.</AlertDescription></Alert>;

  const renderAuth = () => {
    if (authType === 'approle') return <AppRoleAuth mount={mount} />;
    if (authType === 'token') return <TokenAuth />;
    if (authType === 'jwt' || authType === 'oidc') return <JWTAuth mount={mount} />;
    return <GenericAuth mount={mount} type={authType} info={mountInfo as Record<string, unknown>} />;
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/auth')} className="text-muted-foreground mb-2">
          <ChevronLeft className="w-4 h-4" />Auth Methods
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-mono">{mount}/</h1>
          <Badge variant="secondary">{authType}</Badge>
          {mountInfo.description && <span className="text-muted-foreground text-sm">{mountInfo.description}</span>}
        </div>
      </div>
      {renderAuth()}
    </div>
  );
}
