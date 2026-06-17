// Atlas — build-time config injector
// 把 Vercel 环境变量写入仓库根的 config.js,index.html 在 app.js 之前加载它,
// 这样 supabase URL/key 不出现在源码里,只在 Vercel 构建产物中。
// 本地没有环境变量时 (例如 fork 后 clone 下来),写入空值,App 进 localStorage-only 模式。

const fs = require('fs');
const path = require('path');

const PROXY_PATH = '/api/supabase';

function createAtlasConfig(env = process.env) {
  const url = env.SUPABASE_URL || '';
  const key = env.SUPABASE_PUBLISHABLE_KEY || '';
  const forceDirect = env.ATLAS_SUPABASE_DIRECT === '1' || env.ATLAS_SUPABASE_DIRECT === 'true';

  return {
    supabaseUrl: url && key && !forceDirect ? PROXY_PATH : url,
    supabaseKey: key,
  };
}

function renderConfigFile(config) {
  return `// 自动生成,不要手改。构建时由 scripts/build-config.js 从 Vercel 环境变量写入。
window.ATLAS_CONFIG = ${JSON.stringify(config, null, 2)};
`;
}

function writeConfig(env = process.env, out = path.resolve(__dirname, '..', 'config.js')) {
  const config = createAtlasConfig(env);
  fs.writeFileSync(out, renderConfigFile(config));

  const sourceUrl = env.SUPABASE_URL || '';
  const urlState = sourceUrl ? (config.supabaseUrl === PROXY_PATH ? 'proxied' : 'set') : 'empty';
  console.log(`[build-config] wrote ${out} · url:${urlState} · key:${config.supabaseKey ? 'set' : 'empty'}`);
}

if (require.main === module) {
  writeConfig();
}

module.exports = {
  createAtlasConfig,
  renderConfigFile,
  writeConfig,
};
