# Atlas · 项目地图

> 俯瞰你正在并行做的所有 SaaS 项目。

个人使用的多项目管理 Web App — 项目、灵感、成本、复盘一站式。纯前端 + localStorage，无后端，无账户，数据本地优先。

## 特性

- **项目管理** — 状态、完成度、域名/服务商/到期日、技术栈、API Keys（自动遮罩 + 眼睛切换）、月成本/月收入、备注
- **域名费多币种** — 首年费 + 续费分开记录，每个字段可独立选 ¥ / $
- **灵感速记** — 打开就 focus，`Ctrl/Cmd + Enter` 保存
- **成本汇总** — 月度总成本/收入/净利 + 域名年费按币种分别汇总
- **复盘** — 本周快照 + 「让 Claude 复盘」一键跳 claude.ai 预填上下文
- **续费提醒** — 顶部横幅自动显示 30 天内到期的域名，≤7 天红色高亮
- **6 套 iOS 主题** — 白/黑/灰/蓝/绿/粉，按 Apple HIG 系统色
- **数据导入导出** — JSON 文件，换设备无痛迁移
- **PWA** — 可装到主屏幕，启动画面、离线可用、自动检测新版本提示刷新
- **快捷键 / 手势** — 电脑 `N`/`I`/`/`/`1-4`，手机左滑卡片删除

## 文件结构

```
.
├── index.html          主入口
├── app.js              主逻辑
├── styles.css          基础样式（Apple HIG）
├── themes.css          6 套主题色变量
├── manifest.json       PWA 配置
├── service-worker.js   离线缓存 + 自动更新
├── icons/
│   ├── icon.svg            主图标
│   ├── icon-maskable.svg   安卓自适应版本
│   ├── icon-a.svg          备选方案 A · 指南针
│   ├── icon-b.svg          备选方案 B · A 字 + 地平线
│   └── icon-c.svg          备选方案 C · 等高线
├── icon-preview.html   图标方案预览页
└── requirements.md     需求文档
```

## 本地使用

直接双击 `index.html` 在浏览器打开。所有数据存浏览器 `localStorage`。

> 双击（`file://`）下 Service Worker 不能注册，PWA「添加到主屏幕」不可用。要完整体验请部署。

## 部署

零构建，任何静态托管都能直接发：

- **Vercel** — 连接 GitHub 仓库，Framework Preset 选 `Other`，其他全留空
- **Netlify** — 同上
- **Cloudflare Pages** — 同上
- **GitHub Pages** — 推到 main，Settings → Pages → Deploy from a branch

## 快捷键

| 键 | 功能 |
|---|---|
| `N` | 新建项目 |
| `I` | 切到灵感页并 focus 输入框 |
| `/` | focus 搜索框 |
| `1` `2` `3` `4` | 切换 4 个 tab |
| `Esc` | 关闭弹窗 / 菜单 |
| `Ctrl/Cmd + Enter` | 灵感输入框内保存 |

## 手机端

- Safari/Chrome 打开后「添加到主屏幕」，启动画面 + 全屏无地址栏
- 项目卡片、灵感条目向左滑显示删除按钮
- 主屏图标下显示「Atlas」

## 数据与隐私

- **全部本地存储**，浏览器 `localStorage`，key `saas-command:v1`
- API Key 默认遮罩显示（前 4 后 4，中间 `••••`），每张卡片独立切换
- 「⋯」菜单：导出 JSON / 导入 JSON / 全部清空
- 清浏览器数据会丢失，定期导出备份

## 开发

无构建步骤、无依赖。改源文件刷新即可。每次推送时把 `service-worker.js` 顶部的 `CACHE_VERSION` +1，PWA 用户才会收到更新提示。
