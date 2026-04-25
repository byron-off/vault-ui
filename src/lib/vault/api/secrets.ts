import { vaultFetch } from '../client';
import { VaultError } from '../errors';
import type { KVSecret, KVMetadata, KVVersion } from '@/types/vault';

export type KVCtx = { mount: string; isV1: boolean };

export async function listSecrets(ctx: KVCtx, path: string): Promise<string[]> {
  const endpoint = ctx.isV1
    ? `/${ctx.mount}${path ? `/${path}` : ''}`
    : `/${ctx.mount}/metadata${path ? `/${path}` : ''}`;
  try {
    const res = await vaultFetch<{ data: { keys: string[] } }>(endpoint, { method: 'LIST' });
    return res.data.keys ?? [];
  } catch (err) {
    if (err instanceof VaultError && err.status === 404) return [];
    throw err;
  }
}

export async function readSecret(ctx: KVCtx, path: string, version?: number): Promise<KVSecret> {
  if (ctx.isV1) {
    const res = await vaultFetch<{ data: Record<string, string> }>(`/${ctx.mount}/${path}`);
    // Normalise to KVSecret shape so the UI can reuse the same components
    return { data: res.data, metadata: { version: 1, created_time: '', deletion_time: '', destroyed: false } };
  }
  const res = await vaultFetch<{ data: KVSecret }>(
    `/${ctx.mount}/data/${path}`,
    { method: 'GET', query: version ? { version } : undefined }
  );
  return res.data;
}

export async function writeSecret(
  ctx: KVCtx,
  path: string,
  data: Record<string, string>,
  cas?: number
): Promise<KVVersion> {
  if (ctx.isV1) {
    await vaultFetch(`/${ctx.mount}/${path}`, { method: 'POST', body: data });
    return { version: 1, created_time: new Date().toISOString(), deletion_time: '', destroyed: false };
  }
  const body = { data, options: cas !== undefined ? { cas } : undefined };
  const res = await vaultFetch<{ data: KVVersion }>(
    `/${ctx.mount}/data/${path}`,
    { method: 'POST', body }
  );
  return res.data;
}

export async function deleteSecretV1(ctx: KVCtx, path: string): Promise<void> {
  await vaultFetch(`/${ctx.mount}/${path}`, { method: 'DELETE' });
}

export async function getSecretMetadata(ctx: KVCtx, path: string): Promise<KVMetadata> {
  const res = await vaultFetch<{ data: KVMetadata }>(
    `/${ctx.mount}/metadata/${path}`,
    { method: 'GET' }
  );
  return res.data;
}

export async function updateSecretMetadata(
  ctx: KVCtx,
  path: string,
  opts: { max_versions?: number; cas_required?: boolean; custom_metadata?: Record<string, string> }
): Promise<void> {
  await vaultFetch(`/${ctx.mount}/metadata/${path}`, { method: 'POST', body: opts });
}

export async function softDeleteSecretVersions(ctx: KVCtx, path: string, versions: number[]): Promise<void> {
  await vaultFetch(`/${ctx.mount}/delete/${path}`, { method: 'POST', body: { versions } });
}

export async function undeleteSecretVersions(ctx: KVCtx, path: string, versions: number[]): Promise<void> {
  await vaultFetch(`/${ctx.mount}/undelete/${path}`, { method: 'POST', body: { versions } });
}

export async function destroySecretVersions(ctx: KVCtx, path: string, versions: number[]): Promise<void> {
  await vaultFetch(`/${ctx.mount}/destroy/${path}`, { method: 'POST', body: { versions } });
}

export async function deleteSecretMetadata(ctx: KVCtx, path: string): Promise<void> {
  await vaultFetch(`/${ctx.mount}/metadata/${path}`, { method: 'DELETE' });
}
