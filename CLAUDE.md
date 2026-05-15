# Atlas — Claude 项目交接文档

> 给下一个接手这个项目的 Claude 看的。读完这一份再开工。

## 这是什么

**Atlas** 是一个**个人**用的 SaaS 多项目管理 Web App，用户名 summer692（YAN）。她是非开发者背景的独立开发者/使用者，**电脑基础有限**，不熟悉命令行/Git，所有改动都通过 Claude Code 推送，再让 Vercel 自动部署。

需求与设计原则的源头：`requirements.md`（项目根目录）。读那份文档是了解产品意图的最快路径。

## 用户偏好（重要）

- **简单胜过完美**：宁可 3 行相似代码也不要过度抽象
- **不要假设她会改代码**：每次改动我（Claude）必须自己负责到「合并到 main、推到 GitHub、Vercel 自动部署」整条链路，她只负责验收
- **不要单方面改方向**：如果她让我做一件事，我做完后**不要**顺手把别的「也优化一下」。多余的改动会让她困惑
- **解释成因**：她会问「为什么」。每次出现 bug 修复，简单说明根因有助于她建立心智模型
- **回答简明**：长篇大论会让她疲惫。表格 / bullet 比段落好

## 技术栈

- **纯前端**：HTML + CSS + JavaScript（IIFE 包装、无框架、**无构建步骤**、**无依赖**）
- **数据**：浏览器 `localStorage`，key = `saas-command:v1`
- **托管**：Vercel（连接 `summer692/YAN-s-SaaS` 仓库的 `main` 分支自动部署）
- **PWA**：manifest + service worker，可装到 iPhone 主屏幕

## 文件结构

```
.
├── index.html            主入口 + 内联启动画面 CSS
├── app.js                所有应用逻辑（IIFE 闭包）
├── styles.css            全局样式（Apple HIG 风格）
├── themes.css            6 套主题色 tokens
├── manifest.json         PWA 配置
├── service-worker.js     离线缓存 + 更新检测
├── icons/
│   ├── icon.svg                 主图标（C4 设计：蓝渐变 + 白圆 + 偏心白点）
│   ├── icon-maskable.svg        安卓自适应版本
│   ├── apple-touch-icon-*.png   iOS 标准尺寸 PNG（120/152/167/180）
│   ├── apple-touch-icon.png     兜底 180x180
│   └── icon-{a,b,c,c1-c4}.svg   历史候选方案（用户挑了 c4，其余留作参考）
├── icon-preview.html     图标方案对比预览页（用户挑图标时用过，保留可重用）
├── README.md             部署 / 使用说明
├── CLAUDE.md             本文件
└── requirements.md       原始需求文档
```

## 工作流（重要 — 严格遵守）

### 分支与 PR
- **开发分支固定为 `claude/mvp-project-manager-4ulyI`**（这是初始环境给的，不要换）
- 任何改动：
  1. 在 `claude/mvp-project-manager-4ulyI` 上 commit + push
  2. 用 `mcp__github__create_pull_request` 创建 PR 到 `main`
  3. 用 `mcp__github__merge_pull_request` 合并（不需要用户操作）
  4. Vercel 自动 detect main 分支变化并重新部署
- 这个用户**不会**自己点 Merge 按钮 —— Claude 必须主动用 MCP 工具合并

### 仓库范围
GitHub MCP 工具只允许操作 `summer692/yan-s-saas`。其他仓库的调用会被拒。

### Commit 信息
- 不要在 commit message / PR / 任何被推到仓库的内容里写出当前 Claude 模型 ID 或 marketing name

## CACHE_VERSION（最关键的操作纪律）

**每次推送代码到 main 之前，把 `service-worker.js` 顶部的 `CACHE_VERSION` 字符串数字 +1。**

```js
const CACHE_VERSION = 'atlas-v13';  // 下次改成 'atlas-v14'
```

**为什么必须做**：PWA 用户的 Service Worker 会检测 SW 文件本身是否变化才决定是否更新缓存。如果 CACHE_VERSION 字符串不变，浏览器不会发现「有新版本」，用户拿不到任何更新。

每次 PR 描述里也要写一句「CACHE_VERSION → atlas-vXX」让用户知道发生了什么。

## 已确定的设计决策（不要无端推翻）

| 项 | 当前选择 | 原因 |
|---|---|---|
| 应用名 | `Atlas` （副标题「项目地图」仅在 README，**不在 UI**） | 用户明确要求 splash 和 title 只显示 Atlas |
| 主图标 | C4 — 支付宝蓝渐变 (`#2A8AFF → #1677FF`) + 白色细圆 + 偏心白点 | 用户从 16+ 个候选里挑的 |
| Manifest 主色 | `#1677FF`（背景色 + theme color） | 跟图标一致，iOS 原生 splash 也是这个蓝 |
| 状态栏样式 | `apple-mobile-web-app-status-bar-style: default` | 之前用 `black-translucent` 导致白字看不见（浅色主题），换成 default 让 iOS 用 theme_color 渲染状态栏 |
| 视觉语言 | Apple HIG（17px 正文、SF Pro 字体栈、`cubic-bezier(0.25,0.46,0.45,0.94)` 缓动、10/14px 圆角、毛玻璃 header） | 用户专门花一轮调过，按 HIG 10 条规则做 |
| 域名 | `atlas.vercel.app`（或类似 Vercel 子域） | 不绑用户自有的 `yesletter.org`（那个域名留给她的 newsletter 产品） |
| 主题数 | 6 套（白/黑/灰/蓝/绿/粉），每套都按 iOS 系统色定 token | 一直保留 |

