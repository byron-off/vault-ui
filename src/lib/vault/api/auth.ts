import { vaultFetch } from '../client';

export async function lookupSelfToken(): Promise<{
  accessor: string;
  policies: string[];
  ttl: number;
  renewable: boolean;
  display_name: string;
  entity_id: string;
  expire_time: string | null;
}> {
  const res = await vaultFetch<{
    data: {
      accessor: string;
      policies: string[];
      ttl: number;
      renewable: boolean;
      display_name: string;
      entity_id: string;
      expire_time: string | null;
    };
  }>('/auth/token/lookup-self');
  return res.data;
}

export async function renewSelfToken(increment?: string): Promise<void> {
  await vaultFetch('/auth/token/renew-self', {
    method: 'POST',
    body: increment ? { increment } : {},
  });
}

export async function listTokenAccessors(): Promise<string[]> {
  const res = await vaultFetch<{ data: { keys: string[] } }>('/auth/token/accessors', { method: 'LIST' });
  return res.data.keys;
}

export async function lookupTokenByAccessor(accessor: string): Promise<Record<string, unknown>> {
  const res = await vaultFetch<{ data: Record<string, unknown> }>('/auth/token/lookup-accessor', {
    method: 'POST',
    body: { accessor },
  });
  return res.data;
}

export async function revokeTokenByAccessor(accessor: string): Promise<void> {
  await vaultFetch('/auth/token/revoke-accessor', {
    method: 'POST',
    body: { accessor },
  });
}
