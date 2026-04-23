import { vaultFetch } from '../client';
import type { IdentityEntity, IdentityGroup } from '@/types/vault';

// ── Entities ────────────────────────────────────────────────────────────────

export async function listEntities(): Promise<string[]> {
  const res = await vaultFetch<{ data: { keys: string[] } }>('/identity/entity/name', {
    method: 'LIST',
  });
  return res.data.keys;
}

export async function getEntityByName(name: string): Promise<IdentityEntity> {
  const res = await vaultFetch<{ data: IdentityEntity }>(`/identity/entity/name/${name}`);
  return res.data;
}

export async function getEntityById(id: string): Promise<IdentityEntity> {
  const res = await vaultFetch<{ data: IdentityEntity }>(`/identity/entity/id/${id}`);
  return res.data;
}

export async function createEntity(opts: {
  name: string;
  policies?: string[];
  metadata?: Record<string, string>;
  disabled?: boolean;
}): Promise<{ id: string; name: string }> {
  const res = await vaultFetch<{ data: { id: string; name: string } }>('/identity/entity', {
    method: 'POST',
    body: opts,
  });
  return res.data;
}

export async function updateEntity(
  id: string,
  opts: { name?: string; policies?: string[]; metadata?: Record<string, string>; disabled?: boolean }
): Promise<void> {
  await vaultFetch(`/identity/entity/id/${id}`, { method: 'POST', body: opts });
}

export async function deleteEntity(id: string): Promise<void> {
  await vaultFetch(`/identity/entity/id/${id}`, { method: 'DELETE' });
}

export async function batchDeleteEntities(entity_ids: string[]): Promise<void> {
  await vaultFetch('/identity/entity/batch-delete', { method: 'POST', body: { entity_ids } });
}

// ── Groups ───────────────────────────────────────────────────────────────────

export async function listGroups(): Promise<string[]> {
  const res = await vaultFetch<{ data: { keys: string[] } }>('/identity/group/name', {
    method: 'LIST',
  });
  return res.data.keys;
}

export async function getGroupById(id: string): Promise<IdentityGroup> {
  const res = await vaultFetch<{ data: IdentityGroup }>(`/identity/group/id/${id}`);
  return res.data;
}

export async function createGroup(opts: {
  name: string;
  type?: 'internal' | 'external';
  policies?: string[];
  member_entity_ids?: string[];
  member_group_ids?: string[];
  metadata?: Record<string, string>;
}): Promise<{ id: string; name: string }> {
  const res = await vaultFetch<{ data: { id: string; name: string } }>('/identity/group', {
    method: 'POST',
    body: opts,
  });
  return res.data;
}

export async function updateGroup(
  id: string,
  opts: {
    name?: string;
    policies?: string[];
    member_entity_ids?: string[];
    member_group_ids?: string[];
    metadata?: Record<string, string>;
  }
): Promise<void> {
  await vaultFetch(`/identity/group/id/${id}`, { method: 'POST', body: opts });
}

export async function deleteGroup(id: string): Promise<void> {
  await vaultFetch(`/identity/group/id/${id}`, { method: 'DELETE' });
}

// ── Aliases ───────────────────────────────────────────────────────────────────

export async function listEntityAliases(): Promise<string[]> {
  const res = await vaultFetch<{ data: { keys: string[] } }>('/identity/entity-alias/id', {
    method: 'LIST',
  });
  return res.data.keys;
}

export async function createEntityAlias(opts: {
  name: string;
  canonical_id: string;
  mount_accessor: string;
}): Promise<{ id: string }> {
  const res = await vaultFetch<{ data: { id: string } }>('/identity/entity-alias', {
    method: 'POST',
    body: opts,
  });
  return res.data;
}

export async function deleteEntityAlias(id: string): Promise<void> {
  await vaultFetch(`/identity/entity-alias/id/${id}`, { method: 'DELETE' });
}
