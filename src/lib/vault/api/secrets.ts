import { vaultFetch } from '../client';
import { VaultError } from '../errors';
import type { KVSecret, KVMetadata, KVVersion } from '@/types/vault';

export async function listSecrets(path: string): Promise<string[]> {
  try {
    const res = await vaultFetch<{ data: { keys: string[] } }>(
      `/secret/metadata/${path}`,
      { method: 'LIST' }
    );
    return res.data.keys ?? [];
  } catch (err) {
    if (err instanceof VaultError && err.status === 404) return [];
    throw err;
  }
}

export async function readSecret(path: string, version?: number): Promise<KVSecret> {
  const res = await vaultFetch<{ data: KVSecret }>(
    `/secret/data/${path}`,
    { method: 'GET', query: version ? { version } : undefined }
  );
  return res.data;
}

export async function writeSecret(
  path: string,
  data: Record<string, string>,
  cas?: number
): Promise<KVVersion> {
  const body = { data, options: cas !== undefined ? { cas } : undefined };
  const res = await vaultFetch<{ data: KVVersion }>(
    `/secret/data/${path}`,
    { method: 'POST', body }
  );
  return res.data;
}

export async function getSecretMetadata(path: string): Promise<KVMetadata> {
  const res = await vaultFetch<{ data: KVMetadata }>(
    `/secret/metadata/${path}`,
    { method: 'GET' }
  );
  return res.data;
}

export async function updateSecretMetadata(
  path: string,
  opts: { max_versions?: number; cas_required?: boolean; custom_metadata?: Record<string, string> }
): Promise<void> {
  await vaultFetch(`/secret/metadata/${path}`, { method: 'POST', body: opts });
}

export async function softDeleteSecretVersions(path: string, versions: number[]): Promise<void> {
  await vaultFetch(`/secret/delete/${path}`, { method: 'POST', body: { versions } });
}

export async function undeleteSecretVersions(path: string, versions: number[]): Promise<void> {
  await vaultFetch(`/secret/undelete/${path}`, { method: 'POST', body: { versions } });
}

export async function destroySecretVersions(path: string, versions: number[]): Promise<void> {
  await vaultFetch(`/secret/destroy/${path}`, { method: 'POST', body: { versions } });
}

export async function deleteSecretMetadata(path: string): Promise<void> {
  await vaultFetch(`/secret/metadata/${path}`, { method: 'DELETE' });
}

export async function getSecretSubkeys(path: string, version?: number): Promise<Record<string, unknown>> {
  const res = await vaultFetch<{ data: { subkeys: Record<string, unknown> } }>(
    `/secret/subkeys/${path}`,
    { method: 'GET', query: version ? { version } : undefined }
  );
  return res.data.subkeys;
}
