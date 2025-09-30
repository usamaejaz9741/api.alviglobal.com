export const config = { runtime: 'edge' };

/** Minimal shim so TS compiles in Edge runtime without @types/node */
declare const process:
  | undefined
  | { env?: Record<string, string | undefined> };

const allowOrigins = ['https://api.alviglobal.com'];

/** If UPSTREAM env is missing, fall back to your tunnel */
const UPSTREAM_FALLBACK = 'https://246da0a7-5491-4b01-8531-aa776a2cec66.cfargotunnel.com';

function corsHeaders(origin: string | null) {
  const allow = origin && allowOrigins.includes(origin) ? origin : allowOrigins[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Ollama-*',
    'Access-Control-Max-Age': '86400',
  };
}

export default async function handler(req: Request) {
  // Read UPSTREAM from env if present, else fallback
  const upstreamBase = (process?.env?.UPSTREAM ?? UPSTREAM_FALLBACK).replace(/\/+$/, '');
  if (!upstreamBase) return new Response('Missing UPSTREAM', { status: 500 });

  const inUrl = new URL(req.url);
  const origin = req.headers.get('origin');

  // Map pretty paths to Ollama’s /api/*
  // "/" -> /api/tags, "/tags" -> /api/tags, "/generate" -> /api/generate, etc.
  let upstreamPath = inUrl.pathname;
  if (!upstreamPath.startsWith('/api/')) {
    upstreamPath = upstreamPath === '/' ? '/api/tags' : '/api' + upstreamPath;
  }

  const outUrl = new URL(upstreamBase);
  outUrl.pathname = upstreamPath;
  outUrl.search = inUrl.search;

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const fwdHeaders = new Headers(req.headers);
  fwdHeaders.delete('host'); // Edge can’t set Host

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
