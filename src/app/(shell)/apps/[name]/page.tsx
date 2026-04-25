'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Copy,
  Check,
  Trash2,
  ChevronLeft,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Key,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useApplication, useDeleteApplication } from '@/hooks/use-apps';
import { useAclPolicy, useWriteAclPolicy } from '@/hooks/use-policies';
import { useGenerateSecretId, useSecretIdAccessors, useDestroySecretId } from '@/hooks/use-approle';
import { deleteAclPolicy } from '@/lib/vault/api/policies';
import { deleteAppRole } from '@/lib/vault/api/approle';
import { relativeTime } from '@/lib/utils';
import dynamic from 'next/dynamic';

const HCLEditor = dynamic(() => import('@/components/hcl-editor').then((m) => m.HCLEditor), {
  ssr: false,
  loading: () => <div className="h-64 border rounded-md bg-muted animate-pulse" />,
});

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-7 w-7"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

function EnvBadge({ env }: { env: string }) {
  const variant =
    env === 'prod' ? 'default' : env === 'staging' ? 'secondary' : ('outline' as const);
  return <Badge variant={variant}>{env}</Badge>;
}

export default function AppDetailPage() {
  const params = useParams();
  const router = useRouter();
  const name = params?.name as string;

  const { data: app, isLoading, error } = useApplication(name);
  const { data: policyHcl, isLoading: policyLoading } = useAclPolicy(
    app?.policy_name ?? '',
    !!app?.policy_name
  );
  const writePolicy = useWriteAclPolicy();
  const generateSecretId = useGenerateSecretId();
  const { data: secretIdAccessors, isLoading: accessorsLoading } = useSecretIdAccessors(
    app?.approle_name ?? '',
    'approle',
    !!app?.approle_name
  );
  const destroySecretId = useDestroySecretId();
  const deleteApp = useDeleteApplication();

  const [policyEdit, setPolicyEdit] = useState('');
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [generatedSecretId, setGeneratedSecretId] = useState<string | null>(null);
  const [secretIdDialogOpen, setSecretIdDialogOpen] = useState(false);

  const handleDeleteApp = async () => {
    if (!app) return;
    try {
      await deleteAclPolicy(app.policy_name);
    } catch {}
    try {
      await deleteAppRole(app.approle_name);
    } catch {}
    deleteApp.mutate(name, {
      onSuccess: () => {
        toast.success('Application deleted');
        router.push('/apps');
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleSavePolicy = () => {
    if (!app) return;
    writePolicy.mutate(
      { name: app.policy_name, policy: policyEdit },
      {
        onSuccess: () => {
          toast.success('Policy saved');
          setEditingPolicy(false);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleGenerateSecretId = () => {
    if (!app) return;
    generateSecretId.mutate(
      { name: app.approle_name },
      {
        onSuccess: (data) => {
          setGeneratedSecretId(data.secret_id);
          setSecretIdDialogOpen(true);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !app) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error ? (error as Error).message : 'Application not found'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/apps')}
          className="text-muted-foreground mb-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Applications
        </Button>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{app.app_name}</h1>
            <EnvBadge env={app.env} />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete application?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the policy <strong>{app.policy_name}</strong>, AppRole{' '}
                  <strong>{app.approle_name}</strong>, and the application metadata. KV secrets at{' '}
                  <code className="font-mono text-xs">{app.kv_path}</code> will be preserved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground"
                  onClick={handleDeleteApp}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {app.description && <p className="text-muted-foreground mt-1">{app.description}</p>}
        <p className="text-xs text-muted-foreground mt-1">
          Created {relativeTime(app.created_at)}
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="secrets">Secrets</TabsTrigger>
          <TabsTrigger value="policy">Policy</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Application Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ['App Name', app.app_name],
                  ...(app.project_name ? [['Project', app.project_name]] : []),
                  ...(app.category ? [['Category', app.category]] : []),
                  ['Environment', app.env],
                  ['KV Path', app.kv_path],
                  ['Policy', app.policy_name],
                  ['AppRole', app.approle_name],
                  ['Role ID', app.role_id],
                  ['Created By', app.created_by_accessor || '—'],
                  ['Created At', relativeTime(app.created_at)],
                ].map(([label, value]) => (
                  <>
                    <span key={`l-${label}`} className="text-muted-foreground">
                      {label}
                    </span>
                    <span key={`v-${label}`} className="font-mono text-xs break-all">
                      {value}
                    </span>
                  </>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/secrets/${app.kv_path.replace(/\/$/, '')}`}>
                  <ExternalLink className="w-4 h-4" />
                  KV Path
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/policies">
                  <ExternalLink className="w-4 h-4" />
                  Policy: {app.policy_name}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Secrets */}
        <TabsContent value="secrets" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                <Key className="w-8 h-8 opacity-40" />
                <p className="text-sm">Manage secrets for this application in the KV browser.</p>
                <Button variant="outline" asChild>
                  <Link href={`/secrets/${app.kv_path.replace(/\/$/, '')}`}>
                    <ExternalLink className="w-4 h-4" />
                    Open KV Browser
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policy */}
        <TabsContent value="policy" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-mono">{app.policy_name}</CardTitle>
                <div className="flex gap-2">
                  {editingPolicy ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setEditingPolicy(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSavePolicy}
                        disabled={writePolicy.isPending}
                      >
                        {writePolicy.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPolicyEdit(policyHcl ?? '');
                        setEditingPolicy(true);
                      }}
                      disabled={policyLoading}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {policyLoading ? (
                <div className="h-64 bg-muted rounded-md animate-pulse" />
              ) : (
                <HCLEditor
                  value={editingPolicy ? policyEdit : (policyHcl ?? '')}
                  onChange={setPolicyEdit}
                  readOnly={!editingPolicy}
                  height="300px"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credentials */}
        <TabsContent value="credentials" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role ID</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                The Role ID identifies the AppRole and is safe to store.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs bg-muted rounded px-3 py-2 break-all">
                  {app.role_id}
                </code>
                <CopyButton text={app.role_id} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Secret IDs</CardTitle>
                <Button
                  size="sm"
                  onClick={handleGenerateSecretId}
                  disabled={generateSecretId.isPending}
                >
                  {generateSecretId.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Generate New Secret ID
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {accessorsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : !secretIdAccessors || secretIdAccessors.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No active Secret IDs
                </p>
              ) : (
                <div className="overflow-x-auto"><Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Accessor</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {secretIdAccessors.map((accessor) => (
                      <TableRow key={accessor}>
                        <TableCell className="font-mono text-xs">{accessor}</TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                              >
                                Destroy
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Destroy Secret ID?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently invalidate this Secret ID accessor.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground"
                                  onClick={() =>
                                    destroySecretId.mutate(
                                      { name: app.approle_name, accessor },
                                      { onSuccess: () => toast.success('Secret ID destroyed') }
                                    )
                                  }
                                >
                                  Destroy
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generated Secret ID Dialog */}
      <Dialog open={secretIdDialogOpen} onOpenChange={setSecretIdDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Secret ID Generated</DialogTitle>
          </DialogHeader>
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-xs">
              This Secret ID will <strong>not be shown again</strong>. Copy and store it securely.
            </AlertDescription>
          </Alert>
          {generatedSecretId && (
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs bg-muted rounded px-3 py-2 break-all">
                {generatedSecretId}
              </code>
              <CopyButton text={generatedSecretId} />
            </div>
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setSecretIdDialogOpen(false);
                setGeneratedSecretId(null);
              }}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
