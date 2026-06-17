const assert = require('node:assert/strict');

const vercelConfig = require('../vercel.json');
const health = require('../api/health/supabase.js');

assert.ok(
  vercelConfig.crons.some((cron) =>
    cron.path === '/api/health/supabase'
    && cron.schedule === '0 0 * * *'
  )
);

assert.equal(health.isAuthorized({ authorization: 'Bearer secret' }, { CRON_SECRET: 'secret' }), true);
assert.equal(health.isAuthorized({ authorization: 'Bearer wrong' }, { CRON_SECRET: 'secret' }), false);
assert.equal(health.isAuthorized({}, { CRON_SECRET: 'secret' }), false);
assert.equal(health.getProjectRef({ SUPABASE_PROJECT_REF: 'abc123' }), 'abc123');
assert.equal(health.getProjectRef({ SUPABASE_URL: 'https://abc123.supabase.co' }), 'abc123');

async function runInactiveProjectTest() {
  const calls = [];
  const result = await health.runSupabaseMaintenance({
    env: {
      SUPABASE_MANAGEMENT_TOKEN: 'mgmt-token',
      SUPABASE_PROJECT_REF: 'abc123',
      SUPABASE_URL: 'https://abc123.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, method: options.method || 'GET', headers: options.headers || {} });
      if (url === 'https://api.supabase.com/v1/projects/abc123') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'INACTIVE' }),
          text: async () => '{"status":"INACTIVE"}',
        };
      }
      if (url === 'https://api.supabase.com/v1/projects/abc123/restore') {
        return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
      }
      throw new Error(`unexpected fetch ${url}`);
    },
  });

  assert.equal(result.projectStatus, 'INACTIVE');
  assert.equal(result.restored, true);
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    'GET https://api.supabase.com/v1/projects/abc123',
    'POST https://api.supabase.com/v1/projects/abc123/restore',
  ]);
}

async function runHealthyProjectTest() {
  const calls = [];
  const result = await health.runSupabaseMaintenance({
    env: {
      SUPABASE_MANAGEMENT_TOKEN: 'mgmt-token',
      SUPABASE_PROJECT_REF: 'abc123',
      SUPABASE_URL: 'https://abc123.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, method: options.method || 'GET', headers: options.headers || {} });
      if (url === 'https://api.supabase.com/v1/projects/abc123') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ACTIVE_HEALTHY' }),
          text: async () => '{"status":"ACTIVE_HEALTHY"}',
        };
      }
      if (url === 'https://abc123.supabase.co/auth/v1/settings') {
        assert.equal(options.headers.apikey, 'publishable-key');
        return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
      }
      throw new Error(`unexpected fetch ${url}`);
    },
  });

  assert.equal(result.projectStatus, 'ACTIVE_HEALTHY');
  assert.equal(result.restored, false);
  assert.equal(result.pinged, true);
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    'GET https://api.supabase.com/v1/projects/abc123',
    'GET https://abc123.supabase.co/auth/v1/settings',
  ]);
}

Promise.all([
  runInactiveProjectTest(),
  runHealthyProjectTest(),
]).then(() => {
  console.log('supabase health tests passed');
});
