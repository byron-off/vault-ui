'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { VaultError } from '@/lib/vault/errors';

// ─── Shared list hook ─────────────────────────────────────────────────────────

function useOIDCList(resource: string) {
  return useQuery<string[]>({
    queryKey: ['identity', 'oidc', resource, 'list'],
    queryFn: async () => {
      try {
        const res = await vaultFetch<{ data: { keys: string[] } }>(
          `/identity/oidc/${resource}`, { method: 'LIST' }
        );
        return res.data.keys ?? [];
      } catch (err) {
        if (err instanceof VaultError && err.status === 404) return [];
        throw err;
      }
    },
  });
}

// ─── Generic CRUD table ───────────────────────────────────────────────────────

function ResourceTable({
  resource,
  columns,
  renderRow,
  onDelete,
  createDialog,
}: {
  resource: string;
  columns: string[];
  renderRow: (name: string, detail: Record<string, unknown>) => React.ReactNode;
  onDelete: (name: string) => void;
  createDialog: (onClose: () => void) => React.ReactNode;
}) {
  const listQuery = useOIDCList(resource);
  const [createOpen, setCreateOpen] = useState(false);

  const detailQueries = useQuery({
    queryKey: ['identity', 'oidc', resource, 'details', listQuery.data],
    queryFn: async () => {
      if (!listQuery.data?.length) return {};
      const entries = await Promise.allSettled(
        listQuery.data.map(async (name) => {
          const res = await vaultFetch<{ data: Record<string, unknown> }>(
            `/identity/oidc/${resource}/${name}`
          );
          return [name, res.data] as const;
        })
      );
      return Object.fromEntries(
        entries.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
      );
    },
    enabled: !!listQuery.data?.length,
  });

  const details = detailQueries.data ?? {};

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Create
        </Button>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : (listQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No {resource}s configured</p>
      ) : (
        <div className="overflow-x-auto">
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
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {resource}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete <strong>{name}</strong>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground"
                          onClick={() => onDelete(name)}
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
        {createDialog(() => setCreateOpen(false))}
      </Dialog>
    </div>
  );
}

// ─── Generic create dialog ────────────────────────────────────────────────────

