'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, Check, RotateCcw, ChevronLeft, Pencil } from 'lucide-react';

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

// ─── Database ─────────────────────────────────────────────────────────────────

const DB_PLUGINS = [
  { value: 'postgresql-database-plugin', label: 'PostgreSQL' },
  { value: 'mysql-database-plugin', label: 'MySQL' },
  { value: 'mysql-rds-database-plugin', label: 'MySQL (RDS)' },
  { value: 'mysql-aurora-database-plugin', label: 'MySQL (Aurora)' },
  { value: 'mssql-database-plugin', label: 'MSSQL / SQL Server' },
  { value: 'mongodb-database-plugin', label: 'MongoDB' },
  { value: 'redis-database-plugin', label: 'Redis' },
  { value: 'elasticsearch-database-plugin', label: 'Elasticsearch' },
];

const URL_HINT: Record<string, string> = {
  'postgresql-database-plugin': 'postgresql://{{username}}:{{password}}@host:5432/dbname',
  'mysql-database-plugin': '{{username}}:{{password}}@tcp(host:3306)/',
  'mysql-rds-database-plugin': '{{username}}:{{password}}@tcp(host:3306)/',
  'mysql-aurora-database-plugin': '{{username}}:{{password}}@tcp(host:3306)/',
  'mssql-database-plugin': 'sqlserver://{{username}}:{{password}}@host:1433',
  'mongodb-database-plugin': 'mongodb://{{username}}:{{password}}@host:27017/admin?tls=false',
};

const CREATION_SQL: Record<string, string> = {
  postgresql: `CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';\nGRANT SELECT ON ALL TABLES IN SCHEMA public TO "{{name}}";`,
  mysql: "CREATE USER '{{name}}'@'%' IDENTIFIED BY '{{password}}';\nGRANT SELECT ON `mydb`.* TO '{{name}}'@'%';",
  mssql: "CREATE LOGIN [{{name}}] WITH PASSWORD = '{{password}}';\nCREATE USER [{{name}}] FOR LOGIN [{{name}}];\nGRANT SELECT TO [{{name}}];",
  mongodb: '{"db":"admin","roles":[{"role":"read","db":"mydb"}],"passwords":["{{password}}"],"userid":"{{userid}}"}',
};

const REVOCATION_SQL: Record<string, string> = {
  postgresql: `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "{{name}}";\nDROP ROLE IF EXISTS "{{name}}";`,
  mysql: "DROP USER IF EXISTS '{{name}}'@'%';",
  mssql: 'DROP USER [{{name}}];\nDROP LOGIN [{{name}}];',
};

type ConnForm = {
  name: string; plugin_name: string; connection_url: string;
  username: string; password: string; allowed_roles: string; verify_connection: boolean;
};
type RoleForm = {
  name: string; db_name: string; creation_statements: string;
  revocation_statements: string; default_ttl: string; max_ttl: string;
};
type StaticRoleForm = {
  name: string; db_name: string; username: string;
  rotation_period: string; rotation_statements: string;
};

