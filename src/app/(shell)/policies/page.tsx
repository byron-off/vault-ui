'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Shield,
  ShieldCheck,
  Pencil,
  Save,
  X,
  Trash2,
  RefreshCw,
  Copy,
  FileText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

import { HCLEditor } from '@/components/hcl-editor';

import {
  useAclPolicies,
  useAclPolicy,
  useWriteAclPolicy,
  useDeleteAclPolicy,
  usePasswordPolicies,
  usePasswordPolicy,
  useWritePasswordPolicy,
  useDeletePasswordPolicy,
  useGeneratePassword,
} from '@/hooks/use-policies';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYSTEM_POLICIES = ['root', 'default'] as const;

const DEFAULT_ACL_HCL = `# New ACL policy
# Grant read access to a path
path "secret/data/*" {
  capabilities = ["read", "list"]
}
`;

const DEFAULT_PASSWORD_HCL = `length = 20

rule "charset" {
  charset = "abcdefghijklmnopqrstuvwxyz"
  min-chars = 1
}

rule "charset" {
  charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  min-chars = 1
}

rule "charset" {
  charset = "0123456789"
  min-chars = 1
}
`;

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSystemPolicy(name: string): boolean {
  return (SYSTEM_POLICIES as readonly string[]).includes(name);
}

// ---------------------------------------------------------------------------
// Policy list skeleton
// ---------------------------------------------------------------------------

function PolicyListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-md" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <FileText className="h-12 w-12 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Policy Dialog
// ---------------------------------------------------------------------------

interface NewPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, policy: string) => Promise<void>;
  defaultHcl: string;
  isLoading: boolean;
}

function NewPolicyDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultHcl,
  isLoading,
}: NewPolicyDialogProps) {
  const [name, setName] = useState('');
  const [hcl, setHcl] = useState(defaultHcl);
  const [nameError, setNameError] = useState('');

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName('');
      setHcl(defaultHcl);
      setNameError('');
    }
    onOpenChange(next);
  }

  function validateName(value: string) {
    if (!value) {
      setNameError('Name is required.');
      return false;
    }
    if (!NAME_PATTERN.test(value)) {
      setNameError('Must start with a lowercase letter and contain only a–z, 0–9, and hyphens.');
      return false;
    }
    setNameError('');
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateName(name)) return;
    await onSubmit(name, hcl);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Policy</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="policy-name">Policy Name</Label>
            <Input
              id="policy-name"
              placeholder="my-policy"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) validateName(e.target.value);
              }}
              onBlur={() => validateName(name)}
              autoFocus
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Policy (HCL)</Label>
            <div className="overflow-hidden rounded-md border">
              <HCLEditor
                value={hcl}
                onChange={setHcl}
                height="240px"
                showLineNumbers
                showLint
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating…' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Generated password dialog
// ---------------------------------------------------------------------------

interface GeneratedPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  password: string;
}