## 数据模型

存储 key: `saas-command:v1`

```js
{
  projects: [{
    id: string,
    name: string,
    status: '构思中'|'开发中'|'已上线'|'暂停'|'已下线',
    progress: number (0-100),
    domain: string,
    registrar: string,
    domainExpiry: 'YYYY-MM-DD',
    domainFee: number,                       // 首年费金额
    domainFeeCurrency: 'CNY'|'USD',
    domainRenewalFee: number | null,         // 续费金额（可选）
    domainRenewalFeeCurrency: 'CNY'|'USD',
    stack: string,
    apiKeys: string,        // 多行，"服务名=密钥" 格式
    monthlyCost: number,    // 一律 CNY
    monthlyRevenue: number, // 一律 CNY
    notes: string,
    createdAt: timestamp,
    updatedAt: timestamp,
  }],
  ideas: [{
    id: string,
    content: string,
    tag: '新项目想法'|'功能改进'|'增长营销'|'技术想法'|'其他',
    priority: '低'|'中'|'高',
    createdAt: timestamp,
  }]
}
```

加新字段时：
- 旧数据没有新字段 → load 时默认值兜底（不要数据迁移）
- 货币、状态等枚举：在 load 时校验并 fallback

## 常见任务速查

### 加一个新的项目字段
1. `index.html` 表单内加 `<label class="field">`
2. `app.js` 的 `projectForm.addEventListener('submit', ...)` 里把字段读进 project 对象
3. `app.js` 的 `renderProjectCard(p)` 里把字段渲染到卡片
4. 如有必要，更新 `buildSnapshot()` 让 Claude 复盘也能看到
5. CACHE_VERSION +1

### 加 / 改一个主题
1. `themes.css` 加一个 `[data-theme="名字"] { ... }` 块，按现有六套的 token 列表写齐
2. `index.html` 里 `header-menu-panel` 的 `.theme-swatches` 加一个 `<button class="theme-swatch-btn" data-theme="名字">...`
3. `app.js` 的 `VALID_THEMES` 数组加进去
4. `styles.css` 里 `.theme-swatch[data-theme="名字"]` 加颜色样本
5. CACHE_VERSION +1

### 改启动画面
- HTML：`index.html` 里 `<div id="splash">` 块
- CSS：同文件 `<head>` 里的 `<style>`（启动画面 CSS 是**内联**的，不能放外部 CSS 文件 —— 否则在 CSS 加载完之前会闪白屏）
- 关键不变量：splash 的背景色必须和 `manifest.background_color` + `meta theme-color` 完全一致，否则 iOS 原生启动 splash 到 JS splash 的过渡会闪一下

### 在桌面端预览
- 沙箱里 `python3 -m http.server 8000`，但用户用 Mac 自己电脑跑 —— 让她在终端里跑这个命令
- 或者：每次推完 main，让她刷新 Vercel 链接

### 生成新的 PNG 图标
沙箱里有 `cairosvg`（Python）。脚本范例见 PR #16 的 commit message。要点：
- 源 SVG 必须去掉 `rx="228"` 圆角矩形（PNG 必须直角，iOS 自己加圆角）
- iOS 必需尺寸：120 / 152 / 167 / 180 + 兜底 `apple-touch-icon.png`

## 部署链路

```
本地改 → git push 到 claude/mvp-project-manager-4ulyI
      → mcp__github__create_pull_request 到 main
      → mcp__github__merge_pull_request
      → Vercel webhook 触发自动部署（30 秒内）
      → 用户刷新 Vercel 链接 / PWA 收到「立即刷新」横幅
```

## 已知坑

1. **iOS PWA 装到主屏后图标缓存特别顽固**：用户改图标后必须长按图标 → 「移除 App」（数据保留）→ 重新「添加到主屏幕」。我能做的事是确保下次重装能正确生效。
2. **iOS standalone 模式不读 SVG `apple-touch-icon`，必须 PNG**：见 PR #16。
3. **Flex / Grid 子项默认 `min-width: auto`**：会让窄屏卡片被内容撑超 viewport（见 PR #7）。新增带按钮组的卡片记得加 `min-width: 0`、`flex-wrap: wrap`、grid 用 `minmax(0, 1fr)`。
4. **CSS `[hidden]` 会被 `display: flex` 覆盖**：所以全局加了 `[hidden] { display: none !important; }`（见 PR #4）。新增任何带 display 的元素都自动受益，不用担心。
5. **`save()` 函数不能被重新赋值（在严格模式里风险高）**：用户级别的存储操作直接调 `save()`，需要联动刷新衍生 UI 的地方在调用处显式调（如 `renderRenewals()`），不要用「monkey-patch save」的方案。

## 不要做的事

- 不要 commit / push 任何包含 API key / 密码 / Token 的内容
- 不要改 `requirements.md` —— 那是用户的源需求，不可变
- 不要把 PWA 的 `display` 改成 `fullscreen`（用户截图反馈过这会更糟）
- 不要拿 `yesletter.org` 给 Atlas 用 —— 那是用户的另一个项目
- 不要在 commit message / PR 内容里写出当前 Claude 模型版本字符串
