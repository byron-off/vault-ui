import { VaultError } from './errors';
import { useConnectionStore } from '@/lib/store';

export type VaultRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'LIST' | 'PATCH';
  body?: unknown;
  query?: Record<string, string | number | boolean>;
};

function buildUrl(base: string, path: string, query?: Record<string, string | number | boolean>): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}/v1${normalizedPath}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseVaultResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    if (res.ok) return {} as T;
    throw new VaultError(res.status, [`HTTP ${res.status}`]);
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    if (res.ok) return {} as T;
    throw new VaultError(res.status, [text]);
  }

  if (!res.ok) {
    const errors = (json.errors as string[]) || [`HTTP ${res.status}`];
    const warnings = json.warnings as string[] | undefined;
    throw new VaultError(res.status, errors, warnings);
  }

  return json as T;
}

async function doFetch<T>(
  url: string,
  method: string,
  token: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const httpMethod = method === 'LIST' ? 'GET' : method;
  const res = await fetch(url, {
    method: httpMethod,
    headers: {
      'Content-Type': 'application/json',
      'X-Vault-Token': token,
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseVaultResponse<T>(res);
}

export async function vaultFetch<T>(path: string, opts: VaultRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = opts;
  const store = useConnectionStore.getState();
  const { addr, token } = store;

  if (!addr || !token) {
    throw new VaultError(401, ['Not connected']);
  }

  const effectiveQuery = method === 'LIST' ? { ...query, list: true } : query;

  try {
    const url = buildUrl(addr, path, effectiveQuery);
    return await doFetch<T>(url, method, token, body);
  } catch (err) {
    if (err instanceof VaultError) throw err;

    // CORS or network error — fall back to proxy
    const proxyUrl = buildUrl('', `/api/proxy${path}`, effectiveQuery).replace('http:///api', '/api').replace('https:///api', '/api');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    let proxyUrlStr = `/api/proxy${normalizedPath}`;
    if (effectiveQuery) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(effectiveQuery)) {
        params.set(k, String(v));
      }
      proxyUrlStr += `?${params.toString()}`;
    }
    void proxyUrl;
    return await doFetch<T>(proxyUrlStr, method, token, body, {
      'X-Vault-Addr': addr,
    });
  }
}

export async function vaultFetchDirect<T>(
  addr: string,
  token: string,
  path: string,
  opts: VaultRequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, query } = opts;
  const effectiveQuery = method === 'LIST' ? { ...query, list: true } : query;
  const url = buildUrl(addr, path, effectiveQuery);
  try {
    return await doFetch<T>(url, method, token, body);
  } catch (err) {
    if (err instanceof VaultError) throw err;
    // Fallback to proxy
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    let proxyUrlStr = `/api/proxy${normalizedPath}`;
    if (effectiveQuery) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(effectiveQuery)) {
        params.set(k, String(v));
      }
      proxyUrlStr += `?${params.toString()}`;
    }
    return await doFetch<T>(proxyUrlStr, method, token, body, {
      'X-Vault-Addr': addr,
    });
  }
}