function DatabaseEngine({ mount }: { mount: string }) {
  const qc = useQueryClient();

  const defaultConn: ConnForm = { name: '', plugin_name: 'postgresql-database-plugin', connection_url: '', username: '', password: '', allowed_roles: '*', verify_connection: true };
  const defaultRole: RoleForm = { name: '', db_name: '', creation_statements: '', revocation_statements: '', default_ttl: '1h', max_ttl: '24h' };
  const defaultStatic: StaticRoleForm = { name: '', db_name: '', username: '', rotation_period: '24h', rotation_statements: '' };

  const [connOpen, setConnOpen] = useState(false);
  const [connForm, setConnForm] = useState<ConnForm>(defaultConn);
  const [editConnName, setEditConnName] = useState<string | null>(null);

  const [roleOpen, setRoleOpen] = useState(false);
  const [roleForm, setRoleForm] = useState<RoleForm>(defaultRole);
  const [editRoleName, setEditRoleName] = useState<string | null>(null);
  const [sqlTemplate, setSqlTemplate] = useState('postgresql');

  const [staticOpen, setStaticOpen] = useState(false);
  const [staticForm, setStaticForm] = useState<StaticRoleForm>(defaultStatic);
  const [editStaticName, setEditStaticName] = useState<string | null>(null);

  const [selRole, setSelRole] = useState('');
  const [creds, setCreds] = useState<{ username: string; password: string } | null>(null);
  const [selStaticRole, setSelStaticRole] = useState('');
  const [staticCreds, setStaticCreds] = useState<{ username: string; password: string; ttl: number } | null>(null);

  const connectionsQ = useQuery({ queryKey: ['engine', mount, 'db-conns'], queryFn: () => vaultFetch<{ data: { keys: string[] } }>(`/${mount}/config`, { method: 'LIST' }).then(r => r.data.keys).catch(() => [] as string[]) });
  const rolesQ = useQuery({ queryKey: ['engine', mount, 'db-roles'], queryFn: () => vaultFetch<{ data: { keys: string[] } }>(`/${mount}/roles`, { method: 'LIST' }).then(r => r.data.keys).catch(() => [] as string[]) });
  const staticRolesQ = useQuery({ queryKey: ['engine', mount, 'db-static'], queryFn: () => vaultFetch<{ data: { keys: string[] } }>(`/${mount}/static-roles`, { method: 'LIST' }).then(r => r.data.keys).catch(() => [] as string[]) });

  const openCreateConn = () => { setConnForm(defaultConn); setEditConnName(null); setConnOpen(true); };
  const openEditConn = async (name: string) => {
    try {
      const res = await vaultFetch<{ data: { plugin_name?: string; connection_details?: { connection_url?: string; username?: string }; allowed_roles?: string[] } }>(`/${mount}/config/${name}`);
      setConnForm({ name, plugin_name: res.data.plugin_name ?? 'postgresql-database-plugin', connection_url: res.data.connection_details?.connection_url ?? '', username: res.data.connection_details?.username ?? '', password: '', allowed_roles: (res.data.allowed_roles ?? ['*']).join(', '), verify_connection: true });
      setEditConnName(name); setConnOpen(true);
    } catch { toast.error('Failed to load connection config'); }
  };
  const saveConnMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { plugin_name: connForm.plugin_name, connection_url: connForm.connection_url, username: connForm.username, allowed_roles: connForm.allowed_roles.split(',').map(s => s.trim()).filter(Boolean), verify_connection: connForm.verify_connection };
      if (connForm.password) body.password = connForm.password;
      return vaultFetch(`/${mount}/config/${editConnName ?? connForm.name}`, { method: 'POST', body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['engine', mount, 'db-conns'] }); toast.success(editConnName ? 'Connection updated' : 'Connection created'); setConnOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });
  const deleteConnMutation = useMutation({ mutationFn: (name: string) => vaultFetch(`/${mount}/config/${name}`, { method: 'DELETE' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['engine', mount, 'db-conns'] }); toast.success('Deleted'); }, onError: (e) => toast.error((e as Error).message) });
  const resetConnMutation = useMutation({ mutationFn: (name: string) => vaultFetch(`/${mount}/config/${name}/reset`, { method: 'POST' }), onSuccess: () => toast.success('Connection pool reset'), onError: (e) => toast.error((e as Error).message) });

  const openCreateRole = () => { setRoleForm(defaultRole); setEditRoleName(null); setRoleOpen(true); };
  const openEditRole = async (name: string) => {
    try {
      const res = await vaultFetch<{ data: { db_name?: string; creation_statements?: string[]; revocation_statements?: string[]; default_ttl?: number; max_ttl?: number } }>(`/${mount}/roles/${name}`);
      setRoleForm({ name, db_name: res.data.db_name ?? '', creation_statements: (res.data.creation_statements ?? []).join('\n'), revocation_statements: (res.data.revocation_statements ?? []).join('\n'), default_ttl: res.data.default_ttl ? `${res.data.default_ttl}s` : '1h', max_ttl: res.data.max_ttl ? `${res.data.max_ttl}s` : '24h' });
      setEditRoleName(name); setRoleOpen(true);
    } catch { toast.error('Failed to load role config'); }
  };
  const saveRoleMutation = useMutation({
    mutationFn: () => vaultFetch(`/${mount}/roles/${editRoleName ?? roleForm.name}`, { method: 'POST', body: { db_name: roleForm.db_name, creation_statements: [roleForm.creation_statements], revocation_statements: roleForm.revocation_statements ? [roleForm.revocation_statements] : [], default_ttl: roleForm.default_ttl, max_ttl: roleForm.max_ttl } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['engine', mount, 'db-roles'] }); toast.success(editRoleName ? 'Role updated' : 'Role created'); setRoleOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });
  const deleteRoleMutation = useMutation({ mutationFn: (name: string) => vaultFetch(`/${mount}/roles/${name}`, { method: 'DELETE' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['engine', mount, 'db-roles'] }); toast.success('Deleted'); }, onError: (e) => toast.error((e as Error).message) });

  const openCreateStatic = () => { setStaticForm(defaultStatic); setEditStaticName(null); setStaticOpen(true); };
  const openEditStatic = async (name: string) => {
    try {
      const res = await vaultFetch<{ data: { db_name?: string; username?: string; rotation_period?: number; rotation_statements?: string[] } }>(`/${mount}/static-roles/${name}`);
      setStaticForm({ name, db_name: res.data.db_name ?? '', username: res.data.username ?? '', rotation_period: res.data.rotation_period ? `${res.data.rotation_period}s` : '24h', rotation_statements: (res.data.rotation_statements ?? []).join('\n') });
      setEditStaticName(name); setStaticOpen(true);
    } catch { toast.error('Failed to load static role config'); }
  };
  const saveStaticMutation = useMutation({
    mutationFn: () => vaultFetch(`/${mount}/static-roles/${editStaticName ?? staticForm.name}`, { method: 'POST', body: { db_name: staticForm.db_name, username: staticForm.username, rotation_period: staticForm.rotation_period, rotation_statements: staticForm.rotation_statements ? [staticForm.rotation_statements] : [] } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['engine', mount, 'db-static'] }); toast.success(editStaticName ? 'Static role updated' : 'Static role created'); setStaticOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });
  const deleteStaticMutation = useMutation({ mutationFn: (name: string) => vaultFetch(`/${mount}/static-roles/${name}`, { method: 'DELETE' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['engine', mount, 'db-static'] }); toast.success('Deleted'); }, onError: (e) => toast.error((e as Error).message) });
  const rotateStaticMutation = useMutation({ mutationFn: (name: string) => vaultFetch(`/${mount}/rotate-role/${name}`, { method: 'POST' }), onSuccess: () => toast.success('Password rotated'), onError: (e) => toast.error((e as Error).message) });

  const generateCredsMutation = useMutation({
    mutationFn: () => vaultFetch<{ data: { username: string; password: string } }>(`/${mount}/creds/${selRole}`),
    onSuccess: (r) => { setCreds(r.data); toast.success('Credentials generated'); },
    onError: (e) => toast.error((e as Error).message),
  });
  const getStaticCredsMutation = useMutation({
    mutationFn: () => vaultFetch<{ data: { username: string; password: string; ttl: number } }>(`/${mount}/static-creds/${selStaticRole}`),
    onSuccess: (r) => setStaticCreds(r.data),
    onError: (e) => toast.error((e as Error).message),
  });

  const conns = connectionsQ.data ?? [];
  const roles = rolesQ.data ?? [];
  const staticRoles = staticRolesQ.data ?? [];

  return (
    <Tabs defaultValue="connections">
      <TabsList>
        <TabsTrigger value="connections">Connections</TabsTrigger>
        <TabsTrigger value="roles">Roles</TabsTrigger>
        <TabsTrigger value="static-roles">Static Roles</TabsTrigger>
        <TabsTrigger value="credentials">Credentials</TabsTrigger>
      </TabsList>

      {/* ── Connections ── */}
      <TabsContent value="connections" className="mt-4 space-y-4">
        <div className="flex justify-end"><Button size="sm" onClick={openCreateConn}><Plus className="w-4 h-4" />Add Connection</Button></div>
        {connectionsQ.isLoading ? <Skeleton className="h-24 w-full" /> : conns.length === 0
          ? <p className="text-sm text-muted-foreground text-center py-8">No connections configured</p>
          : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-36">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{conns.map(c => (
              <TableRow key={c}>
                <TableCell className="font-mono text-sm">{c}</TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => openEditConn(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Reset connection pool" onClick={() => resetConnMutation.mutate(c)}><RotateCcw className="w-3.5 h-3.5" /></Button>
                  <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete connection?</AlertDialogTitle><AlertDialogDescription>This removes the connection <strong>{c}</strong> and its associated roles.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteConnMutation.mutate(c)}>Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent></AlertDialog>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>
        }
      </TabsContent>

      {/* ── Dynamic Roles ── */}
      <TabsContent value="roles" className="mt-4 space-y-4">
        <div className="flex justify-end"><Button size="sm" onClick={openCreateRole}><Plus className="w-4 h-4" />Create Role</Button></div>
        {rolesQ.isLoading ? <Skeleton className="h-24 w-full" /> : roles.length === 0
          ? <p className="text-sm text-muted-foreground text-center py-8">No dynamic roles configured</p>
          : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{roles.map(r => (
              <TableRow key={r}>
                <TableCell className="font-mono text-sm">{r}</TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRole(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete role?</AlertDialogTitle><AlertDialogDescription>Delete role <strong>{r}</strong>?</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteRoleMutation.mutate(r)}>Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent></AlertDialog>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>
        }
      </TabsContent>

      {/* ── Static Roles ── */}
      <TabsContent value="static-roles" className="mt-4 space-y-4">
        <div className="flex justify-end"><Button size="sm" onClick={openCreateStatic}><Plus className="w-4 h-4" />Create Static Role</Button></div>
        {staticRolesQ.isLoading ? <Skeleton className="h-24 w-full" /> : staticRoles.length === 0
          ? <p className="text-sm text-muted-foreground text-center py-8">No static roles configured</p>
          : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-36">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{staticRoles.map(r => (
              <TableRow key={r}>
                <TableCell className="font-mono text-sm">{r}</TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditStatic(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Rotate password now" onClick={() => rotateStaticMutation.mutate(r)}><RotateCcw className="w-3.5 h-3.5" /></Button>
                  <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete static role?</AlertDialogTitle><AlertDialogDescription>Delete <strong>{r}</strong>? The database user will NOT be removed.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteStaticMutation.mutate(r)}>Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent></AlertDialog>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>
        }
        {staticRoles.length > 0 && (
          <Card><CardHeader><CardTitle className="text-sm">View Static Credentials</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1.5"><Label>Static Role</Label>
                  <Select value={selStaticRole} onValueChange={v => { setSelStaticRole(v); setStaticCreds(null); }}>
                    <SelectTrigger><SelectValue placeholder="Select a static role" /></SelectTrigger>
                    <SelectContent>{staticRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={() => getStaticCredsMutation.mutate()} disabled={!selStaticRole || getStaticCredsMutation.isPending}>View</Button>
              </div>
              {staticCreds && (
                <div className="space-y-2 p-3 bg-muted rounded-md">
                  <CredRow label="Username" value={staticCreds.username} />
                  <CredRow label="Password" value={staticCreds.password} />
                  {staticCreds.ttl > 0 && <p className="text-xs text-muted-foreground">Rotates in: {staticCreds.ttl}s</p>}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* ── Credentials ── */}
      <TabsContent value="credentials" className="mt-4">
        <Card><CardHeader><CardTitle className="text-sm">Generate Temporary Credentials</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {roles.length === 0
              ? <p className="text-sm text-muted-foreground">No dynamic roles configured yet. Create a role first.</p>
              : <>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1.5"><Label>Role</Label>
                    <Select value={selRole} onValueChange={v => { setSelRole(v); setCreds(null); }}>
                      <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                      <SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => generateCredsMutation.mutate()} disabled={!selRole || generateCredsMutation.isPending}>Generate</Button>
                </div>
                {creds && (
                  <div className="space-y-2 p-4 bg-muted rounded-md border">
                    <p className="text-xs text-muted-foreground mb-1">Copy these now — they will not be shown again after you navigate away.</p>
                    <CredRow label="Username" value={creds.username} />
                    <CredRow label="Password" value={creds.password} />
                  </div>
                )}
              </>
            }
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Connection dialog ── */}
      <Dialog open={connOpen} onOpenChange={o => { if (!o) setConnOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editConnName ? `Edit: ${editConnName}` : 'Add Database Connection'}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {!editConnName && (
              <div className="space-y-1.5"><Label>Connection Name <span className="text-destructive">*</span></Label>
                <Input placeholder="my-postgres" value={connForm.name} onChange={e => setConnForm(p => ({ ...p, name: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5"><Label>Database Plugin <span className="text-destructive">*</span></Label>
              <Select value={connForm.plugin_name} onValueChange={v => setConnForm(p => ({ ...p, plugin_name: v, connection_url: URL_HINT[v] ?? p.connection_url }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DB_PLUGINS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Connection URL <span className="text-destructive">*</span></Label>
              <Input className="font-mono text-xs" placeholder={URL_HINT[connForm.plugin_name] ?? ''} value={connForm.connection_url} onChange={e => setConnForm(p => ({ ...p, connection_url: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Use <code className="font-mono">{`{{username}}`}</code> and <code className="font-mono">{`{{password}}`}</code> as template vars.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Admin Username</Label>
                <Input value={connForm.username} onChange={e => setConnForm(p => ({ ...p, username: e.target.value }))} />
              </div>
              <div className="space-y-1.5"><Label>{editConnName ? 'New Password (blank = keep)' : 'Admin Password'}</Label>
                <Input type="password" value={connForm.password} onChange={e => setConnForm(p => ({ ...p, password: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Allowed Roles</Label>
              <Input placeholder="* or role1, role2" value={connForm.allowed_roles} onChange={e => setConnForm(p => ({ ...p, allowed_roles: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Use <code className="font-mono">*</code> to allow all roles.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnOpen(false)}>Cancel</Button>
            <Button onClick={() => saveConnMutation.mutate()} disabled={(!editConnName && !connForm.name) || !connForm.connection_url || saveConnMutation.isPending}>
              {editConnName ? 'Save' : 'Add Connection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Role dialog ── */}
      <Dialog open={roleOpen} onOpenChange={o => { if (!o) setRoleOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editRoleName ? `Edit Role: ${editRoleName}` : 'Create Role'}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {!editRoleName && (
              <div className="space-y-1.5"><Label>Role Name <span className="text-destructive">*</span></Label>
                <Input placeholder="readonly" value={roleForm.name} onChange={e => setRoleForm(p => ({ ...p, name: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5"><Label>Database Connection <span className="text-destructive">*</span></Label>
              <Select value={roleForm.db_name} onValueChange={v => setRoleForm(p => ({ ...p, db_name: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a connection" /></SelectTrigger>
                <SelectContent>{conns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Creation Statements <span className="text-destructive">*</span></Label>
                <Select value={sqlTemplate} onValueChange={v => { setSqlTemplate(v); setRoleForm(p => ({ ...p, creation_statements: CREATION_SQL[v] ?? '', revocation_statements: REVOCATION_SQL[v] ?? p.revocation_statements })); }}>
                  <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="postgresql">PostgreSQL</SelectItem><SelectItem value="mysql">MySQL</SelectItem><SelectItem value="mssql">MSSQL</SelectItem><SelectItem value="mongodb">MongoDB</SelectItem></SelectContent>
                </Select>
              </div>
              <Textarea rows={5} className="font-mono text-xs" value={roleForm.creation_statements} onChange={e => setRoleForm(p => ({ ...p, creation_statements: e.target.value }))} placeholder="SQL to create a temp user" />
              <p className="text-xs text-muted-foreground">Variables: <code className="font-mono">{`{{name}} {{password}} {{expiration}}`}</code></p>
            </div>
            <div className="space-y-1.5"><Label>Revocation Statements</Label>
              <Textarea rows={3} className="font-mono text-xs" value={roleForm.revocation_statements} onChange={e => setRoleForm(p => ({ ...p, revocation_statements: e.target.value }))} placeholder="SQL to drop the user on lease expiry" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Default TTL</Label><Input placeholder="1h" value={roleForm.default_ttl} onChange={e => setRoleForm(p => ({ ...p, default_ttl: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Max TTL</Label><Input placeholder="24h" value={roleForm.max_ttl} onChange={e => setRoleForm(p => ({ ...p, max_ttl: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleOpen(false)}>Cancel</Button>
            <Button onClick={() => saveRoleMutation.mutate()} disabled={(!editRoleName && !roleForm.name) || !roleForm.db_name || !roleForm.creation_statements || saveRoleMutation.isPending}>
              {editRoleName ? 'Save' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Static Role dialog ── */}
      <Dialog open={staticOpen} onOpenChange={o => { if (!o) setStaticOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editStaticName ? `Edit Static Role: ${editStaticName}` : 'Create Static Role'}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {!editStaticName && (
              <div className="space-y-1.5"><Label>Role Name <span className="text-destructive">*</span></Label>
                <Input placeholder="app-user" value={staticForm.name} onChange={e => setStaticForm(p => ({ ...p, name: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5"><Label>Database Connection <span className="text-destructive">*</span></Label>
              <Select value={staticForm.db_name} onValueChange={v => setStaticForm(p => ({ ...p, db_name: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a connection" /></SelectTrigger>
                <SelectContent>{conns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Database Username <span className="text-destructive">*</span></Label>
              <Input placeholder="existing-db-user" value={staticForm.username} onChange={e => setStaticForm(p => ({ ...p, username: e.target.value }))} />
              <p className="text-xs text-muted-foreground">This user must already exist in the database.</p>
            </div>
            <div className="space-y-1.5"><Label>Rotation Period <span className="text-destructive">*</span></Label>
              <Input placeholder="24h" value={staticForm.rotation_period} onChange={e => setStaticForm(p => ({ ...p, rotation_period: e.target.value }))} />
            </div>
            <div className="space-y-1.5"><Label>Rotation Statements</Label>
              <Textarea rows={3} className="font-mono text-xs" value={staticForm.rotation_statements} onChange={e => setStaticForm(p => ({ ...p, rotation_statements: e.target.value }))} placeholder="Leave empty to use plugin default" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStaticOpen(false)}>Cancel</Button>
            <Button onClick={() => saveStaticMutation.mutate()} disabled={(!editStaticName && !staticForm.name) || !staticForm.db_name || !staticForm.username || saveStaticMutation.isPending}>
              {editStaticName ? 'Save' : 'Create Static Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <code className="flex-1 text-sm font-mono bg-background rounded px-2 py-1 min-w-0 break-all">{value}</code>
      <CopyBtn text={value} />
    </div>
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
    if (engineType === 'database') return <DatabaseEngine mount={mount} />;
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
