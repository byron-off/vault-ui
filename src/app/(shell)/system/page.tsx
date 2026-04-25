'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ShieldCheck, ShieldOff, Server, Wifi, Wrench, Hash,
  Plus, Trash2, Loader2, RefreshCw, RotateCcw, Users, Gauge, Unlock,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

import { getSealStatus, getHAStatus, unseal, seal, getAuditDevices, enableAuditDevice, disableAuditDevice } from '@/lib/vault/api/sys';
import { vaultFetch } from '@/lib/vault/client';
import { VaultError } from '@/lib/vault/errors';
import { formatTTL } from '@/lib/utils';

// ─── Status Tab ────────────────────────────────────────────────────────────────

function StatusTab() {
  const qc = useQueryClient();
  const [unsealKey, setUnsealKey] = useState('');

  const sealQuery = useQuery({
    queryKey: ['sys', 'seal-status'],
    queryFn: getSealStatus,
    refetchInterval: 5000,
  });

  const haQuery = useQuery({
    queryKey: ['sys', 'ha-status'],
    queryFn: getHAStatus,
  });

  const unsealMutation = useMutation({
    mutationFn: (key: string) => unseal(key),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['sys', 'seal-status'] });
      if (!data.sealed) { toast.success('Vault unsealed successfully'); setUnsealKey(''); }
      else toast.info(`Progress: ${data.progress}/${data.t} shares`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const sealMutation = useMutation({
    mutationFn: seal,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sys', 'seal-status'] }); toast.success('Vault sealed'); },
    onError: (e) => toast.error((e as Error).message),
  });

  const ss = sealQuery.data;

  return (
    <div className="space-y-4">
      {/* Seal Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {ss?.sealed ? <ShieldOff className="w-4 h-4 text-amber-500" /> : <ShieldCheck className="w-4 h-4 text-green-600" />}
            Seal Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sealQuery.isLoading ? <Skeleton className="h-20 w-full" /> : ss && (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <span className="text-muted-foreground">State</span>
                <Badge variant={ss.sealed ? 'warning' : 'success'} className="w-fit">{ss.sealed ? 'Sealed' : 'Unsealed'}</Badge>
                <span className="text-muted-foreground">Type</span><span>{ss.type}</span>
                <span className="text-muted-foreground">Version</span><span className="font-mono text-xs">{ss.version}</span>
                <span className="text-muted-foreground">Cluster</span><span>{ss.cluster_name || '—'}</span>
                {ss.sealed && <><span className="text-muted-foreground">Progress</span><span>{ss.progress}/{ss.t}</span></>}
              </div>

              {ss.sealed ? (
                <div className="space-y-2 pt-2">
                  <Label>Unseal Key Share</Label>
                  <div className="flex gap-2">
                    <Input type="password" placeholder="Enter key share…" value={unsealKey}
                      onChange={(e) => setUnsealKey(e.target.value)} className="font-mono text-sm" />
                    <Button onClick={() => unsealMutation.mutate(unsealKey)} disabled={!unsealKey || unsealMutation.isPending}>
                      {unsealMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      Submit
                    </Button>
                  </div>
                </div>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><ShieldOff className="w-4 h-4" />Seal Vault</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Seal the vault?</AlertDialogTitle>
                      <AlertDialogDescription>All requests will fail until the vault is unsealed again. Requires key shares to unseal.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => sealMutation.mutate()}>Seal</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* HA Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Wifi className="w-4 h-4" />HA Status</CardTitle>
        </CardHeader>
        <CardContent>
          {haQuery.isLoading ? <Skeleton className="h-16 w-full" /> : haQuery.error ? (
            <p className="text-sm text-muted-foreground">HA not enabled or endpoint unavailable.</p>
          ) : haQuery.data && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <span className="text-muted-foreground">HA Enabled</span>
                <Badge variant={haQuery.data.ha_enabled ? 'success' : 'secondary'}>{haQuery.data.ha_enabled ? 'Yes' : 'No'}</Badge>
                <span className="text-muted-foreground">Leader</span>
                <span className="font-mono text-xs">{haQuery.data.leader_address || '—'}</span>
                <span className="text-muted-foreground">Is Self</span>
                <span>{haQuery.data.is_self ? 'Yes' : 'No'}</span>
              </div>
              {haQuery.data.nodes && haQuery.data.nodes.length > 0 && (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Address</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {haQuery.data.nodes.map((n) => (
                      <TableRow key={n.api_address}>
                        <TableCell className="font-mono text-xs">{n.api_address}</TableCell>
                        <TableCell>{n.active_node ? <Badge variant="success">Leader</Badge> : <Badge variant="secondary">Standby</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Audit Tab ─────────────────────────────────────────────────────────────────

function AuditTab() {
  const qc = useQueryClient();
  const [enableOpen, setEnableOpen] = useState(false);
  const [form, setForm] = useState({ path: '', type: 'file', description: '', file_path: '' });

  const devicesQuery = useQuery({ queryKey: ['sys', 'audit'], queryFn: getAuditDevices });

  const enableMutation = useMutation({
    mutationFn: () => enableAuditDevice(form.path, {
      type: form.type, description: form.description,
      options: form.type === 'file' ? { file_path: form.file_path } : {},
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sys', 'audit'] }); toast.success('Audit device enabled'); setEnableOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });

  const disableMutation = useMutation({
    mutationFn: disableAuditDevice,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sys', 'audit'] }); toast.success('Audit device disabled'); },
    onError: (e) => toast.error((e as Error).message),
  });

  const devices = devicesQuery.data ? Object.entries(devicesQuery.data) : [];

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>Audit log <strong>content</strong> is not readable via API. This page only manages audit device configuration.</AlertDescription>
      </Alert>

      <div className="flex items-center justify-between">
        <h3 className="font-medium">Audit Devices</h3>
        <Button size="sm" onClick={() => setEnableOpen(true)}><Plus className="w-4 h-4" />Enable Device</Button>
      </div>

      {devicesQuery.isLoading ? <Skeleton className="h-24 w-full" /> : devices.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No audit devices configured</p>
      ) : (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Path</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="w-20">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {devices.map(([path, d]) => (
              <TableRow key={path}>
                <TableCell className="font-mono text-sm">{path}</TableCell>
                <TableCell><Badge variant="secondary">{(d as { type: string }).type}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{(d as { description?: string }).description || '—'}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Disable audit device?</AlertDialogTitle><AlertDialogDescription>Audit logs will no longer be sent to <strong>{path}</strong>.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => disableMutation.mutate(path)}>Disable</AlertDialogAction>
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

      <Dialog open={enableOpen} onOpenChange={setEnableOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enable Audit Device</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="file">File</SelectItem><SelectItem value="syslog">Syslog</SelectItem><SelectItem value="socket">Socket</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Path <span className="text-destructive">*</span></Label><Input placeholder="audit/" value={form.path} onChange={(e) => setForm((p) => ({ ...p, path: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            {form.type === 'file' && <div className="space-y-1.5"><Label>File Path</Label><Input placeholder="/var/log/vault-audit.log" value={form.file_path} onChange={(e) => setForm((p) => ({ ...p, file_path: e.target.value }))} /></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnableOpen(false)}>Cancel</Button>
            <Button onClick={() => enableMutation.mutate()} disabled={!form.path || enableMutation.isPending}>Enable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── CORS Tab ──────────────────────────────────────────────────────────────────

function CORSTab() {
  const qc = useQueryClient();
  const corsQuery = useQuery({
    queryKey: ['sys', 'cors'],
    queryFn: () => vaultFetch<{ data: { enabled: boolean; allowed_origins: string[]; allowed_headers: string[] } }>('/sys/config/cors').then(r => r.data),
  });

  const [enabled, setEnabled] = useState(false);
  const [origins, setOrigins] = useState('');
  const [headers, setHeaders] = useState('');
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (corsQuery.data && !seeded) {
      setEnabled(corsQuery.data.enabled ?? false);
      setOrigins(corsQuery.data.allowed_origins?.join('\n') ?? '');
      setHeaders(corsQuery.data.allowed_headers?.join('\n') ?? '');
      setSeeded(true);
    }
  }, [corsQuery.data, seeded]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const parsedOrigins = origins.split('\n').map(s => s.trim()).filter(Boolean);
      if (enabled && parsedOrigins.length === 0) {
        throw new Error('At least one allowed origin (or *) must be provided when CORS is enabled.');
      }
      return vaultFetch('/sys/config/cors', {
        method: 'POST',
        body: { enabled, allowed_origins: parsedOrigins, allowed_headers: headers.split('\n').map(s => s.trim()).filter(Boolean) },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sys', 'cors'] }); toast.success('CORS config saved'); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4 max-w-lg">
      {corsQuery.isLoading ? <Skeleton className="h-40 w-full" /> : (
        <Card><CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Label>Enable CORS</Label>
          </div>
          <div className="space-y-1.5">
            <Label>Allowed Origins (one per line)</Label>
            <Textarea rows={4} value={origins} onChange={(e) => setOrigins(e.target.value)} placeholder={'https://example.com\n*'} />
            <p className="text-xs text-muted-foreground">Use <code className="font-mono">*</code> to allow all origins.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Allowed Headers (one per line)</Label>
            <Textarea rows={3} value={headers} onChange={(e) => setHeaders(e.target.value)} placeholder="X-Custom-Header" />
          </div>
          <div className="flex justify-end"><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Save</Button></div>
        </CardContent></Card>
      )}
    </div>
  );
}

// ─── Tools Tab ─────────────────────────────────────────────────────────────────

function ToolsTab() {
  const [hashInput, setHashInput] = useState('');
  const [hashAlgo, setHashAlgo] = useState('sha2-256');
  const [hashFmt, setHashFmt] = useState('hex');
  const [hashResult, setHashResult] = useState('');
  const [randomBytes, setRandomBytes] = useState('32');
  const [randomFmt, setRandomFmt] = useState('hex');
  const [randomResult, setRandomResult] = useState('');

  const hashMutation = useMutation({
    mutationFn: () => vaultFetch<{ data: { sum: string } }>(`/sys/tools/hash/${hashAlgo}`, {
      method: 'POST', body: { input: btoa(hashInput), format: hashFmt },
    }),
    onSuccess: (r) => setHashResult(r.data.sum),
    onError: (e) => toast.error((e as Error).message),
  });

  const randomMutation = useMutation({
    mutationFn: () => vaultFetch<{ data: { random_bytes: string } }>(`/sys/tools/random/${randomBytes}`, {
      method: 'POST', body: { format: randomFmt },
    }),
    onSuccess: (r) => setRandomResult(r.data.random_bytes),
    onError: (e) => toast.error((e as Error).message),
  });

  const ALGOS = ['sha2-224','sha2-256','sha2-384','sha2-512','sha3-224','sha3-256','sha3-384','sha3-512'];

  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Hash className="w-4 h-4" />Hash</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Input</Label><Textarea value={hashInput} onChange={(e) => setHashInput(e.target.value)} placeholder="Text to hash" rows={3} /></div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5"><Label>Algorithm</Label>
              <Select value={hashAlgo} onValueChange={setHashAlgo}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ALGOS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Format</Label>
              <Select value={hashFmt} onValueChange={setHashFmt}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="hex">hex</SelectItem><SelectItem value="base64">base64</SelectItem></SelectContent></Select></div>
          </div>
          <Button onClick={() => hashMutation.mutate()} disabled={!hashInput || hashMutation.isPending}>Hash</Button>
          {hashResult && <code className="block font-mono text-xs bg-muted rounded px-3 py-2 break-all">{hashResult}</code>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><RefreshCw className="w-4 h-4" />Random Bytes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3 items-end">
            <div className="space-y-1.5"><Label>Bytes</Label><Input type="number" value={randomBytes} onChange={(e) => setRandomBytes(e.target.value)} className="w-24" /></div>
            <div className="space-y-1.5"><Label>Format</Label>
              <Select value={randomFmt} onValueChange={setRandomFmt}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="hex">hex</SelectItem><SelectItem value="base64">base64</SelectItem></SelectContent></Select></div>
            <Button onClick={() => randomMutation.mutate()} disabled={randomMutation.isPending}>Generate</Button>
          </div>
          {randomResult && <code className="block font-mono text-xs bg-muted rounded px-3 py-2 break-all">{randomResult}</code>}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Rotate Tab ────────────────────────────────────────────────────────────────

function RotateTab() {
  const qc = useQueryClient();

  const keyStatusQuery = useQuery({
    queryKey: ['sys', 'key-status'],
    queryFn: () =>
      vaultFetch<{ data: { term: number; install_time: string; encryptions: number } }>(
        '/sys/key-status'
      ).then((r) => r.data),
  });

  const rotateMutation = useMutation({
    mutationFn: () => vaultFetch('/sys/rotate', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sys', 'key-status'] });
      toast.success('Encryption key rotated successfully');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const ks = keyStatusQuery.data;

  return (
    <div className="space-y-4 max-w-lg">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Encryption Key Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {keyStatusQuery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : ks ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <span className="text-muted-foreground">Current Term</span>
              <span className="font-mono">{ks.term}</span>
              <span className="text-muted-foreground">Installed</span>
              <span className="text-sm">{new Date(ks.install_time).toLocaleString()}</span>
              <span className="text-muted-foreground">Encryptions</span>
              <span className="font-mono">{ks.encryptions?.toLocaleString() ?? '—'}</span>
            </div>
          ) : null}

          <Alert>
            <AlertDescription className="text-sm">
              Rotating the encryption key generates a new key for encrypting new data. Existing
              data remains readable and will be re-encrypted lazily on next access.
            </AlertDescription>
          </Alert>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={rotateMutation.isPending}>
                <RotateCcw className={`w-4 h-4 mr-2 ${rotateMutation.isPending ? 'animate-spin' : ''}`} />
                Rotate Encryption Key
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rotate encryption key?</AlertDialogTitle>
                <AlertDialogDescription>
                  A new encryption key (term {(ks?.term ?? 0) + 1}) will be generated and used
                  for all new data. This operation cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => rotateMutation.mutate()}>Rotate</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Quotas Tab ─────────────────────────────────────────────────────────────────

type RateLimitQuota = {
  name: string;
  path: string;
  rate: number;
  interval: number;
  block_interval: number;
  type: string;
};

function QuotasTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', path: '', rate: '100', interval: '1', block_interval: '0' });

  const listQuery = useQuery({
    queryKey: ['sys', 'quotas', 'rate-limit'],
    queryFn: async () => {
      try {
        const res = await vaultFetch<{ data: { keys: string[] } }>(
          '/sys/quotas/rate-limit', { method: 'LIST' }
        );
        const details = await Promise.allSettled(
          (res.data.keys ?? []).map((name) =>
            vaultFetch<{ data: RateLimitQuota }>(`/sys/quotas/rate-limit/${name}`).then((r) => r.data)
          )
        );
        return details.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      } catch (err) {
        if (err instanceof VaultError && err.status === 404) return [];
        throw err;
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      vaultFetch(`/sys/quotas/rate-limit/${form.name}`, {
        method: 'POST',
        body: {
          path: form.path || undefined,
          rate: parseFloat(form.rate),
          interval: parseInt(form.interval) || 1,
          block_interval: parseInt(form.block_interval) || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sys', 'quotas'] });
      toast.success('Rate limit quota created');
      setCreateOpen(false);
      setForm({ name: '', path: '', rate: '100', interval: '1', block_interval: '0' });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) =>
      vaultFetch(`/sys/quotas/rate-limit/${name}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sys', 'quotas'] });
      toast.success('Quota deleted');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const quotas = listQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Rate Limit Quotas</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Quota
        </Button>
      </div>

      {listQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : quotas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No rate limit quotas configured</p>
      ) : (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Rate (req/s)</TableHead>
              <TableHead>Interval (s)</TableHead>
              <TableHead>Block Interval (s)</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotas.map((q) => (
              <TableRow key={q.name}>
                <TableCell className="font-mono text-sm">{q.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{q.path || <span className="italic">global</span>}</TableCell>
                <TableCell>{q.rate}</TableCell>
                <TableCell>{q.interval}</TableCell>
                <TableCell>{q.block_interval || '—'}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete quota?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the rate limit quota <strong>{q.name}</strong>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground"
                          onClick={() => deleteMutation.mutate(q.name)}
                        >
                          Delete
                        </AlertDialogAction>
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
          <DialogHeader><DialogTitle>Create Rate Limit Quota</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input placeholder="global-rate-limit" value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Path (leave empty for global)</Label>
              <Input placeholder="auth/userpass/" value={form.path}
                onChange={(e) => setForm((p) => ({ ...p, path: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Rate (req/s) <span className="text-destructive">*</span></Label>
                <Input type="number" value={form.rate}
                  onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Interval (s)</Label>
                <Input type="number" value={form.interval}
                  onChange={(e) => setForm((p) => ({ ...p, interval: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Block Interval (s)</Label>
                <Input type="number" value={form.block_interval}
                  onChange={(e) => setForm((p) => ({ ...p, block_interval: e.target.value }))} />
                <p className="text-xs text-muted-foreground">0 = no block</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.name || !form.rate || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Locked Users Tab ───────────────────────────────────────────────────────────

type LockedAlias = { name: string; last_failed_login?: string; failed_login_count?: number };
type LockedMount = { alias_count: number; aliases: LockedAlias[] };

function LockedUsersTab() {
  const qc = useQueryClient();

  const lockedQuery = useQuery({
    queryKey: ['sys', 'locked-users'],
    queryFn: async () => {
      try {
        const res = await vaultFetch<{ data: { by_mount: Record<string, LockedMount> } }>(
          '/sys/locked-users'
        );
        return res.data.by_mount ?? {};
      } catch (err) {
        if (err instanceof VaultError && err.status === 404) return {};
        throw err;
      }
    },
  });

  const unlockMutation = useMutation({
    mutationFn: ({ accessor, aliasName }: { accessor: string; aliasName: string }) =>
      vaultFetch(`/sys/locked-users/${accessor}/unlock`, {
        method: 'POST',
        body: { alias_identifier: aliasName },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sys', 'locked-users'] });
      toast.success('User unlocked');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const byMount = lockedQuery.data ?? {};
  const entries = Object.entries(byMount);
  const totalLocked = entries.reduce((sum, [, m]) => sum + (m.alias_count ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Locked Users</h3>
        <Button
          variant="outline" size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ['sys', 'locked-users'] })}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {lockedQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : entries.length === 0 || totalLocked === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-10">
            <Users className="w-8 h-8 opacity-30 mx-auto mb-2" />
            <p className="text-sm">No locked users</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map(([accessor, mount]) => (
            <Card key={accessor}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  {accessor}
                  <Badge variant="destructive" className="text-xs">{mount.alias_count} locked</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Failed Attempts</TableHead>
                      <TableHead>Last Failed</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(mount.aliases ?? []).map((alias) => (
                      <TableRow key={alias.name}>
                        <TableCell className="font-mono text-sm">{alias.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{alias.failed_login_count ?? '—'}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {alias.last_failed_login
                            ? new Date(alias.last_failed_login).toLocaleString()
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => unlockMutation.mutate({ accessor, aliasName: alias.name })}
                            disabled={unlockMutation.isPending}
                          >
                            <Unlock className="w-3.5 h-3.5 mr-1" /> Unlock
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SystemPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Server className="w-6 h-6" />
        <div>
          <h1 className="text-2xl font-bold">System</h1>
          <p className="text-muted-foreground text-sm">Cluster management and configuration.</p>
        </div>
      </div>
      <Tabs defaultValue="status">
        <TabsList>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="cors">CORS</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="rotate">Key Rotation</TabsTrigger>
          <TabsTrigger value="quotas"><Gauge className="w-3.5 h-3.5 mr-1" />Quotas</TabsTrigger>
          <TabsTrigger value="locked-users"><Users className="w-3.5 h-3.5 mr-1" />Locked Users</TabsTrigger>
        </TabsList>
        <TabsContent value="status" className="mt-4"><StatusTab /></TabsContent>
        <TabsContent value="audit" className="mt-4"><AuditTab /></TabsContent>
        <TabsContent value="cors" className="mt-4"><CORSTab /></TabsContent>
        <TabsContent value="tools" className="mt-4"><ToolsTab /></TabsContent>
        <TabsContent value="rotate" className="mt-4"><RotateTab /></TabsContent>
        <TabsContent value="quotas" className="mt-4"><QuotasTab /></TabsContent>
        <TabsContent value="locked-users" className="mt-4"><LockedUsersTab /></TabsContent>
      </Tabs>
    </div>
  );
}
