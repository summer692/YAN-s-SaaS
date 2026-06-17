const assert = require('node:assert/strict');

const buildConfig = require('../scripts/build-config.js');

assert.equal(typeof buildConfig.createAtlasConfig, 'function');
assert.equal(typeof buildConfig.renderConfigFile, 'function');

const emptyConfig = buildConfig.createAtlasConfig({});
assert.deepEqual(emptyConfig, {
  supabaseUrl: '',
  supabaseKey: '',
});

const proxiedConfig = buildConfig.createAtlasConfig({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
});

assert.deepEqual(proxiedConfig, {
  supabaseUrl: '/api/supabase',
  supabaseKey: 'publishable-key',
});

const directConfig = buildConfig.createAtlasConfig({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  ATLAS_SUPABASE_DIRECT: '1',
});

assert.deepEqual(directConfig, {
  supabaseUrl: 'https://example.supabase.co',
  supabaseKey: 'publishable-key',
});

const rendered = buildConfig.renderConfigFile(proxiedConfig);
assert.match(rendered, /window\.ATLAS_CONFIG/);
assert.match(rendered, /"supabaseUrl": "\/api\/supabase"/);

console.log('build-config proxy tests passed');
