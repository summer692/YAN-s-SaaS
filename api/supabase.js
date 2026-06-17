const PROXY_PREFIX = '/api/supabase';
const PROXY_PATH_PARAM = 'atlas_proxy_path';

const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
]);

function buildTargetUrl(supabaseUrl, requestUrl) {
  const base = (supabaseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('SUPABASE_URL is not configured');

  const incoming = new URL(requestUrl, 'https://atlas.local');
  const rewrittenPath = incoming.searchParams.get(PROXY_PATH_PARAM);
  let path = rewrittenPath ? `/${rewrittenPath.replace(/^\/+/, '')}` : incoming.pathname;
  incoming.searchParams.delete(PROXY_PATH_PARAM);
  if (rewrittenPath && incoming.searchParams.get('path') === rewrittenPath) {
    incoming.searchParams.delete('path');
  }

  if (path.startsWith(PROXY_PREFIX)) {
    path = path.slice(PROXY_PREFIX.length) || '/';
  }
  if (!path.startsWith('/')) path = '/' + path;

  const search = incoming.searchParams.toString();
  return `${base}${path}${search ? `?${search}` : ''}`;
}

function buildProxyHeaders(incomingHeaders, supabaseKey, browserKey) {
  const headers = new Headers();
  for (const [rawKey, rawValue] of Object.entries(incomingHeaders || {})) {
    const key = rawKey.toLowerCase();
    if (HOP_BY_HOP_REQUEST_HEADERS.has(key)) continue;
    if (rawValue === undefined) continue;
    headers.set(rawKey, Array.isArray(rawValue) ? rawValue.join(', ') : String(rawValue));
  }

  headers.set('apikey', supabaseKey);

  const auth = headers.get('authorization');
  if (!auth || (browserKey && auth === `Bearer ${browserKey}`)) {
    headers.set('authorization', `Bearer ${supabaseKey}`);
  }

  return headers;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    sendJson(res, 500, { message: 'Atlas Supabase proxy is not configured' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const targetUrl = buildTargetUrl(supabaseUrl, req.url);
    const browserKey = req.headers.apikey || '';
    const headers = buildProxyHeaders(req.headers, supabaseKey, browserKey);
    const method = req.method || 'GET';
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readRawBody(req);

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: body && body.length ? body : undefined,
      redirect: 'manual',
    });

    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_RESPONSE_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    res.setHeader('cache-control', upstream.headers.get('cache-control') || 'no-store');

    if (method === 'HEAD') {
      res.end();
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.end(buffer);
  } catch (error) {
    console.error('[atlas supabase proxy] request failed', error);
    sendJson(res, 502, {
      message: `Atlas proxy could not reach Supabase: ${error && error.message ? error.message : String(error)}`,
    });
  }
}

module.exports = handler;
module.exports.buildTargetUrl = buildTargetUrl;
module.exports.buildProxyHeaders = buildProxyHeaders;
