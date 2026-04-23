'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Check,
  X,
  Plus,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Copy,
  AlertTriangle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { writeAclPolicy, deleteAclPolicy } from '@/lib/vault/api/policies';
import { writeSecret } from '@/lib/vault/api/secrets';
import { createAppRole, getRoleId, generateSecretId, deleteAppRole } from '@/lib/vault/api/approle';
import { saveApplication } from '@/lib/vault/api/apps';
import { useConnectionStore } from '@/lib/store';
import type { Application } from '@/types/app';

// Dynamic import for HCL editor to avoid SSR issues
import dynamic from 'next/dynamic';
const HCLEditor = dynamic(() => import('@/components/hcl-editor').then(m => m.HCLEditor), {
  ssr: false,
  loading: () => <div className="h-64 border rounded-md bg-muted animate-pulse" />,
});

const STEPS = ['Basics', 'Secrets', 'Policy', 'AppRole Config', 'Review', 'Execution', 'Success'];

const basicsSchema = z.object({
  app_name: z
    .string()
    .min(2, 'Minimum 2 characters')
    .max(63, 'Maximum 63 characters')
    .regex(/^[a-z][a-z0-9-]{1,62}$/, 'Lowercase letters, numbers, hyphens only. Must start with a letter.'),
  description: z.string().max(200, 'Max 200 characters').optional(),
  env: z.enum(['prod', 'staging', 'dev']),
});

type BasicsForm = z.infer<typeof basicsSchema>;

type KVRow = { key: string; value: string };
type OperationStatus = 'pending' | 'running' | 'success' | 'failed';

type Operation = {
  label: string;
  status: OperationStatus;
  error?: string;
};

function deriveNames(appName: string, env: string) {
  return {
    kvPath: `app/${env}/${appName}/`,
    policyName: `${appName}-${env}-policy`,
    approleName: `${appName}-${env}-role`,
  };
}

function defaultPolicy(env: string, appName: string) {
  return `path "secret/data/app/${env}/${appName}/*" {
  capabilities = ["read"]
}

path "secret/metadata/app/${env}/${appName}/*" {
  capabilities = ["list", "read"]
}
`;
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {STEPS.slice(0, total).map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors ${
              i < current
                ? 'bg-primary border-primary text-primary-foreground'
                : i === current
                ? 'border-primary text-primary bg-background'
                : 'border-border text-muted-foreground bg-background'
            }`}
          >
            {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-0.5 w-8 ${i < current ? 'bg-primary' : 'bg-border'}`} />
          )}
        </div>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">{STEPS[current]}</span>
    </div>
  );
}

function KVTable({
  rows,
  onChange,
}: {
  rows: KVRow[];
  onChange: (rows: KVRow[]) => void;
}) {
  const addRow = () => onChange([...rows, { key: '', value: '' }]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: 'key' | 'value', val: string) => {
    const updated = [...rows];
    updated[i] = { ...updated[i], [field]: val };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            placeholder="Key"
            value={row.key}
            onChange={(e) => updateRow(i, 'key', e.target.value)}
            className="flex-1 font-mono text-sm"
          />
          <Input
            placeholder="Value"
            value={row.value}
            onChange={(e) => updateRow(i, 'value', e.target.value)}
            className="flex-1 font-mono text-sm"
            type="password"
          />
          <Button variant="ghost" size="icon" onClick={() => removeRow(i)} type="button">
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addRow} type="button">
        <Plus className="w-4 h-4" />
        Add row
      </Button>
    </div>
  );
}

