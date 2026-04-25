'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, Check, RotateCcw, ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { vaultFetch } from '@/lib/vault/client';

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

// ─── PKI ──────────────────────────────────────────────────────────────────────

function PKIEngine({ mount }: { mount: string }) {
  const [issueForm, setIssueForm] = useState({ role: '', common_name: '', ttl: '' });
  const [roleForm, setRoleForm] = useState({ name: '', allowed_domains: '', allow_subdomains: false, ttl: '720h' });
  const [issuedCert, setIssuedCert] = useState<{ certificate: string; private_key?: string } | null>(null);
  const [caForm, setCAForm] = useState({ common_name: '', ttl: '87600h', key_type: 'rsa', key_bits: '2048' });
  const [caResult, setCAResult] = useState('');
  const qc = useQueryClient();

  const rolesQ = useQuery({ queryKey: ['engine', mount, 'roles'], queryFn: () => vaultFetch<{ data: { keys: string[] } }>(`/${mount}/roles`, { method: 'LIST' }).then(r => r.data.keys).catch(() => [] as string[]) });
  const caQ = useQuery({ queryKey: ['engine', mount, 'ca'], queryFn: () => vaultFetch<string>(`/${mount}/ca/pem`).catch(() => '') });
  const certsQ = useQuery({ queryKey: ['engine', mount, 'certs'], queryFn: () => vaultFetch<{ data: { keys: string[] } }>(`/${mount}/certs`, { method: 'LIST' }).then(r => r.data.keys).catch(() => [] as string[]) });

  const generateCA = useMutation({
    mutationFn: (type: 'internal' | 'exported') => vaultFetch<{ data: { certificate: string } }>(`/${mount}/root/generate/${type}`, { method: 'POST', body: caForm }),
    onSuccess: (r) => { setCAResult(r.data.certificate); qc.invalidateQueries({ queryKey: ['engine', mount, 'ca'] }); toast.success('CA generated'); },
    onError: (e) => toast.error((e as Error).message),
  });

  const createRole = useMutation({
    mutationFn: () => vaultFetch(`/${mount}/roles/${roleForm.name}`, { method: 'POST', body: { allowed_domains: roleForm.allowed_domains, allow_subdomains: roleForm.allow_subdomains, ttl: roleForm.ttl } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['engine', mount, 'roles'] }); toast.success('Role created'); setRoleForm({ name: '', allowed_domains: '', allow_subdomains: false, ttl: '720h' }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const issueCert = useMutation({
    mutationFn: () => vaultFetch<{ data: { certificate: string; private_key: string } }>(`/${mount}/issue/${issueForm.role}`, { method: 'POST', body: { common_name: issueForm.common_name, ttl: issueForm.ttl } }),
    onSuccess: (r) => { setIssuedCert(r.data); toast.success('Certificate issued'); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Tabs defaultValue="ca">
      <TabsList><TabsTrigger value="ca">CA Config</TabsTrigger><TabsTrigger value="roles">Roles</TabsTrigger><TabsTrigger value="issue">Issue Certificate</TabsTrigger><TabsTrigger value="revoked">Revoked</TabsTrigger></TabsList>

      <TabsContent value="ca" className="mt-4 space-y-4">
        {caQ.data && <Card><CardHeader><CardTitle className="text-sm">Current CA</CardTitle></CardHeader><CardContent><pre className="text-xs font-mono bg-muted rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">{String(caQ.data)}</pre></CardContent></Card>}
        <Card><CardHeader><CardTitle className="text-sm">Generate Root CA</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Common Name</Label><Input value={caForm.common_name} onChange={e => setCAForm(p => ({ ...p, common_name: e.target.value }))} placeholder="example.com" /></div>
            <div className="space-y-1.5"><Label>TTL</Label><Input value={caForm.ttl} onChange={e => setCAForm(p => ({ ...p, ttl: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Key Type</Label><Select value={caForm.key_type} onValueChange={v => setCAForm(p => ({ ...p, key_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rsa">RSA</SelectItem><SelectItem value="ec">EC</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Key Bits</Label><Input value={caForm.key_bits} onChange={e => setCAForm(p => ({ ...p, key_bits: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => generateCA.mutate('internal')} disabled={!caForm.common_name || generateCA.isPending}>Generate (Internal)</Button>
            <Button variant="outline" onClick={() => generateCA.mutate('exported')} disabled={!caForm.common_name || generateCA.isPending}>Generate (Exported)</Button>
          </div>
          {caResult && <div className="space-y-1"><div className="flex items-center gap-2"><Label>Certificate</Label><CopyBtn text={caResult} /></div><pre className="text-xs font-mono bg-muted rounded p-3 overflow-auto max-h-40 whitespace-pre-wrap">{caResult}</pre></div>}
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="roles" className="mt-4 space-y-4">
        <Card><CardHeader><CardTitle className="text-sm">Create Role</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={roleForm.name} onChange={e => setRoleForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Allowed Domains</Label><Input value={roleForm.allowed_domains} onChange={e => setRoleForm(p => ({ ...p, allowed_domains: e.target.value }))} placeholder="example.com" /></div>
            <div className="space-y-1.5"><Label>TTL</Label><Input value={roleForm.ttl} onChange={e => setRoleForm(p => ({ ...p, ttl: e.target.value }))} /></div>
          </div>
          <Button onClick={() => createRole.mutate()} disabled={!roleForm.name || createRole.isPending}>Create Role</Button>
        </CardContent></Card>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-20">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{(rolesQ.data ?? []).map(r => <TableRow key={r}><TableCell className="font-mono text-sm">{r}</TableCell><TableCell>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { await vaultFetch(`/${mount}/roles/${r}`, { method: 'DELETE' }); qc.invalidateQueries({ queryKey: ['engine', mount, 'roles'] }); toast.success('Role deleted'); }}><Trash2 className="w-3.5 h-3.5" /></Button>
          </TableCell></TableRow>)}</TableBody>
        </Table></div>
      </TabsContent>

      <TabsContent value="issue" className="mt-4">
        <Card><CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Role</Label><Select value={issueForm.role} onValueChange={v => setIssueForm(p => ({ ...p, role: v }))}><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger><SelectContent>{(rolesQ.data ?? []).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Common Name</Label><Input value={issueForm.common_name} onChange={e => setIssueForm(p => ({ ...p, common_name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>TTL</Label><Input value={issueForm.ttl} onChange={e => setIssueForm(p => ({ ...p, ttl: e.target.value }))} placeholder="720h" /></div>
          </div>
          <Button onClick={() => issueCert.mutate()} disabled={!issueForm.role || !issueForm.common_name || issueCert.isPending}>Issue Certificate</Button>
          {issuedCert && <div className="space-y-3 mt-4">
            <div className="space-y-1"><div className="flex items-center gap-2"><Label>Certificate</Label><CopyBtn text={issuedCert.certificate} /></div><pre className="text-xs font-mono bg-muted rounded p-3 overflow-auto max-h-40">{issuedCert.certificate}</pre></div>
            {issuedCert.private_key && <div className="space-y-1"><div className="flex items-center gap-2"><Label>Private Key</Label><CopyBtn text={issuedCert.private_key} /></div><pre className="text-xs font-mono bg-muted rounded p-3 overflow-auto max-h-40">{issuedCert.private_key}</pre></div>}
          </div>}
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="revoked" className="mt-4">
        {certsQ.isLoading ? <Skeleton className="h-24 w-full" /> : (certsQ.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No certificates issued</p> : (
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Serial Number</TableHead></TableRow></TableHeader>
            <TableBody>{(certsQ.data ?? []).map(s => <TableRow key={s}><TableCell className="font-mono text-xs">{s}</TableCell></TableRow>)}</TableBody>
          </Table></div>
        )}
      </TabsContent>
    </Tabs>
  );
}

// ─── Transit ──────────────────────────────────────────────────────────────────

function TransitEngine({ mount }: { mount: string }) {
  const qc = useQueryClient();
  const [selKey, setSelKey] = useState('');
  const [plaintext, setPlaintext] = useState('');
  const [ciphertext, setCiphertext] = useState('');
  const [encResult, setEncResult] = useState('');
  const [decResult, setDecResult] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyType, setNewKeyType] = useState('aes256-gcm96');

  const keysQ = useQuery({ queryKey: ['engine', mount, 'keys'], queryFn: () => vaultFetch<{ data: { keys: string[] } }>(`/${mount}/keys`, { method: 'LIST' }).then(r => r.data.keys).catch(() => [] as string[]) });

  const createKey = useMutation({
    mutationFn: () => vaultFetch(`/${mount}/keys/${newKeyName}`, { method: 'POST', body: { type: newKeyType } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['engine', mount, 'keys'] }); toast.success('Key created'); setNewKeyName(''); },
    onError: (e) => toast.error((e as Error).message),
  });

  const rotateKey = useMutation({
    mutationFn: (name: string) => vaultFetch(`/${mount}/keys/${name}/rotate`, { method: 'POST' }),
    onSuccess: () => toast.success('Key rotated'),
    onError: (e) => toast.error((e as Error).message),
  });

  const encryptMutation = useMutation({
    mutationFn: () => vaultFetch<{ data: { ciphertext: string } }>(`/${mount}/encrypt/${selKey}`, { method: 'POST', body: { plaintext: btoa(plaintext) } }),
    onSuccess: (r) => setEncResult(r.data.ciphertext),
    onError: (e) => toast.error((e as Error).message),
  });

  const decryptMutation = useMutation({
    mutationFn: () => vaultFetch<{ data: { plaintext: string } }>(`/${mount}/decrypt/${selKey}`, { method: 'POST', body: { ciphertext } }),
    onSuccess: (r) => setDecResult(atob(r.data.plaintext)),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Tabs defaultValue="keys">
      <TabsList><TabsTrigger value="keys">Keys</TabsTrigger><TabsTrigger value="encrypt">Encrypt / Decrypt</TabsTrigger></TabsList>

      <TabsContent value="keys" className="mt-4 space-y-4">
        <Card><CardContent className="pt-6 flex gap-3 items-end">
          <div className="space-y-1.5 flex-1"><Label>Key Name</Label><Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Type</Label><Select value={newKeyType} onValueChange={setNewKeyType}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aes256-gcm96">aes256-gcm96</SelectItem><SelectItem value="rsa-2048">rsa-2048</SelectItem><SelectItem value="rsa-4096">rsa-4096</SelectItem><SelectItem value="ecdsa-p256">ecdsa-p256</SelectItem><SelectItem value="ed25519">ed25519</SelectItem></SelectContent></Select></div>
          <Button onClick={() => createKey.mutate()} disabled={!newKeyName || createKey.isPending}>Create</Button>
        </CardContent></Card>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-40">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{(keysQ.data ?? []).map(k => <TableRow key={k}><TableCell className="font-mono text-sm">{k}</TableCell><TableCell className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => rotateKey.mutate(k)}><RotateCcw className="w-3.5 h-3.5" />Rotate</Button>
            <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete key?</AlertDialogTitle><AlertDialogDescription>This will permanently delete transit key <strong>{k}</strong>. Data encrypted with it cannot be recovered.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => { await vaultFetch(`/${mount}/keys/${k}/config`, { method: 'POST', body: { deletion_allowed: true } }); await vaultFetch(`/${mount}/keys/${k}`, { method: 'DELETE' }); qc.invalidateQueries({ queryKey: ['engine', mount, 'keys'] }); toast.success('Key deleted'); }}>Delete</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent></AlertDialog>
          </TableCell></TableRow>)}</TableBody>
        </Table></div>
      </TabsContent>

      <TabsContent value="encrypt" className="mt-4 space-y-4">
        <div className="space-y-1.5"><Label>Key</Label><Select value={selKey} onValueChange={setSelKey}><SelectTrigger><SelectValue placeholder="Select key" /></SelectTrigger><SelectContent>{(keysQ.data ?? []).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-4">
          <Card><CardContent className="pt-4 space-y-2">
            <Label>Plaintext</Label><Textarea rows={4} value={plaintext} onChange={e => setPlaintext(e.target.value)} />
            <Button onClick={() => encryptMutation.mutate()} disabled={!selKey || !plaintext || encryptMutation.isPending}>Encrypt</Button>
            {encResult && <div className="space-y-1"><div className="flex items-center gap-2"><Label>Ciphertext</Label><CopyBtn text={encResult} /></div><code className="block text-xs font-mono bg-muted rounded p-2 break-all">{encResult}</code></div>}
          </CardContent></Card>
          <Card><CardContent className="pt-4 space-y-2">
            <Label>Ciphertext</Label><Textarea rows={4} value={ciphertext} onChange={e => setCiphertext(e.target.value)} />
            <Button onClick={() => decryptMutation.mutate()} disabled={!selKey || !ciphertext || decryptMutation.isPending}>Decrypt</Button>
            {decResult && <div className="space-y-1"><Label>Plaintext</Label><code className="block text-xs font-mono bg-muted rounded p-2 break-all">{decResult}</code></div>}
          </CardContent></Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ─── TOTP ─────────────────────────────────────────────────────────────────────

function TOTPEngine({ mount }: { mount: string }) {
  const qc = useQueryClient();
  const [selKey, setSelKey] = useState('');
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [newKey, setNewKey] = useState({ name: '', issuer: '', account_name: '' });

  const keysQ = useQuery({ queryKey: ['engine', mount, 'keys'], queryFn: () => vaultFetch<{ data: { keys: string[] } }>(`/${mount}/keys`, { method: 'LIST' }).then(r => r.data.keys).catch(() => [] as string[]) });

  const codeQ = useQuery({
    queryKey: ['engine', mount, 'code', selKey],
    queryFn: () => vaultFetch<{ data: { code: string } }>(`/${mount}/code/${selKey}`).then(r => r.data.code),
    enabled: !!selKey,
    refetchInterval: 30000,
  });

  const createKey = useMutation({
    mutationFn: () => vaultFetch(`/${mount}/keys/${newKey.name}`, { method: 'POST', body: { generate: true, issuer: newKey.issuer, account_name: newKey.account_name, period: 30, digits: 6 } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['engine', mount, 'keys'] }); toast.success('TOTP key created'); setNewKey({ name: '', issuer: '', account_name: '' }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const validateMutation = useMutation({
    mutationFn: () => vaultFetch<{ data: { valid: boolean } }>(`/${mount}/code/${selKey}`, { method: 'POST', body: { code } }),
    onSuccess: (r) => r.data.valid ? toast.success('Code is valid') : toast.error('Code is invalid'),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Tabs defaultValue="keys">
      <TabsList><TabsTrigger value="keys">Keys</TabsTrigger><TabsTrigger value="generate">Generate</TabsTrigger><TabsTrigger value="validate">Validate</TabsTrigger></TabsList>

      <TabsContent value="keys" className="mt-4 space-y-4">
        <Card><CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={newKey.name} onChange={e => setNewKey(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Issuer</Label><Input value={newKey.issuer} onChange={e => setNewKey(p => ({ ...p, issuer: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Account</Label><Input value={newKey.account_name} onChange={e => setNewKey(p => ({ ...p, account_name: e.target.value }))} /></div>
          </div>
          <Button onClick={() => createKey.mutate()} disabled={!newKey.name || createKey.isPending}>Create Key</Button>
        </CardContent></Card>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-20">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{(keysQ.data ?? []).map(k => <TableRow key={k}><TableCell className="font-mono text-sm">{k}</TableCell><TableCell>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { await vaultFetch(`/${mount}/keys/${k}`, { method: 'DELETE' }); qc.invalidateQueries({ queryKey: ['engine', mount, 'keys'] }); toast.success('Key deleted'); }}><Trash2 className="w-3.5 h-3.5" /></Button>
          </TableCell></TableRow>)}</TableBody>
        </Table></div>
      </TabsContent>

      <TabsContent value="generate" className="mt-4 space-y-4">
        <Select value={selKey} onValueChange={setSelKey}><SelectTrigger><SelectValue placeholder="Select key" /></SelectTrigger><SelectContent>{(keysQ.data ?? []).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>
        {selKey && <Card><CardContent className="pt-6 text-center">
          {codeQ.isLoading ? <Skeleton className="h-16 w-32 mx-auto" /> : <div className="text-4xl font-mono font-bold tracking-widest">{codeQ.data}</div>}
          <p className="text-xs text-muted-foreground mt-2">Refreshes every 30 seconds</p>
        </CardContent></Card>}
      </TabsContent>

      <TabsContent value="validate" className="mt-4 space-y-4">
        <Select value={selKey} onValueChange={setSelKey}><SelectTrigger><SelectValue placeholder="Select key" /></SelectTrigger><SelectContent>{(keysQ.data ?? []).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>
        <div className="flex gap-2">
          <Input value={code} onChange={e => setCode(e.target.value)} placeholder="000000" maxLength={6} className="font-mono text-lg w-32 text-center" />
          <Button onClick={() => validateMutation.mutate()} disabled={!selKey || code.length < 6 || validateMutation.isPending}>Validate</Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ─── Generic fallback ─────────────────────────────────────────────────────────

function GenericEngine({ mount }: { mount: string }) {
  const [path, setPath] = useState('');
  const [method, setMethod] = useState('GET');
  const [body, setBody] = useState('');
  const [result, setResult] = useState('');
  const [err, setErr] = useState('');

  const run = async () => {
    setResult(''); setErr('');
    try {
      const r = await vaultFetch<unknown>(`/${mount}/${path}`, {
        method: method as 'GET' | 'POST' | 'DELETE' | 'LIST',
        body: body ? JSON.parse(body) : undefined,
      });
      setResult(JSON.stringify(r, null, 2));
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <Alert><AlertDescription>This engine type doesn't have a dedicated UI. Use the raw API explorer below.</AlertDescription></Alert>
      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex gap-2 items-end">
          <div className="space-y-1.5"><Label>Method</Label><Select value={method} onValueChange={setMethod}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="LIST">LIST</SelectItem><SelectItem value="POST">POST</SelectItem><SelectItem value="DELETE">DELETE</SelectItem></SelectContent></Select></div>
          <div className="flex-1 space-y-1.5"><Label>Path (relative to /{mount}/)</Label><Input value={path} onChange={e => setPath(e.target.value)} placeholder="config" /></div>
        </div>
        {(method === 'POST') && <div className="space-y-1.5"><Label>Body (JSON)</Label><Textarea rows={4} value={body} onChange={e => setBody(e.target.value)} className="font-mono text-xs" /></div>}
        <Button onClick={run}>Run</Button>
        {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
        {result && <pre className="text-xs font-mono bg-muted rounded p-3 overflow-auto max-h-80">{result}</pre>}
      </CardContent></Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EngineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const mount = Array.isArray(params?.mount) ? params.mount[0] : (params?.mount as string);

  const mountsQ = useQuery({
    queryKey: ['mounts', 'secret', 'detail'],
    queryFn: () => vaultFetch<{ data: Record<string, { type: string }> }>('/sys/mounts').then(r => r.data),
  });

  const mountInfo = mountsQ.data?.[`${mount}/`];
  const engineType = mountInfo?.type ?? '';

  if (mountsQ.isLoading) return <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;

  if (!mountInfo) return <Alert variant="destructive"><AlertDescription>Mount <strong>{mount}</strong> not found.</AlertDescription></Alert>;

  const renderEngine = () => {
    if (engineType === 'kv') { router.replace('/secrets'); return null; }
    if (engineType === 'pki') return <PKIEngine mount={mount} />;
    if (engineType === 'transit') return <TransitEngine mount={mount} />;
    if (engineType === 'totp') return <TOTPEngine mount={mount} />;
    return <GenericEngine mount={mount} />;
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/engines')} className="text-muted-foreground mb-2"><ChevronLeft className="w-4 h-4" />Engines</Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-mono">{mount}/</h1>
          <Badge variant="secondary">{engineType}</Badge>
        </div>
      </div>
      {renderEngine()}
    </div>
  );
}
