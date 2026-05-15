// Atlas — build-time config injector
// 把 Vercel 环境变量写入仓库根的 config.js,index.html 在 app.js 之前加载它,
// 这样 supabase URL/key 不出现在源码里,只在 Vercel 构建产物中。
// 本地没有环境变量时 (例如 fork 后 clone 下来),写入空值,App 进 localStorage-only 模式。

const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';

const content = `// 自动生成,不要手改。构建时由 scripts/build-config.js 从 Vercel 环境变量写入。
window.ATLAS_CONFIG = ${JSON.stringify({ supabaseUrl: url, supabaseKey: key }, null, 2)};
`;

const out = path.resolve(__dirname, '..', 'config.js');
fs.writeFileSync(out, content);
console.log(`[build-config] wrote ${out} · url:${url ? 'set' : 'empty'} · key:${key ? 'set' : 'empty'}`);
