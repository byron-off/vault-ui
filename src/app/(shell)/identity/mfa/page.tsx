'use client';

import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Shield, Plus, Trash2, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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

import { vaultFetch } from '@/lib/vault/client';
import { VaultError } from '@/lib/vault/errors';

const MFA_TYPES = ['totp', 'duo', 'okta', 'pingid'] as const;
type MFAType = typeof MFA_TYPES[number];

type MFAMethod = {
  id: string;
  type: MFAType;
  issuer?: string;
  account_name?: string;
  period?: number;
  algorithm?: string;
  digits?: number;
};

type LoginEnforcement = {
  name: string;
  mfa_method_ids: string[];
  auth_method_accessors?: string[];
  auth_method_types?: string[];
  identity_group_ids?: string[];
  identity_entity_ids?: string[];
};

async function listMFAMethodIds(type: string): Promise<{ id: string; type: MFAType }[]> {
  try {
    const res = await vaultFetch<{ data: { keys: string[] } }>(
      `/identity/mfa/method/${type}`, { method: 'LIST' }
    );
    return (res.data.keys ?? []).map((id) => ({ id, type: type as MFAType }));
  } catch (err) {
    if (err instanceof VaultError && err.status === 404) return [];
    throw err;
  }
}

// ─── Methods Tab ──────────────────────────────────────────────────────────────

function MethodsTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<MFAType>('totp');

  const typeQueries = useQueries({
    queries: MFA_TYPES.map((type) => ({
      queryKey: ['identity', 'mfa', 'method', type, 'list'],
      queryFn: () => listMFAMethodIds(type),
    })),
  });

  const allMethods = typeQueries.flatMap((q) => q.data ?? []);
  const isLoading = typeQueries.some((q) => q.isLoading);

  const detailQueries = useQueries({
    queries: allMethods.map((m) => ({
      queryKey: ['identity', 'mfa', 'method', m.type, m.id],
      queryFn: () =>
        vaultFetch<{ data: MFAMethod }>(`/identity/mfa/method/${m.type}/${m.id}`)
          .then((r) => r.data),
    })),
  });

  const details = allMethods.reduce<Record<string, MFAMethod>>((acc, m, i) => {
    const d = detailQueries[i].data;
    if (d) acc[m.id] = d;
    return acc;
  }, {});

  const deleteMutation = useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) =>
      vaultFetch(`/identity/mfa/method/${type}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      MFA_TYPES.forEach((t) =>
        qc.invalidateQueries({ queryKey: ['identity', 'mfa', 'method', t] })
      );
      toast.success('MFA method deleted');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const invalidateAll = () =>
    MFA_TYPES.forEach((t) =>
      qc.invalidateQueries({ queryKey: ['identity', 'mfa', 'method', t] })
    );

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Select value={createType} onValueChange={(v) => setCreateType(v as MFAType)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MFA_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Create Method
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : allMethods.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            <Shield className="w-8 h-8 opacity-30 mx-auto mb-2" />
            <p className="text-sm">No MFA methods configured</p>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Issuer</TableHead>
              <TableHead>Config</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allMethods.map((m) => {
              const d = details[m.id];
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.id}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="uppercase text-xs">{m.type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{d?.issuer ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.type === 'totp' && d
                      ? `Period: ${d.period ?? 30}s · Digits: ${d.digits ?? 6} · ${d.algorithm ?? 'SHA1'}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete MFA method?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the {m.type.toUpperCase()} method{' '}
                            <code className="font-mono text-xs">{m.id}</code>.
                            Login enforcements referencing it will fail.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground"
                            onClick={() => deleteMutation.mutate({ type: m.type, id: m.id })}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <CreateMethodDialog
          type={createType}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { invalidateAll(); setCreateOpen(false); }}
        />
      </Dialog>
    </div>
  );
}

