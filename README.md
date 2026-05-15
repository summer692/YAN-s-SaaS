# SaaS 指挥中心

个人多 SaaS 项目管理 Web App — 项目、灵感、成本、复盘一站式，纯前端 + localStorage，无后端。

## 特性

- **项目管理** — 状态、完成度、域名/服务商/到期日、技术栈、API Keys（自动遮罩）、月成本/月收入、备注
- **灵感速记** — 打开就 focus，3 个字就能存，`Ctrl/Cmd + Enter` 保存
- **成本汇总** — 月度总成本/收入/净利/年费 4 张指标卡 + 项目明细表
- **复盘** — 本周快照 + 「让 Claude 复盘」一键跳转 claude.ai 预填上下文
- **续费提醒** — 顶部横幅自动显示 30 天内到期的域名，≤7 天红色高亮
- **6 套主题** — 白/黑/灰/蓝/绿/粉，一键切换，记住选择
- **数据导入导出** — JSON 文件，换设备无痛迁移
- **PWA** — 可添加到主屏幕，离线可用
- **快捷键 / 手势** — 电脑端 N/I// /1-4 快捷操作，手机端左滑卡片删除

## 文件结构

```
.
├── index.html          主入口
├── app.js              主逻辑
├── styles.css          基础样式
├── themes.css          6 套主题色变量
├── manifest.json       PWA 配置
├── service-worker.js   离线缓存
├── icons/              PWA 图标
│   ├── icon.svg
│   └── icon-maskable.svg
└── requirements.md     需求文档
```

## 本地使用

直接双击 `index.html` 在浏览器打开即可。所有数据存浏览器 `localStorage`，不会上传任何服务器。

> 注意：本地双击（`file://` 协议）下 Service Worker 不会注册，PWA「添加到主屏幕」也不可用。要完整体验请部署或起本地服务器。

### 起本地静态服务器（可选）

```bash
# Python 3
python3 -m http.server 8000

# Node
npx serve .
```

然后访问 `http://localhost:8000`。

## 部署

零构建，任何静态托管平台都能直接发：

- **Vercel** — `vercel deploy` 或在 dashboard 拖目录
- **Netlify** — `netlify deploy --prod` 或拖目录
- **Cloudflare Pages** — 连接 GitHub 仓库，构建命令留空、输出目录设为根目录
- **GitHub Pages** — 推到 `gh-pages` 分支或仓库 Settings → Pages

## 快捷键

| 键 | 功能 |
|----|------|
| `N` | 新建项目 |
| `I` | 切到灵感页并 focus 输入框 |
| `/` | focus 搜索框 |
| `1` `2` `3` `4` | 切换 4 个 tab |
| `Esc` | 关闭弹窗 / 菜单 |
| `Ctrl/Cmd + Enter` | 灵感输入框内保存 |

## 手机端

- 浏览器打开后选「添加到主屏幕」，下次打开像原生 App，无地址栏
- 项目卡片、灵感条目向左滑可显示删除按钮

## 数据与隐私

- **全部本地存储**，浏览器 `localStorage`，key 为 `saas-command:v1`
- API Key 默认遮罩显示（前 4 后 4，中间 `••••`），每张卡片可独立切换显示
- 「⋯」菜单提供「导出 JSON」「导入 JSON」「全部清空」
- 清除浏览器数据会丢失，记得定期导出备份

## 开发

无构建步骤、无依赖。直接改源文件刷新即可。

- 添加状态/标签/优先级：改 `index.html` 里的 `<select>` 选项
- 调整主题：改 `themes.css` 里对应 `[data-theme="..."]` 块
- 新功能：所有逻辑集中在 `app.js`，按功能分区注释
