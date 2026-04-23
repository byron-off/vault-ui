import { vaultFetch } from '../client';
import type { MountConfig, AuthMount } from '@/types/vault';

export async function listMounts(): Promise<Record<string, MountConfig>> {
  const res = await vaultFetch<{ data: Record<string, MountConfig> }>('/sys/mounts');
  return res.data;
}

export async function enableMount(
  path: string,
  opts: { type: string; description?: string; options?: Record<string, string> }
): Promise<void> {
  await vaultFetch(`/sys/mounts/${path}`, { method: 'POST', body: opts });
}

export async function disableMount(path: string): Promise<void> {
  await vaultFetch(`/sys/mounts/${path}`, { method: 'DELETE' });
}

export async function getMountTune(path: string): Promise<Record<string, unknown>> {
  const res = await vaultFetch<Record<string, unknown>>(`/sys/mounts/${path}/tune`);
  return res;
}

export async function tuneMountConfig(path: string, opts: Record<string, unknown>): Promise<void> {
  await vaultFetch(`/sys/mounts/${path}/tune`, { method: 'POST', body: opts });
}

export async function listAuthMounts(): Promise<Record<string, AuthMount>> {
  const res = await vaultFetch<{ data: Record<string, AuthMount> }>('/sys/auth');
  return res.data;
}

export async function enableAuthMethod(
  path: string,
  opts: { type: string; description?: string; config?: Record<string, unknown> }
): Promise<void> {
  await vaultFetch(`/sys/auth/${path}`, { method: 'POST', body: opts });
}

export async function disableAuthMethod(path: string): Promise<void> {
  await vaultFetch(`/sys/auth/${path}`, { method: 'DELETE' });
}
