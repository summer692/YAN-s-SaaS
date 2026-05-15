# SaaS 指挥中心 — Web App 需求文档

> 这是一个个人使用的多项目管理 Web App，给独立开发者并行管理多个 SaaS 项目用。
> 核心目标：**无痛记录、好复盘、不遗漏，打开就愉悦**。

---

## 一、产品定位

### 使用场景
- 独立开发者，**同时并行做多个 SaaS 项目**，完成度各不相同
- 每个项目有独立的 API Key、域名、服务商、订阅成本
- 开发过程中**源源不断冒出新想法**，需要随时记录下来
- 要能**复盘总结**，但又不想花太多时间整理

### 核心痛点（要解决的）
1. 多项目信息分散在各处（API Key 在 .env、域名在邮箱、想法在便签）
2. 成本不清楚到底花了多少钱
3. 想法冒出来没地方放，过几天就忘了
4. 没有统一的地方查看每个项目当前进度

### 设计原则
- **无痛记录优先**：从想记录到记录完成，时间越短越好（≤10 秒）
- **好看让人愉悦**：打开 App 是种享受，不是负担
- **手机电脑都好用**：手机像原生 App，电脑全功能
- **数据本地优先**：API Key 这种敏感数据不上云

---

## 二、技术选型

### 栈
- **纯前端**：HTML + CSS + JavaScript（无框架，便于部署和维护）
  - 如果觉得有必要可以用 Alpine.js 或 Preact，但**不要用 React/Vue 这种重型框架**
- **本地存储**:优先用 `localStorage`，数据量大了再考虑 IndexedDB
- **PWA 支持**:Service Worker + manifest.json,支持离线访问和"添加到主屏幕"
- **图标库**：Tabler Icons（webfont 方式引入）或者用 SVG 内联

### 部署目标
- 本地双击 HTML 即可打开使用
- 也支持部署到 Vercel / Netlify / Cloudflare Pages
- 文件结构清晰，便于维护

### 文件结构建议
```
saas-command/
├── index.html          # 主入口
├── app.js              # 主逻辑
├── themes.css          # 6 套主题色
├── styles.css          # 基础样式
├── manifest.json       # PWA 配置
├── service-worker.js   # 离线支持
├── icons/              # PWA 图标
│   ├── icon-192.png
│   └── icon-512.png
└── README.md           # 部署说明
```

---

## 三、核心功能

### 3.1 项目管理（Projects）

#### 项目字段
| 字段 | 类型 | 说明 |
|------|------|------|
| 项目名称 | text | 必填 |
| 状态 | enum | 构思中 / 开发中 / 已上线 / 暂停 / 已下线 |
| 完成度 | 0-100 | 进度条显示 |
| 域名 | text | 可点击跳转 |
| 域名服务商 | text | 如 Namecheap、阿里云 |
| 域名年费 | number | 用于成本计算 |
| 域名到期日 | date | **用于续费提醒** |
| 技术栈 | text | 如 Next.js + Supabase |
| API Keys / 配置 | multiline text | 一行一条，格式 `服务名=密钥`，**自动遮罩显示** |
| 月度成本 | number | 服务器、订阅等 |
| 月度收入 | number | 可空 |
| 备注 / 下一步 | multiline text | 当前要做的事 |
| 创建时间 | timestamp | 自动 |

#### 交互
- 卡片列表展示，可按状态筛选
- 每个卡片底部有「让 Claude 给建议」按钮（如果在 Claude 内嵌环境用 sendPrompt；如果是独立 Web App，跳转到 claude.ai 并预填项目上下文）
- 点击编辑/删除
- **手机上左滑卡片显示删除按钮**

### 3.2 灵感速记（Ideas）

#### 字段
- 内容（多行文本，必填）
- 标签：新项目想法 / 功能改进 / 增长营销 / 技术想法 / 其他
- 优先级：低 / 中 / 高
- 创建时间

#### 交互
- **设计成最低摩擦**：打开输入框立刻 focus、3 个字就能存
- 按时间倒序展示
- 高优先级用颜色标注
- 灵感可以「转为项目」（一键填充到项目表单）

