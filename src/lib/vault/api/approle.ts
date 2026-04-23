import { vaultFetch } from '../client';
import type { AppRoleRole } from '@/types/vault';

export async function listAppRoles(mount = 'approle'): Promise<string[]> {
  const res = await vaultFetch<{ data: { keys: string[] } }>(`/auth/${mount}/role`, { method: 'LIST' });
  return res.data.keys;
}

export async function getAppRole(name: string, mount = 'approle'): Promise<AppRoleRole> {
  const res = await vaultFetch<{ data: AppRoleRole }>(`/auth/${mount}/role/${name}`);
  return res.data;
}

export async function createAppRole(
  name: string,
  opts: {
    policies?: string[];
    token_ttl?: string;
    token_max_ttl?: string;
    secret_id_ttl?: string;
    secret_id_num_uses?: number;
    token_num_uses?: number;
    bind_secret_id?: boolean;
    token_bound_cidrs?: string[];
  },
  mount = 'approle'
): Promise<void> {
  await vaultFetch(`/auth/${mount}/role/${name}`, { method: 'POST', body: opts });
}

export async function deleteAppRole(name: string, mount = 'approle'): Promise<void> {
  await vaultFetch(`/auth/${mount}/role/${name}`, { method: 'DELETE' });
}

export async function getRoleId(name: string, mount = 'approle'): Promise<string> {
  const res = await vaultFetch<{ data: { role_id: string } }>(`/auth/${mount}/role/${name}/role-id`);
  return res.data.role_id;
}

export async function generateSecretId(
  name: string,
  opts: { metadata?: string; cidr_list?: string[] } = {},
  mount = 'approle'
): Promise<{ secret_id: string; secret_id_accessor: string; secret_id_ttl: number }> {
  const res = await vaultFetch<{
    data: { secret_id: string; secret_id_accessor: string; secret_id_ttl: number };
  }>(`/auth/${mount}/role/${name}/secret-id`, { method: 'POST', body: opts });
  return res.data;
}

export async function listSecretIdAccessors(name: string, mount = 'approle'): Promise<string[]> {
  const res = await vaultFetch<{ data: { keys: string[] } }>(
    `/auth/${mount}/role/${name}/secret-id`,
    { method: 'LIST' }
  );
  return res.data.keys;
}

export async function destroySecretId(
  name: string,
  accessor: string,
  mount = 'approle'
): Promise<void> {
  await vaultFetch(`/auth/${mount}/role/${name}/secret-id-accessor/destroy`, {
    method: 'POST',
    body: { secret_id_accessor: accessor },
  });
}

export async function tidyAppRole(mount = 'approle'): Promise<void> {
  await vaultFetch(`/auth/${mount}/tidy/secret-id`, { method: 'POST' });
}