function SimpleCreateDialog({
  resource,
  fields,
  onCreated,
  onClose,
}: {
  resource: string;
  fields: { name: string; label: string; required?: boolean; placeholder?: string }[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: async () => {
      const { name, ...rest } = form;
      const body = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== ''));
      await vaultFetch(`/identity/oidc/${resource}/${name}`, { method: 'POST', body });
    },
    onSuccess: () => {
      onCreated();
      setForm({});
      toast.success(`${resource} created`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Create {resource}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <Label>
              {f.label}
              {f.required && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              placeholder={f.placeholder ?? f.label}
              value={form[f.name] ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form['name']}
        >
          {mutation.isPending ? 'Creating…' : 'Create'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
    queryFn: async () => {
      try {
        return await vaultFetch<Record<string, unknown>>(
          '/identity/oidc/.well-known/openid-configuration'
        );
      } catch {
        return null;
      }
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">OIDC Provider</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure OpenBao as an OIDC identity provider.
        </p>
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

        {/* Keys */}
        <TabsContent value="keys" className="mt-4">
          <ResourceTable
            resource="key"
            columns={['Algorithm', 'Rotation Period', 'Verification TTL']}
            renderRow={(_, d) => (
              <>
                <TableCell><Badge variant="secondary">{String(d.algorithm ?? '—')}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{String(d.rotation_period ?? '—')}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{String(d.verification_ttl ?? '—')}</TableCell>
              </>
            )}
            onDelete={deleteResource('key')}
            createDialog={(onClose) => (
              <SimpleCreateDialog
                resource="key"
                fields={[
                  { name: 'name', label: 'Key Name', required: true },
                  { name: 'algorithm', label: 'Algorithm', placeholder: 'RS256' },
                  { name: 'rotation_period', label: 'Rotation Period', placeholder: '24h' },
                  { name: 'verification_ttl', label: 'Verification TTL', placeholder: '24h' },
                ]}
                onCreated={() => invalidate('key')}
                onClose={onClose}
              />
            )}
          />
        </TabsContent>

        {/* Roles */}
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
            createDialog={(onClose) => (
              <SimpleCreateDialog
                resource="role"
                fields={[
                  { name: 'name', label: 'Role Name', required: true },
                  { name: 'key', label: 'Key Name', required: true, placeholder: 'default' },
                  { name: 'template', label: 'Template (JSON)', placeholder: '{}' },
                  { name: 'ttl', label: 'TTL', placeholder: '24h' },
                ]}
                onCreated={() => invalidate('role')}
                onClose={onClose}
              />
            )}
          />
        </TabsContent>

        {/* Providers */}
        <TabsContent value="providers" className="mt-4">
          <ResourceTable
            resource="provider"
            columns={['Issuer', 'Allowed Client IDs']}
            renderRow={(_, d) => (
              <>
                <TableCell className="font-mono text-xs">{String(d.issuer ?? '—')}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {Array.isArray(d.allowed_client_ids)
                    ? (d.allowed_client_ids as string[]).join(', ') || '*'
                    : '—'}
                </TableCell>
              </>
            )}
            onDelete={deleteResource('provider')}
            createDialog={(onClose) => (
              <SimpleCreateDialog
                resource="provider"
                fields={[
                  { name: 'name', label: 'Provider Name', required: true },
                  { name: 'issuer', label: 'Issuer URL', placeholder: 'https://...' },
                  { name: 'allowed_client_ids', label: 'Allowed Client IDs (comma-sep)', placeholder: '*' },
                ]}
                onCreated={() => invalidate('provider')}
                onClose={onClose}
              />
            )}
          />
        </TabsContent>

        {/* Clients */}
        <TabsContent value="clients" className="mt-4">
          <ResourceTable
            resource="client"
            columns={['Client ID', 'Key', 'Access Token TTL']}
            renderRow={(_, d) => (
              <>
                <TableCell className="font-mono text-xs">{String(d.client_id ?? '—')}</TableCell>
                <TableCell className="text-sm">{String(d.key ?? '—')}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{String(d.access_token_ttl ?? '—')}</TableCell>
              </>
            )}
            onDelete={deleteResource('client')}
            createDialog={(onClose) => (
              <SimpleCreateDialog
                resource="client"
                fields={[
                  { name: 'name', label: 'Client Name', required: true },
                  { name: 'key', label: 'Key Name', required: true, placeholder: 'default' },
                  { name: 'redirect_uris', label: 'Redirect URIs (comma-sep)', placeholder: 'https://app.example.com/callback' },
                  { name: 'assignments', label: 'Assignments (comma-sep)', placeholder: 'allow_all' },
                  { name: 'access_token_ttl', label: 'Access Token TTL', placeholder: '24h' },
                  { name: 'id_token_ttl', label: 'ID Token TTL', placeholder: '24h' },
                ]}
                onCreated={() => invalidate('client')}
                onClose={onClose}
              />
            )}
          />
        </TabsContent>

        {/* Scopes */}
        <TabsContent value="scopes" className="mt-4">
          <ResourceTable
            resource="scope"
            columns={['Description']}
            renderRow={(_, d) => (
              <TableCell className="text-sm text-muted-foreground">{String(d.description ?? '—')}</TableCell>
            )}
            onDelete={deleteResource('scope')}
            createDialog={(onClose) => (
              <SimpleCreateDialog
                resource="scope"
                fields={[
                  { name: 'name', label: 'Scope Name', required: true },
                  { name: 'description', label: 'Description' },
                  { name: 'template', label: 'Template (JSON)', placeholder: '{"username": {{identity.entity.name}}}' },
                ]}
                onCreated={() => invalidate('scope')}
                onClose={onClose}
              />
            )}
          />
        </TabsContent>

        {/* Well-known */}
        <TabsContent value="well-known" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Well-known Endpoints</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                [
                  'OpenID Configuration',
                  '/v1/identity/oidc/.well-known/openid-configuration',
                  '/api/proxy/identity/oidc/.well-known/openid-configuration',
                ],
                ['JSON Web Key Set', '/v1/identity/oidc/.well-known/keys', null],
              ].map(([label, path, href]) => (
                <div key={path} className="flex items-center gap-2">
                  <span className="text-muted-foreground w-52 shrink-0">{label}</span>
                  <code className="font-mono text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{path}</code>
                  {href && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild>
                      <a href={href} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              ))}
              {wellKnownQuery.isLoading && <Skeleton className="h-20 w-full mt-3" />}
              {wellKnownQuery.data && (
                <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-64 mt-3">
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
