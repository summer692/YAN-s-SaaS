const MANAGEMENT_API_BASE = 'https://api.supabase.com/v1';
const RESTORE_STATUSES = new Set(['INACTIVE']);

function isAuthorized(headers = {}, env = process.env) {
  const secret = env.CRON_SECRET || '';
  if (!secret) return false;
  const auth = headers.authorization || headers.Authorization || '';
  return auth === `Bearer ${secret}`;
}

function getProjectRef(env = process.env) {
  if (env.SUPABASE_PROJECT_REF) return env.SUPABASE_PROJECT_REF;
  const url = env.SUPABASE_URL || '';
  const match = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  return match ? match[1] : '';
}

async function readResponseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function fetchJson(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  const body = await readResponseJson(response);
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${url} failed with ${response.status}: ${body.message || JSON.stringify(body)}`);
  }
  return body;
}

async function runSupabaseMaintenance({ env = process.env, fetchImpl = fetch } = {}) {
  const token = env.SUPABASE_MANAGEMENT_TOKEN || '';
  const projectRef = getProjectRef(env);
  if (!token) throw new Error('SUPABASE_MANAGEMENT_TOKEN is not configured');
  if (!projectRef) throw new Error('SUPABASE_PROJECT_REF is not configured');

  const authHeaders = { Authorization: `Bearer ${token}` };
  const project = await fetchJson(fetchImpl, `${MANAGEMENT_API_BASE}/projects/${projectRef}`, {
    method: 'GET',
    headers: authHeaders,
  });

  const projectStatus = project.status || 'UNKNOWN';
  let restored = false;
  let pinged = false;
  let pingStatus = null;

  if (RESTORE_STATUSES.has(projectStatus)) {
    await fetchJson(fetchImpl, `${MANAGEMENT_API_BASE}/projects/${projectRef}/restore`, {
      method: 'POST',
      headers: authHeaders,
    });
    restored = true;
  } else if (env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY) {
    const pingResponse = await fetchImpl(`${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      },
    });
    pinged = true;
    pingStatus = pingResponse.status;
    if (!pingResponse.ok) {
      const body = await readResponseJson(pingResponse);
      throw new Error(`Supabase project ping failed with ${pingResponse.status}: ${body.message || JSON.stringify(body)}`);
    }
  }

  return {
    ok: true,
    projectRef,
    projectStatus,
    restored,
    pinged,
    pingStatus,
  };
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function handler(req, res) {
  if (!isAuthorized(req.headers, process.env)) {
    sendJson(res, 401, { ok: false, message: 'Unauthorized' });
    return;
  }

  try {
    const result = await runSupabaseMaintenance();
    console.log('[atlas supabase health]', result);
    sendJson(res, 200, result);
  } catch (error) {
    console.error('[atlas supabase health] failed', error);
    sendJson(res, 500, {
      ok: false,
      message: error && error.message ? error.message : String(error),
    });
  }
}

module.exports = handler;
module.exports.getProjectRef = getProjectRef;
module.exports.isAuthorized = isAuthorized;
module.exports.runSupabaseMaintenance = runSupabaseMaintenance;