### 3.3 成本汇总（Costs）

#### 顶部指标卡
- 月度总成本
- 月度总收入
- 月度净利（绿色 / 红色）
- 域名年费总和

#### 表格
- 每个项目一行：名称 / 月成本 / 月收入 / 净值

#### 图表
- 6 个月成本趋势小图（如果数据足够）

### 3.4 复盘（Review）

#### 自动洞察
- **本周快照**：
  - 在开发的项目数
  - 可能卡住的项目数（开发中 & 完成度 <30%）
  - 快完成的项目数（开发中 & 完成度 ≥70%）
  - 高优灵感数

- **一键复盘**：把所有项目数据打包，跳转到 Claude（或调用 API）让 Claude 给建议
  - 本周复盘
  - 6 个月成本与决策预测
  - 哪些灵感值得动手

### 3.5 续费提醒（Renewal Alerts）

- 首页顶部横幅自动显示：
  - **7 天内到期**：红色高亮
  - **30 天内到期**：黄色提醒
- 包括域名、订阅服务
- 点击直接跳转到对应项目编辑

---

## 四、设计系统

### 4.1 主题色 — 6 套
顶部有调色盘按钮，一键切换，记住用户选择（存 localStorage）。

#### 白色（White）
```css
--bg-page: #ffffff
--bg-card: #fafafa
--border: #ececec
--text-primary: #111111
--text-secondary: #555555
--accent: #111111
--status-pill-bg: #f0f0f0
--status-pill-text: #555555
```
气质：纯净干净

#### 黑色（Black）— 暗色模式
```css
--bg-page: #0a0a0a
--bg-card: #171717
--border: #262626
--text-primary: #f5f5f5
--text-secondary: #a3a3a3
--accent: #f5f5f5
--status-pill-bg: #262626
--status-pill-text: #a3a3a3
```
气质：夜里护眼

#### 灰色（Gray）
```css
--bg-page: #f4f4f5
--bg-card: #ffffff
--border: #e4e4e7
--text-primary: #27272a
--text-secondary: #52525b
--accent: #52525b
--status-pill-bg: #e4e4e7
--status-pill-text: #52525b
```
气质：沉稳低调

#### 蓝色（Blue）
```css
--bg-page: #f0f7ff
--bg-card: #ffffff
--border: #dbeafe
--text-primary: #0c4a6e
--text-secondary: #1e40af
--accent: #2563eb
--status-pill-bg: #dbeafe
--status-pill-text: #1e40af
```
气质：冷静专注

#### 绿色（Green）
```css
--bg-page: #f0fdf4
--bg-card: #ffffff
--border: #dcfce7
--text-primary: #14532d
--text-secondary: #166534
--accent: #16a34a
--status-pill-bg: #dcfce7
--status-pill-text: #166534
```
气质：生机平静

#### 粉色（Pink）
```css
--bg-page: #fdf2f8
--bg-card: #ffffff
--border: #fce7f3
--text-primary: #831843
--text-secondary: #be185d
--accent: #ec4899
--status-pill-bg: #fce7f3
--status-pill-text: #be185d
```
气质：温柔愉悦

### 4.2 状态颜色（跨主题保持语义一致）
- 构思中：中性灰
- 开发中：当前主题强调色
- 已上线：绿色
- 暂停：黄色
- 已下线：红色

### 4.3 排版
- 字体：系统默认（`-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`）
- 标题 22px / 500
- 卡片标题 16px / 500
- 正文 14px / 400
- 辅助文字 12-13px / 400
- 行高 1.6
- **不要用大字重（700+），最大 500**

### 4.4 视觉细节
- 圆角：卡片 12px、按钮 8px、徽章 10px
- 边框：0.5px 实线（不是 1px，会显厚）
- **没有阴影**（除非是 focus 态的 ring）
- **没有渐变**（保持纯色克制）
- 卡片之间间距 12px
- 卡片内 padding 16px

---

## 五、交互细节

