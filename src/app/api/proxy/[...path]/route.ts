import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const vaultAddr = req.headers.get('X-Vault-Addr');
  const token = req.headers.get('X-Vault-Token');
  const namespace = req.headers.get('X-Vault-Namespace');

  if (!vaultAddr) {
    return NextResponse.json({ errors: ['X-Vault-Addr header is required'] }, { status: 400 });
  }

  const pathStr = path.join('/');
  const searchParams = req.nextUrl.searchParams.toString();
  const targetUrl = `${vaultAddr}/v1/${pathStr}${searchParams ? `?${searchParams}` : ''}`;

  const method = req.method;
  const body = method !== 'GET' && method !== 'HEAD' ? await req.text() : undefined;

  try {
    const res = await fetch(targetUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Vault-Token': token } : {}),
        ...(namespace ? { 'X-Vault-Namespace': namespace } : {}),
      },
      body: body || undefined,
    });

    const responseText = await res.text();
    return new NextResponse(responseText, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { errors: [`Proxy error: ${err instanceof Error ? err.message : 'Unknown error'}`] },
      { status: 502 }
    );
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
