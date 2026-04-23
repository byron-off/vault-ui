'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, RotateCcw, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

type OIDCKey = { name: string; algorithm: string; rotation_period: string; verification_ttl: string };
type OIDCRole = { name: string; key: string; template: string; ttl: string };

function useOIDCList<T>(resource: string) {
  return useQuery<string[]>({
    queryKey: ['identity', 'oidc', resource, 'list'],
    queryFn: async () => {
      const res = await vaultFetch<{ data: { keys: string[] } }>(`/identity/oidc/${resource}`, { method: 'LIST' });
      return res.data.keys;
    },
  });
}

function ResourceTable({
  resource, columns, renderRow, onDelete, createDialog,
}: {
  resource: string;
  columns: string[];
  renderRow: (name: string, detail: Record<string, unknown>) => React.ReactNode;
  onDelete: (name: string) => void;
  createDialog: React.ReactNode;
}) {
  const listQuery = useOIDCList(resource);
  const [createOpen, setCreateOpen] = useState(false);

  const detailQueries = useQuery({
    queryKey: ['identity', 'oidc', resource, 'details'],
    queryFn: async () => {
      if (!listQuery.data?.length) return {};
      const entries = await Promise.allSettled(
        listQuery.data.map(async (name) => {
          const res = await vaultFetch<{ data: Record<string, unknown> }>(`/identity/oidc/${resource}/${name}`);
          return [name, res.data] as const;
        })
      );
      return Object.fromEntries(entries.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])));
    },
    enabled: !!listQuery.data?.length,
  });

  const details = detailQueries.data ?? {};

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Create</Button>
      </div>
      {listQuery.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (listQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No {resource}s configured</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {columns.map((c) => <TableHead key={c}>{c}</TableHead>)}
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(listQuery.data ?? []).map((name) => (
              <TableRow key={name}>
                <TableCell className="font-mono text-sm">{name}</TableCell>
                {renderRow(name, details[name] ?? {})}
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete {resource}?</AlertDialogTitle><AlertDialogDescription>This will permanently delete <strong>{name}</strong>.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => onDelete(name)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        {createDialog}
      </Dialog>
    </div>
  );
}

export default function OIDCPage() {
  const qc = useQueryClient();

  const invalidate = (resource: string) =>
    qc.invalidateQueries({ queryKey: ['identity', 'oidc', resource] });

  const deleteResource = (resource: string) => async (name: string) => {
    try {
      await vaultFetch(`/identity/oidc/${resource}/${name}`, { method: 'DELETE' });
      invalidate(resource);
      toast.success(`${resource} deleted`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const wellKnownQuery = useQuery({
    queryKey: ['identity', 'oidc', 'well-known'],
    queryFn: () => vaultFetch<Record<string, unknown>>('/identity/oidc/.well-known/openid-configuration'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">OIDC Provider</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure OpenBao as an OIDC identity provider.</p>
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">Keys</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="scopes">Scopes</TabsTrigger>
          <TabsTrigger value="well-known">Well-known</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="mt-4">
          <ResourceTable
            resource="key"
            columns={['Algorithm', 'Rotation Period']}
            renderRow={(name, d) => (
              <>
                <TableCell><Badge variant="secondary">{String(d.algorithm ?? '—')}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{String(d.rotation_period ?? '—')}</TableCell>
              </>
            )}
            onDelete={deleteResource('key')}
            createDialog={<SimpleCreateDialog resource="key" fields={[
              { name: 'name', label: 'Key Name', required: true },
              { name: 'algorithm', label: 'Algorithm', placeholder: 'RS256' },
              { name: 'rotation_period', label: 'Rotation Period', placeholder: '24h' },
              { name: 'verification_ttl', label: 'Verification TTL', placeholder: '24h' },
            ]} onCreated={() => invalidate('key')} />}
          />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <ResourceTable
            resource="role"
            columns={['Key', 'TTL']}
            renderRow={(_, d) => (
              <>
                <TableCell className="font-mono text-sm">{String(d.key ?? '—')}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{String(d.ttl ?? '—')}</TableCell>
              </>
            )}
            onDelete={deleteResource('role')}
            createDialog={<SimpleCreateDialog resource="role" fields={[
              { name: 'name', label: 'Role Name', required: true },
              { name: 'key', label: 'Key Name', required: true },
              { name: 'template', label: 'Template (JSON)', placeholder: '{}' },
              { name: 'ttl', label: 'TTL', placeholder: '24h' },
            ]} onCreated={() => invalidate('role')} />}
          />
        </TabsContent>

        <TabsContent value="providers" className="mt-4">
          <ResourceTable
            resource="provider"
            columns={['Issuer']}
            renderRow={(_, d) => <TableCell className="font-mono text-xs">{String(d.issuer ?? '—')}</TableCell>}
            onDelete={deleteResource('provider')}
            createDialog={<SimpleCreateDialog resource="provider" fields={[
              { name: 'name', label: 'Provider Name', required: true },
              { name: 'issuer', label: 'Issuer URL', placeholder: 'https://...' },
            ]} onCreated={() => invalidate('provider')} />}
          />
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <ResourceTable
            resource="client"
            columns={['Client ID']}
            renderRow={(_, d) => <TableCell className="font-mono text-xs">{String(d.client_id ?? '—')}</TableCell>}
            onDelete={deleteResource('client')}
            createDialog={<SimpleCreateDialog resource="client" fields={[
              { name: 'name', label: 'Client Name', required: true },
              { name: 'key', label: 'Key Name', required: true },
              { name: 'redirect_uris', label: 'Redirect URIs (comma-separated)' },
            ]} onCreated={() => invalidate('client')} />}
          />
        </TabsContent>

        <TabsContent value="scopes" className="mt-4">
          <ResourceTable
            resource="scope"
            columns={['Description']}
            renderRow={(_, d) => <TableCell className="text-sm text-muted-foreground">{String(d.description ?? '—')}</TableCell>}
            onDelete={deleteResource('scope')}
            createDialog={<SimpleCreateDialog resource="scope" fields={[
              { name: 'name', label: 'Scope Name', required: true },
              { name: 'description', label: 'Description' },
              { name: 'template', label: 'Template (JSON)', placeholder: '{}' },
            ]} onCreated={() => invalidate('scope')} />}
          />
        </TabsContent>

        <TabsContent value="well-known" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Well-known Endpoints</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-48">OpenID Configuration</span>
                <code className="font-mono text-xs bg-muted px-2 py-1 rounded flex-1">/v1/identity/oidc/.well-known/openid-configuration</code>
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                  <a href="/api/proxy/identity/oidc/.well-known/openid-configuration" target="_blank"><ExternalLink className="w-3.5 h-3.5" /></a>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-48">JSON Web Key Set</span>
                <code className="font-mono text-xs bg-muted px-2 py-1 rounded flex-1">/v1/identity/oidc/.well-known/keys</code>
              </div>
              {wellKnownQuery.data && (
                <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-64">
                  {JSON.stringify(wellKnownQuery.data, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SimpleCreateDialog({
  resource,
  fields,
  onCreated,
}: {
  resource: string;
  fields: { name: string; label: string; required?: boolean; placeholder?: string }[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: async () => {
      const { name, ...rest } = form;
      await vaultFetch(`/identity/oidc/${resource}/${name}`, { method: 'POST', body: rest });
    },
    onSuccess: () => { onCreated(); setOpen(false); setForm({}); toast.success(`${resource} created`); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Create {resource}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
            <Input placeholder={f.placeholder ?? f.label} value={form[f.name] ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))} />
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form['name']}>Create</Button>
      </DialogFooter>
    </DialogContent>
  );
}
