'use client';

import { useQuery } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { vaultFetch } from '@/lib/vault/client';

type MFAMethod = { id: string; type: string; name?: string; mount_accessor?: string };
type LoginEnforcement = { name: string; mfa_method_ids: string[]; auth_method_accessors: string[] };

export default function MFAPage() {
  const methodsQuery = useQuery({
    queryKey: ['identity', 'mfa', 'methods'],
    queryFn: async () => {
      const types = ['totp', 'duo', 'okta', 'pingid'];
      const results = await Promise.allSettled(
        types.map(async (t) => {
          const res = await vaultFetch<{ data: { keys: string[] } }>(
            `/identity/mfa/method/${t}`, { method: 'LIST' }
          );
          return res.data.keys.map((id) => ({ id, type: t }));
        })
      );
      return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])) as MFAMethod[];
    },
  });

  const enforcementsQuery = useQuery({
    queryKey: ['identity', 'mfa', 'enforcements'],
    queryFn: async () => {
      const res = await vaultFetch<{ data: { keys: string[] } }>(
        '/identity/mfa/login-enforcement', { method: 'LIST' }
      );
      const details = await Promise.allSettled(
        res.data.keys.map((name) =>
          vaultFetch<{ data: LoginEnforcement }>(`/identity/mfa/login-enforcement/${name}`).then((r) => r.data)
        )
      );
      return details.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6" />
        <div>
          <h1 className="text-2xl font-bold">Multi-Factor Authentication</h1>
          <p className="text-muted-foreground text-sm">Configure MFA methods and login enforcements.</p>
        </div>
      </div>

      <Tabs defaultValue="methods">
        <TabsList>
          <TabsTrigger value="methods">Methods</TabsTrigger>
          <TabsTrigger value="enforcements">Login Enforcements</TabsTrigger>
        </TabsList>

        <TabsContent value="methods" className="mt-4 space-y-4">
          {methodsQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : methodsQuery.error ? (
            <Alert variant="destructive"><AlertDescription>{(methodsQuery.error as Error).message}</AlertDescription></Alert>
          ) : !methodsQuery.data?.length ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground py-12">
                <Shield className="w-8 h-8 opacity-30 mx-auto mb-2" />
                <p className="text-sm">No MFA methods configured</p>
                <p className="text-xs mt-1">Use the CLI to configure TOTP, Duo, Okta, or PingID methods.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {methodsQuery.data.map((m) => (
                <Card key={m.id}>
                  <CardContent className="pt-4 pb-4 flex items-center gap-4">
                    <Badge variant="secondary" className="uppercase text-xs">{m.type}</Badge>
                    <span className="font-mono text-xs text-muted-foreground flex-1">{m.id}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="enforcements" className="mt-4 space-y-4">
          {enforcementsQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : !enforcementsQuery.data?.length ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground py-12">
                <p className="text-sm">No login enforcements configured</p>
                <p className="text-xs mt-1">Login enforcements require MFA for specific auth methods.</p>
              </CardContent>
            </Card>
          ) : (
            enforcementsQuery.data.map((e) => (
              <Card key={e.name}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-mono">{e.name}</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">MFA Methods: </span>{e.mfa_method_ids?.join(', ') || '—'}</div>
                  <div><span className="text-muted-foreground">Auth Methods: </span>{e.auth_method_accessors?.join(', ') || '—'}</div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
