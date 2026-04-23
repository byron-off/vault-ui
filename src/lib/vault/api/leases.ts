import { vaultFetch } from '../client';
import type { LeaseInfo } from '@/types/vault';

export async function listLeasePrefixes(prefix = ''): Promise<string[]> {
  const path = prefix ? `/sys/leases/lookup/${prefix}` : '/sys/leases/lookup/';
  const res = await vaultFetch<{ data: { keys: string[] } }>(path, { method: 'LIST' });
  return res.data.keys;
}

export async function lookupLease(lease_id: string): Promise<LeaseInfo> {
  const res = await vaultFetch<{ data: LeaseInfo }>('/sys/leases/lookup', {
    method: 'POST',
    body: { lease_id },
  });
  return res.data;
}

export async function renewLease(lease_id: string, increment?: number): Promise<LeaseInfo> {
  const res = await vaultFetch<{ data: LeaseInfo }>('/sys/leases/renew', {
    method: 'POST',
    body: { lease_id, increment },
  });
  return res.data;
}

export async function revokeLease(lease_id: string): Promise<void> {
  await vaultFetch('/sys/leases/revoke', { method: 'POST', body: { lease_id } });
}

export async function revokePrefix(prefix: string): Promise<void> {
  await vaultFetch(`/sys/leases/revoke-prefix/${prefix}`, { method: 'POST' });
}

export async function revokeForce(prefix: string): Promise<void> {
  await vaultFetch(`/sys/leases/revoke-force/${prefix}`, { method: 'POST' });
}

export async function tidyLeases(): Promise<void> {
  await vaultFetch('/sys/leases/tidy', { method: 'POST' });
}

export async function getLeasesCount(): Promise<{ count: number }> {
  const res = await vaultFetch<{ data: { count: number } }>('/sys/leases/count');
  return res.data;
}