export default function NewAppPage() {
  const router = useRouter();
  const { tokenInfo } = useConnectionStore();
  const [step, setStep] = useState(0);

  // Step 1 form
  const basicsForm = useForm<BasicsForm>({
    resolver: zodResolver(basicsSchema),
    defaultValues: { app_name: '', description: '', env: 'dev' },
  });
  const basicsValues = basicsForm.watch();
  const { kvPath, policyName, approleName } = basicsValues.app_name
    ? deriveNames(basicsValues.app_name, basicsValues.env)
    : { kvPath: '', policyName: '', approleName: '' };

  // Step 2
  const [kvRows, setKvRows] = useState<KVRow[]>([]);

  // Step 3
  const [policyHcl, setPolicyHcl] = useState('');

  // Step 4 - AppRole config
  const [approleConfig, setApproleConfig] = useState({
    token_ttl: '1h',
    token_max_ttl: '24h',
    secret_id_ttl: '24h',
    secret_id_num_uses: 0,
    token_num_uses: 0,
    bind_secret_id: true,
    token_bound_cidrs: [] as string[],
  });

  // Step 6 - Execution
  const [operations, setOperations] = useState<Operation[]>([]);
  const [executing, setExecuting] = useState(false);

  // Step 7 - Result
  const [roleId, setRoleId] = useState('');
  const [secretId, setSecretId] = useState('');
  const [copied, setCopied] = useState<'role' | 'secret' | null>(null);

  const copyToClipboard = (text: string, type: 'role' | 'secret') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const updateOp = (index: number, update: Partial<Operation>) => {
    setOperations((prev) => prev.map((op, i) => (i === index ? { ...op, ...update } : op)));
  };

  const goToStep = (n: number) => setStep(n);

  const handleBasicsNext = basicsForm.handleSubmit(() => {
    setPolicyHcl(defaultPolicy(basicsValues.env, basicsValues.app_name));
    setStep(1);
  });

  const executeCreation = async () => {
    const app = basicsValues;
    const ops: Operation[] = [
      { label: `Create policy: ${policyName}`, status: 'pending' },
      ...(kvRows.filter((r) => r.key).length > 0
        ? [{ label: `Write initial secrets to ${kvPath}`, status: 'pending' as OperationStatus }]
        : []),
      { label: `Create AppRole: ${approleName}`, status: 'pending' },
      { label: `Fetch Role ID`, status: 'pending' },
      { label: `Generate Secret ID`, status: 'pending' },
      { label: `Store application metadata`, status: 'pending' },
    ];
    setOperations(ops);
    setExecuting(true);

    let opIdx = 0;
    const completedOps: string[] = [];

    const runOp = async (label: string, fn: () => Promise<void>) => {
      updateOp(opIdx, { status: 'running' });
      try {
        await fn();
        updateOp(opIdx, { status: 'success' });
        completedOps.push(label);
        opIdx++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        updateOp(opIdx, { status: 'failed', error: msg });
        throw err;
      }
    };

    try {
      // 1. Create policy
      await runOp(ops[0].label, () => writeAclPolicy(policyName, policyHcl));

      // 2. Write secrets if any
      const validRows = kvRows.filter((r) => r.key);
      if (validRows.length > 0) {
        await runOp(ops[opIdx].label, () => {
          const data = Object.fromEntries(validRows.map((r) => [r.key, r.value]));
          return writeSecret(kvPath, data).then(() => undefined);
        });
      }

      // 3. Create AppRole
      await runOp(ops[opIdx].label, () =>
        createAppRole(approleName, {
          policies: [policyName],
          token_ttl: approleConfig.token_ttl,
          token_max_ttl: approleConfig.token_max_ttl,
          secret_id_ttl: approleConfig.secret_id_ttl,
          secret_id_num_uses: approleConfig.secret_id_num_uses,
          token_num_uses: approleConfig.token_num_uses,
          bind_secret_id: approleConfig.bind_secret_id,
          token_bound_cidrs: approleConfig.token_bound_cidrs,
        })
      );

      // 4. Fetch role ID
      let fetchedRoleId = '';
      await runOp(ops[opIdx].label, async () => {
        fetchedRoleId = await getRoleId(approleName);
        setRoleId(fetchedRoleId);
      });

      // 5. Generate secret ID
      let generatedSecretId = '';
      await runOp(ops[opIdx].label, async () => {
        const result = await generateSecretId(approleName);
        generatedSecretId = result.secret_id;
        setSecretId(generatedSecretId);
      });

      // 6. Store metadata
      const application: Application = {
        app_name: app.app_name,
        description: app.description || '',
        env: app.env,
        kv_path: kvPath,
        policy_name: policyName,
        approle_name: approleName,
        role_id: fetchedRoleId,
        created_at: new Date().toISOString(),
        created_by_accessor: tokenInfo?.accessor || '',
        tags: [],
      };
      await runOp(ops[opIdx].label, () => saveApplication(application));

      setStep(6);
    } catch {
      // Rollback completed ops in reverse
      if (completedOps.length > 0) {
        toast.error('Creation failed. You can rollback completed steps.');
      }
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/apps')} className="text-muted-foreground">
          <ChevronLeft className="w-4 h-4" />
          Back to Applications
        </Button>
        <h1 className="text-2xl font-bold mt-2">Create Application</h1>
        <p className="text-muted-foreground text-sm">
          Set up a fully configured service identity with policy, AppRole, and KV path.
        </p>
      </div>

      <StepIndicator current={step} total={STEPS.length} />

      {/* Step 0: Basics */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBasicsNext} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="app_name">
                  App Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="app_name"
                  placeholder="my-service"
                  {...basicsForm.register('app_name')}
                  className="font-mono"
                />
                {basicsForm.formState.errors.app_name && (
                  <p className="text-xs text-destructive">
                    {basicsForm.formState.errors.app_name.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, hyphens only
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Brief description of this application"
                  {...basicsForm.register('description')}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Environment *</Label>
                <div className="flex gap-3">
                  {(['dev', 'staging', 'prod'] as const).map((env) => (
                    <label
                      key={env}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer transition-colors ${
                        basicsValues.env === env
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <input
                        type="radio"
                        value={env}
                        {...basicsForm.register('env')}
                        className="sr-only"
                      />
                      <span className="text-sm capitalize">{env}</span>
                    </label>
                  ))}
                </div>
              </div>

              {basicsValues.app_name && (
                <div className="rounded-md bg-muted p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Auto-derived
                  </p>
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">KV Path</span>
                    <span className="font-mono text-xs">{kvPath}</span>
                    <span className="text-muted-foreground">Policy</span>
                    <span className="font-mono text-xs">{policyName}</span>
                    <span className="text-muted-foreground">AppRole</span>
                    <span className="font-mono text-xs">{approleName}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="submit">
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Secrets */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Initial Secrets (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add initial key-value pairs to store at{' '}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{kvPath}</code>
            </p>
            <KVTable rows={kvRows} onChange={setKvRows} />
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => goToStep(0)}>
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => goToStep(2)}>
                  Skip
                </Button>
                <Button onClick={() => goToStep(2)}>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Policy */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Define the HCL policy for this application. You can customize the pre-filled template.
            </p>
            <HCLEditor value={policyHcl} onChange={setPolicyHcl} height="300px" />
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => goToStep(1)}>
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button onClick={() => goToStep(3)}>
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: AppRole Config */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>AppRole Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ['token_ttl', 'Token TTL'],
                  ['token_max_ttl', 'Token Max TTL'],
                  ['secret_id_ttl', 'Secret ID TTL'],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input
                    value={approleConfig[field]}
                    onChange={(e) =>
                      setApproleConfig((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                    placeholder="e.g. 1h"
                  />
                </div>
              ))}
              {(
                [
                  ['secret_id_num_uses', 'Secret ID Num Uses'],
                  ['token_num_uses', 'Token Num Uses'],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    value={approleConfig[field]}
                    onChange={(e) =>
                      setApproleConfig((prev) => ({
                        ...prev,
                        [field]: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">0 = unlimited</p>
                </div>
              ))}
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bind_secret_id"
                  checked={approleConfig.bind_secret_id}
                  onChange={(e) =>
                    setApproleConfig((prev) => ({ ...prev, bind_secret_id: e.target.checked }))
                  }
                  className="w-4 h-4"
                />
                <Label htmlFor="bind_secret_id">Bind Secret ID (recommended)</Label>
              </div>
            </div>
            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={() => goToStep(2)}>
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button onClick={() => goToStep(4)}>
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Create</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-3">Application Details</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">Name</span>
                <span className="font-mono">{basicsValues.app_name}</span>
                <span className="text-muted-foreground">Environment</span>
                <Badge variant={basicsValues.env === 'prod' ? 'default' : 'secondary'} className="w-fit">
                  {basicsValues.env}
                </Badge>
                <span className="text-muted-foreground">Description</span>
                <span>{basicsValues.description || '—'}</span>
                <span className="text-muted-foreground">KV Path</span>
                <span className="font-mono text-xs">{kvPath}</span>
                <span className="text-muted-foreground">Policy</span>
                <span className="font-mono text-xs">{policyName}</span>
                <span className="text-muted-foreground">AppRole</span>
                <span className="font-mono text-xs">{approleName}</span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Operations that will be performed</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Create ACL policy: {policyName}</li>
                {kvRows.filter((r) => r.key).length > 0 && (
                  <li>Write {kvRows.filter((r) => r.key).length} secrets to {kvPath}</li>
                )}
                <li>Create AppRole: {approleName}</li>
                <li>Fetch Role ID</li>
                <li>Generate Secret ID</li>
                <li>Store application metadata</li>
              </ol>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => goToStep(3)}>
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={() => {
                  setStep(5);
                  setTimeout(executeCreation, 100);
                }}
              >
                Create Application
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Execution */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Creating Application…</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {operations.map((op, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 shrink-0">
                  {op.status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border-2 border-border" />
                  )}
                  {op.status === 'running' && (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  )}
                  {op.status === 'success' && (
                    <Check className="w-5 h-5 text-green-600" />
                  )}
                  {op.status === 'failed' && <X className="w-5 h-5 text-destructive" />}
                </div>
                <div className="flex-1">
                  <span
                    className={`text-sm ${op.status === 'failed' ? 'text-destructive' : op.status === 'success' ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {op.label}
                  </span>
                  {op.error && (
                    <p className="text-xs text-destructive mt-0.5">{op.error}</p>
                  )}
                </div>
              </div>
            ))}
            {!executing && operations.some((o) => o.status === 'failed') && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>
                  Creation failed. Some resources may have been created. Check the Operations page or
                  manually clean up.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 6: Success */}
      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">Application Created!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="success" className="bg-green-50 border-green-200">
              <Check className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>{basicsValues.app_name}</strong> has been created successfully.
              </AlertDescription>
            </Alert>

            <div>
              <Label className="text-sm font-semibold">Role ID</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Safe to store — used to identify the AppRole.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs bg-muted rounded px-3 py-2 break-all">
                  {roleId}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(roleId, 'role')}
                >
                  {copied === 'role' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold">Secret ID</Label>
              <Alert variant="warning" className="bg-amber-50 border-amber-200 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-800 text-xs">
                  This Secret ID will <strong>not be shown again</strong>. Copy and store it securely.
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs bg-muted rounded px-3 py-2 break-all">
                  {secretId}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(secretId, 'secret')}
                >
                  {copied === 'secret' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => router.push(`/apps/${basicsValues.app_name}`)}>
                View Application
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
