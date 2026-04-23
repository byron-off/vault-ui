import { vaultFetch } from '../client';
import { vaultFetchDirect } from '../client';
import type { SysHealth, SealStatus, HAStatus, TokenInfo } from '@/types/vault';

export async function getHealth(addr: string): Promise<SysHealth> {
  const res = await fetch(`${addr}/v1/sys/health`);
  return res.json();
}

export async function lookupSelf(addr: string, token: string): Promise<TokenInfo> {
  const res = await vaultFetchDirect<{ data: TokenInfo }>(addr, token, '/auth/token/lookup-self');
  return res.data;
}

export async function getSealStatus(): Promise<SealStatus> {
  const res = await vaultFetch<{ data?: SealStatus } & SealStatus>('/sys/seal-status');
  // OpenBao returns this directly, not wrapped in data
  return res as unknown as SealStatus;
}

export async function getHAStatus(): Promise<HAStatus> {
  const res = await vaultFetch<{ data: HAStatus }>('/sys/ha-status');
  return res.data;
}

export async function getInternalMounts(): Promise<Record<string, unknown>> {
  const res = await vaultFetch<{ data: Record<string, unknown> }>('/sys/internal/ui/mounts');
  return res.data;
}

export async function getTokenCounters(): Promise<{ counters: { total: number } }> {
  const res = await vaultFetch<{ data: { counters: { total: number } } }>(
    '/sys/internal/counters/tokens'
  );
  return res.data;
}

export async function getEntityCounters(): Promise<{ counters: { total: number } }> {
  const res = await vaultFetch<{ data: { counters: { total: number } } }>(
    '/sys/internal/counters/entities'
  );
  return res.data;
}

export async function getVersionHistory(): Promise<
  Array<{ version: string; build_date: string; previous_version: string | null }>
> {
  const res = await vaultFetch<{
    data: { keys: string[]; key_info: Record<string, { build_date: string; previous_version: string | null }> };
  }>('/sys/version-history', { method: 'LIST' });
  return res.data.keys.map((v) => ({
    version: v,
    build_date: res.data.key_info[v]?.build_date ?? '',
    previous_version: res.data.key_info[v]?.previous_version ?? null,
  }));
}

export async function unseal(key: string, reset?: boolean): Promise<SealStatus> {
  const res = await vaultFetch<SealStatus>('/sys/unseal', {
    method: 'POST',
    body: { key, reset },
  });
  return res;
}

export async function seal(): Promise<void> {
  await vaultFetch('/sys/seal', { method: 'POST' });
}

export async function getHostInfo(): Promise<Record<string, unknown>> {
  const res = await vaultFetch<{ data: Record<string, unknown> }>('/sys/host-info');
  return res.data;
}

export async function getAuditDevices(): Promise<Record<string, unknown>> {
  const res = await vaultFetch<{ data: Record<string, unknown> }>('/sys/audit');
  return res.data;
}

export async function enableAuditDevice(
  path: string,
  opts: { type: string; description?: string; options?: Record<string, string> }
): Promise<void> {
  await vaultFetch(`/sys/audit/${path}`, { method: 'POST', body: opts });
}

export async function disableAuditDevice(path: string): Promise<void> {
  await vaultFetch(`/sys/audit/${path}`, { method: 'DELETE' });
}

export async function rotateMasterKey(): Promise<void> {
  await vaultFetch('/sys/rotate', { method: 'POST' });
}

export async function getLeaderStatus(): Promise<{ ha_enabled: boolean; is_self: boolean; leader_address: string }> {
  const res = await vaultFetch<{ ha_enabled: boolean; is_self: boolean; leader_address: string }>(
    '/sys/leader'
  );
  return res;
}