### 5.1 快捷键（电脑端）
| 键 | 功能 |
|----|------|
| `N` | 新建项目 |
| `I` | 记灵感（直接打开输入框并 focus） |
| `/` | 聚焦搜索框 |
| `1` `2` `3` `4` | 切换四个标签页 |
| `Esc` | 关闭打开的表单/模态框 |
| `Cmd/Ctrl + K` | 全局搜索（可选高级功能） |

### 5.2 手势（手机端）
- 卡片左滑显示删除按钮
- 下拉刷新（可选）

### 5.3 全局搜索
- 顶部搜索框
- 实时搜索：项目名、备注、灵感内容、标签
- 按相关度排序

### 5.4 PWA 体验
- 添加到主屏幕后全屏显示，无浏览器地址栏
- Service Worker 缓存所有静态资源，**离线也能打开**
- 离线状态下仍可读取/添加数据（写入本地，下次联网无需同步因为根本不上传）

### 5.5 数据导入导出
- 导出：JSON 文件下载，文件名含日期
- 导入：选择 JSON 文件覆盖/合并
- 用于换设备迁移

---

## 六、安全与隐私

### API Key 处理
- 默认遮罩显示：`OpenAI=sk-abcd••••wxyz`（前 4 后 4，中间用 ••• 替代）
- 卡片上有眼睛图标，点击切换完整显示/遮罩
- **永不上传服务器**，全部存 localStorage
- 提供「全部清空」按钮（带二次确认）

### 数据隔离
- 完全本地存储，无后端
- 用户可以一键导出，自己掌控数据

---

## 七、构建顺序建议

如果在 Claude Code 中实现，建议这个顺序：

1. **MVP（先跑起来）**
   - 基本 HTML 骨架
   - 一套主题色（先用白色）
   - 项目 CRUD
   - 灵感 CRUD
   - localStorage 读写

2. **完善核心功能**
   - 成本汇总页
   - 复盘页
   - 状态过滤、搜索

3. **加主题切换**
   - 6 套主题 CSS 变量
   - 主题切换按钮 + 持久化

4. **PWA 化**
   - manifest.json
   - service-worker.js
   - 图标

5. **打磨体验**
   - 快捷键
   - 手机左滑手势
   - 续费提醒
   - 动画过渡

6. **部署**
   - README 写部署说明
   - 推 GitHub
   - 部署到 Vercel/Cloudflare Pages

---

## 八、验收标准

完成后应该满足：

- [ ] 双击 index.html 能在浏览器直接运行
- [ ] 手机浏览器打开能「添加到主屏幕」，点开像原生 App
- [ ] 离线状态下能正常使用
- [ ] 6 套主题色都视觉舒适，切换流畅
- [ ] 项目、灵感、成本、复盘 4 个页面都正常工作
- [ ] API Key 默认遮罩显示
- [ ] 数据可导出 JSON、可导入恢复
- [ ] 30 天内到期的域名/订阅会在首页提示
- [ ] 电脑上按 N/I/数字键能快速操作
- [ ] 手机上左滑卡片能删除
- [ ] 「让 Claude 给建议」按钮能跳转到 claude.ai 并预填上下文（或用 sendPrompt 如果嵌入在 Claude 中）

---

## 九、未来可能的扩展（先不做）

- 多设备同步（需后端，可用 Supabase）
- 团队协作（多人共享项目）
- 集成 Stripe API 自动拉取收入数据
- 集成 GitHub API 显示代码提交活跃度
- AI 自动从邮件/Slack 中提取灵感
- 时间追踪（每个项目花了多少小时）

---

## 十、给 Claude Code 的开场白建议

把这个文件放到项目目录后，在 Claude Code 里这样说：

> "我要做一个个人使用的 SaaS 多项目管理 Web App。详细需求见 requirements.md。先帮我做 MVP：HTML 骨架 + 白色主题 + 项目管理 + 灵感记录 + localStorage 持久化。做完后我们再迭代加其他功能。文件就放在当前目录。"

这样 Claude Code 会先读文档，然后从最小可用版本开始，逐步添加功能。
