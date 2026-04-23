import { vaultFetch } from '../client';

export async function listAclPolicies(): Promise<string[]> {
  const res = await vaultFetch<{ data: { keys: string[] } }>('/sys/policies/acl', { method: 'LIST' });
  return res.data.keys;
}

export async function getAclPolicy(name: string): Promise<string> {
  const res = await vaultFetch<{ data: { name: string; policy: string } }>(`/sys/policies/acl/${name}`);
  return res.data.policy ?? '';
}

export async function writeAclPolicy(name: string, policy: string): Promise<void> {
  await vaultFetch(`/sys/policies/acl/${name}`, { method: 'POST', body: { policy } });
}

export async function deleteAclPolicy(name: string): Promise<void> {
  await vaultFetch(`/sys/policies/acl/${name}`, { method: 'DELETE' });
}

export async function listPasswordPolicies(): Promise<string[]> {
  const res = await vaultFetch<{ data: { keys: string[] } }>('/sys/policies/password', { method: 'LIST' });
  return res.data.keys;
}

export async function getPasswordPolicy(name: string): Promise<string> {
  const res = await vaultFetch<{ data: { name: string; policy: string } }>(`/sys/policies/password/${name}`);
  return res.data.policy;
}

export async function writePasswordPolicy(name: string, policy: string): Promise<void> {
  await vaultFetch(`/sys/policies/password/${name}`, { method: 'POST', body: { policy } });
}

export async function deletePasswordPolicy(name: string): Promise<void> {
  await vaultFetch(`/sys/policies/password/${name}`, { method: 'DELETE' });
}

export async function generatePassword(name: string): Promise<string> {
  const res = await vaultFetch<{ data: { password: string } }>(`/sys/policies/password/${name}/generate`);
  return res.data.password;
}