function GeneratedPasswordDialog({
  open,
  onOpenChange,
  password,
}: GeneratedPasswordDialogProps) {
  function handleCopy() {
    navigator.clipboard.writeText(password).then(() => {
      toast.success('Password copied to clipboard.');
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generated Password</DialogTitle>
        </DialogHeader>
        <div className="rounded-md bg-muted p-4 font-mono text-sm break-all">
          {password}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ACL Policy panel (right side)
// ---------------------------------------------------------------------------

interface AclPolicyPanelProps {
  selectedName: string;
  onDeselect: () => void;
}

function AclPolicyPanel({ selectedName, onDeselect }: AclPolicyPanelProps) {
  const isSystem = isSystemPolicy(selectedName);

  const { data: policyRules, isLoading } = useAclPolicy(selectedName, !!selectedName);
  const writePolicy = useWriteAclPolicy();
  const deletePolicy = useDeleteAclPolicy();

  const [editing, setEditing] = useState(false);
  const [localHcl, setLocalHcl] = useState('');

  function startEdit() {
    setLocalHcl(policyRules ?? '');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setLocalHcl('');
  }

  async function handleSave() {
    try {
      await writePolicy.mutateAsync({ name: selectedName, policy: localHcl });
      toast.success(`Policy "${selectedName}" saved.`);
      setEditing(false);
    } catch (err: unknown) {
      toast.error(`Failed to save policy: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDelete() {
    try {
      await deletePolicy.mutateAsync(selectedName);
      toast.success(`Policy "${selectedName}" deleted.`);
      onDeselect();
    } catch (err: unknown) {
      toast.error(`Failed to delete policy: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const displayHcl = editing ? localHcl : (policyRules ?? '');

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <ShieldCheck className="h-5 w-5 shrink-0 text-muted-foreground" />
          <h2 className="truncate text-lg font-semibold">{selectedName}</h2>
          {isSystem && (
            <Badge variant="secondary" className="shrink-0">
              system
            </Badge>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!editing && !isSystem && (
            <Button
              size="sm"
              variant="outline"
              onClick={startEdit}
              disabled={isLoading}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          )}

          {editing && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelEdit}
                disabled={writePolicy.isPending}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={writePolicy.isPending}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {writePolicy.isPending ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}

          {!isSystem && !editing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deletePolicy.isPending}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete policy "{selectedName}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. Tokens using this policy will
                    lose the permissions it granted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Separator />

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : (
          <HCLEditor
            value={displayHcl}
            onChange={setLocalHcl}
            readOnly={!editing}
            height="100%"
            showLineNumbers
            showLint={editing}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ACL Policies tab
// ---------------------------------------------------------------------------

function AclPoliciesTab() {
  const { data: policies, isLoading, isError, error } = useAclPolicies();
  const writePolicy = useWriteAclPolicy();

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  async function handleCreatePolicy(name: string, policy: string) {
    try {
      await writePolicy.mutateAsync({ name, policy });
      toast.success(`Policy "${name}" created.`);
      setSelectedName(name);
    } catch (err: unknown) {
      toast.error(`Failed to create policy: ${err instanceof Error ? err.message : String(err)}`);
      throw err; // keep dialog open so user can retry
    }
  }

  return (
    <div className="flex h-full">
      {/* Left: policy list */}
      <div className="flex w-64 shrink-0 flex-col border-r">
        <div className="px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            ACL Policies
          </p>
        </div>
        <Separator />

        {isError && (
          <Alert variant="destructive" className="m-2">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to load policies.'}
            </AlertDescription>
          </Alert>
        )}

        <ScrollArea className="flex-1">
          {isLoading ? (
            <PolicyListSkeleton />
          ) : (
            <div className="space-y-0.5 p-2">
              {(policies ?? []).map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedName(name)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                    selectedName === name
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  <span className="truncate">{name}</span>
                  {isSystemPolicy(name) && (
                    <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                      sys
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />
        <div className="p-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setNewDialogOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Policy
          </Button>
        </div>
      </div>

      {/* Right: policy content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedName ? (
          <AclPolicyPanel
            key={selectedName}
            selectedName={selectedName}
            onDeselect={() => setSelectedName(null)}
          />
        ) : (
          <EmptyState message="Select a policy to view its rules, or create a new one." />
        )}
      </div>

      <NewPolicyDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onSubmit={handleCreatePolicy}
        defaultHcl={DEFAULT_ACL_HCL}
        isLoading={writePolicy.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Password Policy panel (right side)
// ---------------------------------------------------------------------------

interface PasswordPolicyPanelProps {
  selectedName: string;
  onDeselect: () => void;
}

function PasswordPolicyPanel({ selectedName, onDeselect }: PasswordPolicyPanelProps) {
  const isSystem = isSystemPolicy(selectedName);

  const { data: policyRules, isLoading } = usePasswordPolicy(selectedName, !!selectedName);
  const writePolicy = useWritePasswordPolicy();
  const deletePolicy = useDeletePasswordPolicy();
  const generatePassword = useGeneratePassword();

  const [editing, setEditing] = useState(false);
  const [localHcl, setLocalHcl] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  function startEdit() {
    setLocalHcl(policyRules ?? '');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setLocalHcl('');
  }

  async function handleSave() {
    try {
      await writePolicy.mutateAsync({ name: selectedName, policy: localHcl });
      toast.success(`Password policy "${selectedName}" saved.`);
      setEditing(false);
    } catch (err: unknown) {
      toast.error(`Failed to save policy: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDelete() {
    try {
      await deletePolicy.mutateAsync(selectedName);
      toast.success(`Password policy "${selectedName}" deleted.`);
      onDeselect();
    } catch (err: unknown) {
      toast.error(`Failed to delete policy: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleGeneratePassword() {
    try {
      const password = await generatePassword.mutateAsync(selectedName);
      setGeneratedPassword(password);
      setPasswordDialogOpen(true);
    } catch (err: unknown) {
      toast.error(
        `Failed to generate password: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const displayHcl = editing ? localHcl : (policyRules ?? '');

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <Shield className="h-5 w-5 shrink-0 text-muted-foreground" />
          <h2 className="truncate text-lg font-semibold">{selectedName}</h2>
          {isSystem && (
            <Badge variant="secondary" className="shrink-0">
              system
            </Badge>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleGeneratePassword}
            disabled={generatePassword.isPending || isLoading}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${generatePassword.isPending ? 'animate-spin' : ''}`}
            />
            {generatePassword.isPending ? 'Generating…' : 'Generate Password'}
          </Button>

          {!editing && !isSystem && (
            <Button
              size="sm"
              variant="outline"
              onClick={startEdit}
              disabled={isLoading}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          )}

          {editing && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelEdit}
                disabled={writePolicy.isPending}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={writePolicy.isPending}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {writePolicy.isPending ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}

          {!isSystem && !editing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deletePolicy.isPending}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete password policy "{selectedName}"?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. Any mounts using this
                    password policy will no longer be able to generate
                    passwords.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Separator />

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : (
          <HCLEditor
            value={displayHcl}
            onChange={setLocalHcl}
            readOnly={!editing}
            height="100%"
            showLineNumbers
            showLint={editing}
          />
        )}
      </div>

      <GeneratedPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        password={generatedPassword}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Password Policies tab
// ---------------------------------------------------------------------------

function PasswordPoliciesTab() {
  const { data: policies, isLoading, isError, error } = usePasswordPolicies();
  const writePolicy = useWritePasswordPolicy();

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  async function handleCreatePolicy(name: string, policy: string) {
    try {
      await writePolicy.mutateAsync({ name, policy });
      toast.success(`Password policy "${name}" created.`);
      setSelectedName(name);
    } catch (err: unknown) {
      toast.error(`Failed to create policy: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  return (
    <div className="flex h-full">
      {/* Left: policy list */}
      <div className="flex w-64 shrink-0 flex-col border-r">
        <div className="px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Password Policies
          </p>
        </div>
        <Separator />

        {isError && (
          <Alert variant="destructive" className="m-2">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to load policies.'}
            </AlertDescription>
          </Alert>
        )}

        <ScrollArea className="flex-1">
          {isLoading ? (
            <PolicyListSkeleton />
          ) : (
            <div className="space-y-0.5 p-2">
              {(policies ?? []).map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedName(name)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                    selectedName === name
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  <span className="truncate">{name}</span>
                  {isSystemPolicy(name) && (
                    <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                      sys
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />
        <div className="p-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setNewDialogOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Policy
          </Button>
        </div>
      </div>

      {/* Right: policy content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedName ? (
          <PasswordPolicyPanel
            key={selectedName}
            selectedName={selectedName}
            onDeselect={() => setSelectedName(null)}
          />
        ) : (
          <EmptyState message="Select a password policy to view its configuration, or create a new one." />
        )}
      </div>

      <NewPolicyDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onSubmit={handleCreatePolicy}
        defaultHcl={DEFAULT_PASSWORD_HCL}
        isLoading={writePolicy.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PoliciesPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="px-6 py-5">
        <h1 className="text-2xl font-bold tracking-tight">Policies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage ACL and password policies for your OpenBao instance.
        </p>
      </div>
      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="acl" className="flex flex-1 flex-col overflow-hidden">
        <div className="px-6 pt-4">
          <TabsList>
            <TabsTrigger value="acl">
              <ShieldCheck className="mr-1.5 h-4 w-4" />
              ACL Policies
            </TabsTrigger>
            <TabsTrigger value="password">
              <Shield className="mr-1.5 h-4 w-4" />
              Password Policies
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="acl" className="mt-4 flex-1 overflow-hidden border-t">
          <AclPoliciesTab />
        </TabsContent>

        <TabsContent value="password" className="mt-4 flex-1 overflow-hidden border-t">
          <PasswordPoliciesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
