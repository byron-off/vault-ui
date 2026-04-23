import { vaultFetch } from '../client';
import type { Application } from '@/types/app';

const APPS_BASE = 'vault-ui/apps';

export async function listApplications(): Promise<string[]> {
  try {
    const res = await vaultFetch<{ data: { keys: string[] } }>(
      `/secret/metadata/${APPS_BASE}`,
      { method: 'LIST' }
    );
    return res.data.keys;
  } catch {
    return [];
  }
}

export async function getApplication(name: string): Promise<Application> {
  const res = await vaultFetch<{ data: { data: Application } }>(
    `/secret/data/${APPS_BASE}/${name}`
  );
  return res.data.data;
}

export async function saveApplication(app: Application): Promise<void> {
  await vaultFetch(`/secret/data/${APPS_BASE}/${app.app_name}`, {
    method: 'POST',
    body: { data: app },
  });
}

export async function deleteApplicationMetadata(name: string): Promise<void> {
  await vaultFetch(`/secret/metadata/${APPS_BASE}/${name}`, { method: 'DELETE' });
}
