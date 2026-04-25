'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Eye, EyeOff, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import { useConnectionStore } from '@/lib/store';
import { vaultFetchDirect } from '@/lib/vault/client';
import { VaultError } from '@/lib/vault/errors';

type Method = 'token' | 'userpass' | 'ldap';

type TokenInfo = {
  accessor: string;
  policies: string[];
  ttl: number;
  renewable: boolean;
  display_name: string;
  entity_id: string;
  expire_time: string | null;
};

export default function LoginPage() {
  const router = useRouter();
  const { setConnection, recentAddrs } = useConnectionStore();

  const [addr, setAddr] = useState('');
  const [namespace, setNamespace] = useState('');
  const [showNs, setShowNs] = useState(false);
  const [method, setMethod] = useState<Method>('token');

  // Token method
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  // Userpass / LDAP method
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mountPath, setMountPath] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ns = namespace.trim().replace(/^\/+|\/+$/g, '');

  const acquireToken = async (serverAddr: string): Promise<string> => {
    if (method === 'token') {
      if (!token.trim()) throw new Error('Token is required');
      return token.trim();
    }

    const user = username.trim();
    if (!user) throw new Error('Username is required');
    if (!password) throw new Error('Password is required');

    const defaultMount = method === 'userpass' ? 'userpass' : 'ldap';
    const mount = mountPath.trim() || defaultMount;

    const res = await vaultFetchDirect<{ auth: { client_token: string } }>(
      serverAddr,
      '',
      `/auth/${mount}/login/${encodeURIComponent(user)}`,
      { method: 'POST', body: { password } },
      ns || undefined
    );
    return res.auth.client_token;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const serverAddr = addr.trim().replace(/\/+$/, '');
    if (!serverAddr) { setError('Vault address is required'); return; }

    try { new URL(serverAddr); } catch {
      setError('Must be a valid URL (e.g. https://bao.example.com)');
      return;
    }

    setLoading(true);
    try {
      // Check reachability
      try {
        await fetch(`${serverAddr}/v1/sys/health`);
      } catch {
        setError('Cannot reach the Vault server. Check the address and your network.');
        return;
      }

      const clientToken = await acquireToken(serverAddr);

      const tokenInfo = await vaultFetchDirect<{ data: TokenInfo }>(
        serverAddr,
        clientToken,
        '/auth/token/lookup-self',
        {},
        ns || undefined
      );

      setConnection(serverAddr, clientToken, tokenInfo.data, ns || undefined);
      toast.success('Connected successfully');
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof VaultError) {
        if (err.status === 400 || err.status === 403) {
          setError('Authentication failed. Check your credentials.');
        } else {
          setError(err.errors[0] || 'Authentication failed');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Connection failed. Check the address and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
            <KeyRound className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">OpenBao UI</h1>
          <p className="text-muted-foreground text-sm mt-1">Connect to your OpenBao instance</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connect</CardTitle>
            <CardDescription>Enter your Vault address and authenticate to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Server address */}
              <div className="space-y-1.5">
                <Label htmlFor="addr">
                  Vault Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="addr"
                  type="url"
                  placeholder="https://bao.example.com"
                  value={addr}
                  onChange={(e) => setAddr(e.target.value)}
                  disabled={loading}
                />
                {recentAddrs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {recentAddrs.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAddr(a)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          addr === a
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary hover:bg-muted'
                        }`}
                      >
                        {a.replace(/^https?:\/\//, '')}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Namespace — collapsible */}
              <div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNs((v) => !v)}
                >
                  {showNs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Namespace (optional)
                </button>
                {showNs && (
                  <div className="mt-2 space-y-1.5">
                    <Input
                      id="namespace"
                      placeholder="admin/team-a"
                      value={namespace}
                      onChange={(e) => setNamespace(e.target.value)}
                      disabled={loading}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to use the root namespace.
                    </p>
                  </div>
                )}
              </div>

              {/* Auth method */}
              <Tabs value={method} onValueChange={(v) => setMethod(v as Method)}>
                <TabsList className="w-full">
                  <TabsTrigger value="token" className="flex-1">Token</TabsTrigger>
                  <TabsTrigger value="userpass" className="flex-1">Userpass</TabsTrigger>
                  <TabsTrigger value="ldap" className="flex-1">LDAP</TabsTrigger>
                </TabsList>

                <TabsContent value="token" className="mt-4 space-y-1.5">
                  <Label htmlFor="token">
                    Token <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="token"
                      type={showToken ? 'text' : 'password'}
                      placeholder="hvs.CAESIB..."
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      disabled={loading}
                      className="pr-9 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </TabsContent>

                <TabsContent value="userpass" className="mt-4 space-y-3">
                  <CredentialFields
                    username={username}
                    password={password}
                    mountPath={mountPath}
                    defaultMount="userpass"
                    showPassword={showPassword}
                    loading={loading}
                    onUsername={setUsername}
                    onPassword={setPassword}
                    onMountPath={setMountPath}
                    onShowPassword={setShowPassword}
                  />
                </TabsContent>

                <TabsContent value="ldap" className="mt-4 space-y-3">
                  <CredentialFields
                    username={username}
                    password={password}
                    mountPath={mountPath}
                    defaultMount="ldap"
                    showPassword={showPassword}
                    loading={loading}
                    onUsername={setUsername}
                    onPassword={setPassword}
                    onMountPath={setMountPath}
                    onShowPassword={setShowPassword}
                  />
                </TabsContent>
              </Tabs>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end pt-1">
                <Button type="submit" disabled={loading} className="min-w-24">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    'Connect'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CredentialFields({
  username, password, mountPath, defaultMount,
  showPassword, loading,
  onUsername, onPassword, onMountPath, onShowPassword,
}: {
  username: string; password: string; mountPath: string; defaultMount: string;
  showPassword: boolean; loading: boolean;
  onUsername: (v: string) => void; onPassword: (v: string) => void;
  onMountPath: (v: string) => void; onShowPassword: (v: (p: boolean) => boolean) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="username">Username <span className="text-destructive">*</span></Label>
        <Input
          id="username"
          placeholder="alice"
          value={username}
          onChange={(e) => onUsername(e.target.value)}
          disabled={loading}
          autoComplete="username"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
            className="pr-9"
          />
          <button
            type="button"
            onClick={() => onShowPassword((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mount" className="text-xs text-muted-foreground">
          Mount path (default: auth/{defaultMount}/)
        </Label>
        <Input
          id="mount"
          placeholder={defaultMount}
          value={mountPath}
          onChange={(e) => onMountPath(e.target.value)}
          disabled={loading}
          className="font-mono text-sm"
        />
      </div>
    </>
  );
}
