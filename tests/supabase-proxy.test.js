const assert = require('node:assert/strict');

const vercelConfig = require('../vercel.json');
const proxy = require('../api/supabase.js');

assert.equal(typeof proxy.buildTargetUrl, 'function');
assert.equal(typeof proxy.buildProxyHeaders, 'function');

assert.ok(
  vercelConfig.rewrites.some((rewrite) =>
    rewrite.source === '/api/supabase/:path*'
    && rewrite.destination === '/api/supabase?atlas_proxy_path=:path'
  )
);

assert.equal(
  proxy.buildTargetUrl(
    'https://example.supabase.co',
    '/api/supabase/auth/v1/otp?redirect_to=https%3A%2F%2Fapp.example'
  ),
  'https://example.supabase.co/auth/v1/otp?redirect_to=https%3A%2F%2Fapp.example'
);

assert.equal(
  proxy.buildTargetUrl('https://example.supabase.co/', '/api/supabase/rest/v1/projects?select=*'),
  'https://example.supabase.co/rest/v1/projects?select=*'
);

assert.equal(
  proxy.buildTargetUrl(
    'https://example.supabase.co',
    '/api/supabase?atlas_proxy_path=auth/v1/otp&path=auth/v1/otp&redirect_to=https%3A%2F%2Fapp.example'
  ),
  'https://example.supabase.co/auth/v1/otp?redirect_to=https%3A%2F%2Fapp.example'
);

const anonHeaders = proxy.buildProxyHeaders(
  {
    host: 'cc-atlas.vercel.app',
    connection: 'keep-alive',
    apikey: 'browser-key',
    authorization: 'Bearer browser-key',
    'content-type': 'application/json',
  },
  'server-publishable-key',
  'browser-key'
);

assert.equal(anonHeaders.get('host'), null);
assert.equal(anonHeaders.get('connection'), null);
assert.equal(anonHeaders.get('apikey'), 'server-publishable-key');
assert.equal(anonHeaders.get('authorization'), 'Bearer server-publishable-key');
assert.equal(anonHeaders.get('content-type'), 'application/json');

const userHeaders = proxy.buildProxyHeaders(
  {
    apikey: 'browser-key',
    authorization: 'Bearer user-access-token',
  },
  'server-publishable-key',
  'browser-key'
);

assert.equal(userHeaders.get('apikey'), 'server-publishable-key');
assert.equal(userHeaders.get('authorization'), 'Bearer user-access-token');

console.log('supabase proxy tests passed');
