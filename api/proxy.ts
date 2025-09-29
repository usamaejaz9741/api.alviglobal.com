export const config = { runtime: 'edge' };

const allowOrigins = [
  'https://api.alviglobal.com',
];

function corsHeaders(origin: string | null) {
  const allow = origin && allowOrigins.includes(origin) ? origin : 'https://api.alviglobal.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Ollama-*',
    'Access-Control-Max-Age': '86400',
  };
}

export default async function handler(req: Request) {
  const upstreamBase = (process.env.UPSTREAM || '').replace(/\/+$/, '');
  if (!upstreamBase) return new Response('Missing UPSTREAM', { status: 500 });

  const inUrl = new URL(req.url);
  const origin = req.headers.get('origin');

  let upstreamPath = inUrl.pathname;
  if (!upstreamPath.startsWith('/api/')) {
    upstreamPath = upstreamPath === '/' ? '/api/tags' : '/api' + upstreamPath;
  }

  const outUrl = new URL(upstreamBase);
  outUrl.pathname = upstreamPath;
  outUrl.search = inUrl.search;

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const fwdHeaders = new Headers(req.headers);
  fwdHeaders.delete('host');

  const resp = await fetch(outUrl.toString(), {
    method: req.method,
    headers: fwdHeaders,
    body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : req.body,
    redirect: 'manual',
  });

  const h = new Headers(resp.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) h.set(k, v as string);

  return new Response(resp.body, { status: resp.status, headers: h });
}