function CreateMethodDialog({
  type, onClose, onCreated,
}: { type: MFAType; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    issuer: 'OpenBao',
    account_name: '',
    period: '30',
    algorithm: 'SHA1',
    digits: '6',
    skew: '1',
    key_size: '20',
    host: '',
    integration_key: '',
    secret_key: '',
    org_name: '',
    api_token: '',
    base_url: '',
    settings_file_base64: '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => {
      let body: Record<string, unknown> = {};
      if (type === 'totp') {
        body = {
          issuer: form.issuer || undefined,
          account_name: form.account_name || undefined,
          period: parseInt(form.period) || 30,
          algorithm: form.algorithm,
          digits: parseInt(form.digits) || 6,
          skew: parseInt(form.skew) || 1,
          key_size: parseInt(form.key_size) || 20,
        };
      } else if (type === 'duo') {
        body = {
          host: form.host,
          integration_key: form.integration_key,
          secret_key: form.secret_key,
        };
      } else if (type === 'okta') {
        body = {
          org_name: form.org_name,
          api_token: form.api_token,
          base_url: form.base_url || undefined,
        };
      } else if (type === 'pingid') {
        body = { settings_file_base64: form.settings_file_base64 };
      }
      return vaultFetch(`/identity/mfa/method/${type}`, { method: 'POST', body });
    },
    onSuccess: () => { toast.success(`${type.toUpperCase()} method created`); onCreated(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Create {type.toUpperCase()} MFA Method</DialogTitle></DialogHeader>
      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
        {type === 'totp' && (
          <>
            <div className="space-y-1.5">
              <Label>Issuer</Label>
              <Input value={form.issuer} onChange={set('issuer')} placeholder="OpenBao" />
            </div>
            <div className="space-y-1.5">
              <Label>Account Name</Label>
              <Input value={form.account_name} onChange={set('account_name')} placeholder="user@example.com" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Period (s)</Label>
                <Input type="number" value={form.period} onChange={set('period')} />
              </div>
              <div className="space-y-1.5">
                <Label>Digits</Label>
                <Input type="number" value={form.digits} onChange={set('digits')} />
              </div>
              <div className="space-y-1.5">
                <Label>Skew</Label>
                <Input type="number" value={form.skew} onChange={set('skew')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Algorithm</Label>
                <Select
                  value={form.algorithm}
                  onValueChange={(v) => setForm((p) => ({ ...p, algorithm: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHA1">SHA1</SelectItem>
                    <SelectItem value="SHA256">SHA256</SelectItem>
                    <SelectItem value="SHA512">SHA512</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Key Size</Label>
                <Input type="number" value={form.key_size} onChange={set('key_size')} />
              </div>
            </div>
          </>
        )}
        {type === 'duo' && (
          <>
            <div className="space-y-1.5">
              <Label>Host <span className="text-destructive">*</span></Label>
              <Input value={form.host} onChange={set('host')} placeholder="api-xxx.duosecurity.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Integration Key <span className="text-destructive">*</span></Label>
              <Input value={form.integration_key} onChange={set('integration_key')} />
            </div>
            <div className="space-y-1.5">
              <Label>Secret Key <span className="text-destructive">*</span></Label>
              <Input type="password" value={form.secret_key} onChange={set('secret_key')} />
            </div>
          </>
        )}
        {type === 'okta' && (
          <>
            <div className="space-y-1.5">
              <Label>Org Name <span className="text-destructive">*</span></Label>
              <Input value={form.org_name} onChange={set('org_name')} placeholder="dev-123456" />
            </div>
            <div className="space-y-1.5">
              <Label>API Token <span className="text-destructive">*</span></Label>
              <Input type="password" value={form.api_token} onChange={set('api_token')} />
            </div>
            <div className="space-y-1.5">
              <Label>Base URL</Label>
              <Input value={form.base_url} onChange={set('base_url')} placeholder="okta.com" />
            </div>
          </>
        )}
        {type === 'pingid' && (
          <div className="space-y-1.5">
            <Label>Settings File (base64) <span className="text-destructive">*</span></Label>
            <Input
              value={form.settings_file_base64}
              onChange={set('settings_file_base64')}
              placeholder="Base64-encoded PingID settings file"
            />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating…' : 'Create'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Enforcements Tab ─────────────────────────────────────────────────────────

function EnforcementsTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const enforcementsQuery = useQuery({
    queryKey: ['identity', 'mfa', 'enforcements'],
    queryFn: async () => {
      try {
        const res = await vaultFetch<{ data: { keys: string[] } }>(
          '/identity/mfa/login-enforcement', { method: 'LIST' }
        );
        const details = await Promise.allSettled(
          (res.data.keys ?? []).map((name) =>
            vaultFetch<{ data: LoginEnforcement }>(
              `/identity/mfa/login-enforcement/${name}`
            ).then((r) => r.data)
          )
        );
        return details.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      } catch (err) {
        if (err instanceof VaultError && err.status === 404) return [];
        throw err;
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) =>
      vaultFetch(`/identity/mfa/login-enforcement/${name}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['identity', 'mfa', 'enforcements'] });
      toast.success('Login enforcement deleted');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Create Enforcement
        </Button>
      </div>

      {enforcementsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !enforcementsQuery.data?.length ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            <Lock className="w-8 h-8 opacity-30 mx-auto mb-2" />
            <p className="text-sm">No login enforcements configured</p>
            <p className="text-xs mt-1">Login enforcements require MFA for specific auth methods.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {enforcementsQuery.data.map((e) => (
            <Card key={e.name}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-mono">{e.name}</CardTitle>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete enforcement?</AlertDialogTitle>
                      <AlertDialogDescription>
                        MFA will no longer be required for the associated auth methods.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground"
                        onClick={() => deleteMutation.mutate(e.name)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardHeader>
              <CardContent className="space-y-2 text-sm pb-4">
                <div className="flex gap-2 flex-wrap items-center">
                  <span className="text-muted-foreground text-xs shrink-0">MFA Methods:</span>
                  {e.mfa_method_ids?.length
                    ? e.mfa_method_ids.map((id) => (
                        <Badge key={id} variant="secondary" className="font-mono text-xs">
                          {id.slice(0, 8)}…
                        </Badge>
                      ))
                    : <span className="text-xs text-muted-foreground">none</span>}
                </div>
                {!!e.auth_method_types?.length && (
                  <div className="flex gap-2 flex-wrap items-center">
                    <span className="text-muted-foreground text-xs shrink-0">Auth Types:</span>
                    {e.auth_method_types.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                )}
                {!!e.auth_method_accessors?.length && (
                  <div className="flex gap-2 flex-wrap items-center">
                    <span className="text-muted-foreground text-xs shrink-0">Accessors:</span>
                    {e.auth_method_accessors.map((a) => (
                      <code key={a} className="text-xs font-mono bg-muted px-1 rounded">{a}</code>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <CreateEnforcementDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['identity', 'mfa', 'enforcements'] });
            setCreateOpen(false);
          }}
        />
      </Dialog>
    </div>
  );
}

function CreateEnforcementDialog({
  onClose, onCreated,
}: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '',
    mfa_method_ids: '',
    auth_method_types: '',
    auth_method_accessors: '',
    identity_group_ids: '',
    identity_entity_ids: '',
  });

  const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const mutation = useMutation({
    mutationFn: () =>
      vaultFetch(`/identity/mfa/login-enforcement/${form.name}`, {
        method: 'POST',
        body: {
          mfa_method_ids: split(form.mfa_method_ids),
          auth_method_types: split(form.auth_method_types),
          auth_method_accessors: split(form.auth_method_accessors),
          identity_group_ids: split(form.identity_group_ids),
          identity_entity_ids: split(form.identity_entity_ids),
        },
      }),
    onSuccess: () => { toast.success('Login enforcement created'); onCreated(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const row = (key: keyof typeof form, label: string, placeholder: string, required = false) => (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Create Login Enforcement</DialogTitle></DialogHeader>
      <div className="space-y-4">
        {row('name', 'Name', 'my-enforcement', true)}
        {row('mfa_method_ids', 'MFA Method IDs (comma-sep)', 'uuid1, uuid2', true)}
        {row('auth_method_types', 'Auth Method Types (comma-sep)', 'userpass, ldap')}
        {row('auth_method_accessors', 'Auth Method Accessors (comma-sep)', 'auth_userpass_abc123')}
        {row('identity_group_ids', 'Identity Group IDs (comma-sep)', 'group-uuid')}
        {row('identity_entity_ids', 'Identity Entity IDs (comma-sep)', 'entity-uuid')}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!form.name || !form.mfa_method_ids || mutation.isPending}
        >
          {mutation.isPending ? 'Creating…' : 'Create'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MFAPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6" />
        <div>
          <h1 className="text-2xl font-bold">Multi-Factor Authentication</h1>
          <p className="text-muted-foreground text-sm">
            Configure MFA methods and login enforcements.
          </p>
        </div>
      </div>

      <Tabs defaultValue="methods">
        <TabsList>
          <TabsTrigger value="methods">Methods</TabsTrigger>
          <TabsTrigger value="enforcements">Login Enforcements</TabsTrigger>
        </TabsList>
        <TabsContent value="methods" className="mt-4"><MethodsTab /></TabsContent>
        <TabsContent value="enforcements" className="mt-4"><EnforcementsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
