import { NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

async function proxyRequest(req: Request, {params}: {params: string}) {
  const path = params;
  console.log("path", path);
  
  const target = `${BACKEND}/schedule-bot${path ? '/' + path : ''}`;
  console.log("target", target);

  const headers: Record<string, string> = {};
  // Forward common headers
  const incoming = req.headers;
  const accept = incoming.get('accept');
  if (accept) headers['accept'] = accept;

  const method = req.method;
  const init: RequestInit = { method, headers };

  if (method !== 'GET' && method !== 'HEAD') {
    try {
      const body = await req.arrayBuffer();
      init.body = body;
    } catch (e) {
      // ignore
    }
  }

  // Add a short timeout and clearer error handling when backend is down
  const controller = new AbortController();
  const timeoutMs = 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  // attach signal
  (init as any).signal = controller.signal;

  try {
    const res = await fetch(target, init);
    clearTimeout(timeoutId);
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': contentType },
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    const msg = err?.name === 'AbortError' ? `Backend request timed out after ${timeoutMs}ms` : String(err?.message || err);
    const info = {
      error: 'Unable to reach backend',
      detail: msg,
      target,
      method,
    };
    return new NextResponse(JSON.stringify(info, null, 2), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ path?: string }> }) {
  const resolved = await params;
  return proxyRequest(req, { params: resolved?.path ?? ''});
}

export async function POST(req: Request, { params }: { params: Promise<{ path?: string }> }) {
  const resolved = await params;
  return proxyRequest(req, { params: resolved?.path ?? ''});
}

export async function PUT(req: Request, { params }: { params: Promise<{ path?: string }> }) {
  const resolved = await params;
  return proxyRequest(req, { params: resolved?.path ?? ''});
}

export async function DELETE(req: Request, { params }: { params: Promise<{ path?: string }> }) {
  const resolved = await params;
  return proxyRequest(req, { params: resolved?.path ?? ''});
}
