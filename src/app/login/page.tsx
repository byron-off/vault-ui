'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { useConnectionStore } from '@/lib/store';
import { vaultFetchDirect } from '@/lib/vault/client';
import { VaultError } from '@/lib/vault/errors';

const schema = z.object({
  addr: z.string().url({ message: 'Must be a valid URL (e.g. https://bao.example.com)' }),
  token: z.string().min(1, 'Token is required'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { setConnection, recentAddrs } = useConnectionStore();
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { addr: '', token: '' },
  });

  const addrValue = watch('addr');

  const onSubmit = async (data: FormValues) => {
    setError(null);
    setLoading(true);

    try {
      // Step 1: Check reachability
      try {
        const healthRes = await fetch(`${data.addr}/v1/sys/health`);
        if (!healthRes.ok && healthRes.status !== 429 && healthRes.status !== 472 && healthRes.status !== 473) {
          // 429/472/473 are valid OpenBao health states (standby, etc.)
        }
      } catch {
        setError('Cannot reach the Vault server. Check the address and your network.');
        setLoading(false);
        return;
      }

      // Step 2: Validate token
      const tokenInfo = await vaultFetchDirect<{
        data: {
          accessor: string;
          policies: string[];
          ttl: number;
          renewable: boolean;
          display_name: string;
          entity_id: string;
          expire_time: string | null;
        };
      }>(data.addr, data.token, '/auth/token/lookup-self');

      setConnection(data.addr, data.token, tokenInfo.data);
      toast.success('Connected successfully');
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof VaultError) {
        if (err.status === 403) {
          setError('Permission denied. Invalid or expired token.');
        } else {
          setError(err.errors[0] || 'Authentication failed');
        }
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
        {/* Header */}
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
            <CardDescription>Enter your Vault address and token to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="addr">
                  Vault Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="addr"
                  type="url"
                  placeholder="https://bao.example.com"
                  {...register('addr')}
                  disabled={loading}
                />
                {errors.addr && (
                  <p className="text-xs text-destructive">{errors.addr.message}</p>
                )}
                {/* Recent connections */}
                {recentAddrs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {recentAddrs.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setValue('addr', a)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          addrValue === a
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

              <div className="space-y-1.5">
                <Label htmlFor="token">
                  Token <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="token"
                    type={showToken ? 'text' : 'password'}
                    placeholder="hvs.CAESIB..."
                    {...register('token')}
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
                {errors.token && (
                  <p className="text-xs text-destructive">{errors.token.message}</p>
                )}
              </div>

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
