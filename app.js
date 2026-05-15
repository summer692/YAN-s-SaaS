/* SaaS 指挥中心 — MVP
 * 范围：项目 CRUD、灵感 CRUD、localStorage 持久化、白色主题
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'saas-command:v1';
  const THEME_KEY = 'saas-command:theme';
  const VALID_THEMES = ['white', 'black', 'gray', 'blue', 'green', 'pink'];

  /** @type {{projects: Project[], ideas: Idea[]}} */
  let state = load();

  // ---------- Persistence ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { projects: [], ideas: [] };
      const parsed = JSON.parse(raw);
      return {
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
      };
    } catch {
      return { projects: [], ideas: [] };
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Tab switching ----------
  const tabs = document.querySelectorAll('.tab');
  const views = document.querySelectorAll('.view');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  function switchTab(name) {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    views.forEach((v) => v.classList.toggle('active', v.dataset.view === name));
    if (name === 'costs') renderCosts();
    if (name === 'review') renderReview();
  }

  // ---------- Search ----------
  const searchInput = document.getElementById('global-search');
  let searchTerm = '';
  searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value.trim().toLowerCase();
    renderProjects();
    renderIdeas();
  });
  function matchesSearch(...fields) {
    if (!searchTerm) return true;
    return fields.some((f) => f && String(f).toLowerCase().includes(searchTerm));
  }

  // ---------- Projects ----------
  const projectList = document.getElementById('project-list');
  const projectEmpty = document.getElementById('project-empty');
  const projectFilters = document.getElementById('project-filters');
  let currentFilter = 'all';

  projectFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    projectFilters.querySelectorAll('.chip').forEach((c) =>
      c.classList.toggle('active', c === btn)
    );
    renderProjects();
  });

  function renderProjects() {
    const filtered = state.projects.filter((p) => {
      const statusOk = currentFilter === 'all' || p.status === currentFilter;
      const searchOk = matchesSearch(p.name, p.notes, p.stack, p.domain, p.registrar);
      return statusOk && searchOk;
    });
    projectList.innerHTML = '';
    projectEmpty.hidden = filtered.length > 0;
    if (filtered.length === 0 && state.projects.length > 0) {
      projectEmpty.textContent = '没有匹配的项目。';
      projectEmpty.hidden = false;
    } else {
      projectEmpty.textContent = '还没有项目，点右上角「新建项目」开始记录。';
    }

    // 按创建时间倒序
    filtered
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .forEach((p) => projectList.appendChild(renderProjectCard(p)));
  }

  function renderProjectCard(p) {
    const card = document.createElement('article');
    card.className = 'card';

    // Head: title + status
    const head = document.createElement('header');
    head.className = 'card-head';
    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = p.name;
    const status = document.createElement('span');
    status.className = 'status-pill';
    status.dataset.status = p.status || '构思中';
    status.textContent = p.status || '构思中';
    head.append(title, status);
    card.append(head);

    // Progress
    const progress = document.createElement('div');
    progress.className = 'progress';
    const pct = clamp(Number(p.progress) || 0, 0, 100);
    progress.innerHTML = `
      <div class="progress-bar"><span style="width:${pct}%"></span></div>
      <span>${pct}%</span>
    `;
    card.append(progress);

    // Meta grid
    const meta = document.createElement('dl');
    meta.className = 'meta';
    const rows = [];
    if (p.domain) {
      const href = /^https?:\/\//i.test(p.domain) ? p.domain : `https://${p.domain}`;
      rows.push(['域名', `<a href="${escapeAttr(href)}" target="_blank" rel="noopener">${escapeHtml(p.domain)}</a>`]);
    }
    if (p.registrar) rows.push(['服务商', escapeHtml(p.registrar)]);
    if (p.domainExpiry) rows.push(['到期日', escapeHtml(p.domainExpiry)]);
    if (p.stack) rows.push(['技术栈', escapeHtml(p.stack)]);
    const cost = Number(p.monthlyCost) || 0;
    const rev = Number(p.monthlyRevenue) || 0;
    if (cost || rev) {
      rows.push(['月成本', `¥ ${cost.toFixed(2)}`]);
      rows.push(['月收入', `¥ ${rev.toFixed(2)}`]);
    }
    meta.innerHTML = rows
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
      .join('');
    if (rows.length) card.append(meta);

    // API keys (masked by default, eye to toggle)
    if (p.apiKeys && p.apiKeys.trim()) {
      const block = document.createElement('div');
      block.className = 'keys-block';
      const lines = p.apiKeys
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      let revealed = false;
      const header = document.createElement('div');
      header.className = 'keys-header';
      const label = document.createElement('span');
      label.className = 'keys-label';
      label.textContent = `API Keys (${lines.length})`;
      const eye = document.createElement('button');
      eye.type = 'button';
      eye.className = 'eye-btn';
      eye.title = '显示/隐藏完整密钥';
      eye.setAttribute('aria-label', '切换密钥显示');
      eye.textContent = '👁';
      const body = document.createElement('div');
      body.className = 'keys-body';
      const render = () => {
        body.innerHTML = lines.map((l) => renderKeyLine(l, revealed)).join('');
        eye.classList.toggle('on', revealed);
      };
      eye.addEventListener('click', (e) => {
        e.stopPropagation();
        revealed = !revealed;
        render();
      });
      render();
      header.append(label, eye);
      block.append(header, body);
      card.append(block);
    }

    // Notes
    if (p.notes && p.notes.trim()) {
      const notes = document.createElement('div');
      notes.className = 'notes';
      notes.textContent = p.notes;
      card.append(notes);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const askBtn = document.createElement('button');
    askBtn.className = 'accent';
    askBtn.textContent = '让 Claude 给建议';
    askBtn.addEventListener('click', () => askClaudeAboutProject(p));
    const editBtn = document.createElement('button');
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', () => openProjectModal(p));
    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = '删除';
    delBtn.addEventListener('click', () => deleteProject(p.id));
    actions.append(askBtn, editBtn, delBtn);
    card.append(actions);

    return card;
  }

  function askClaudeAboutProject(p) {
    const lines = [];
    lines.push(`# 项目: ${p.name}`);
    lines.push(`状态: ${p.status || '构思中'} · 完成度 ${p.progress || 0}%`);
    if (p.domain) lines.push(`域名: ${p.domain}${p.domainExpiry ? ` (到期 ${p.domainExpiry})` : ''}`);
    if (p.stack) lines.push(`技术栈: ${p.stack}`);
    const c = Number(p.monthlyCost) || 0;
    const r = Number(p.monthlyRevenue) || 0;
    if (c || r) lines.push(`月度: 成本 ¥${c.toFixed(2)} / 收入 ¥${r.toFixed(2)} / 净 ¥${(r - c).toFixed(2)}`);
    if (p.notes && p.notes.trim()) {
      lines.push('');
      lines.push('当前要做的事 / 备注:');
      lines.push(p.notes.trim());
    }
    lines.push('');
    lines.push('请基于以上信息给我几条具体可执行的建议：下一步该做什么？有没有可能被忽视的风险？');
    const text = lines.join('\n');

    if (typeof window.claude !== 'undefined' && typeof window.claude.sendPrompt === 'function') {
      window.claude.sendPrompt(text);
    } else {
      const url = `https://claude.ai/new?q=${encodeURIComponent(text)}`;
      window.open(url, '_blank', 'noopener');
    }
  }

  function renderKeyLine(line, revealed) {
    const eq = line.indexOf('=');
    if (eq === -1) {
      return `<div class="keys-line"><span class="keys-name">${escapeHtml(line)}</span></div>`;
    }
    const name = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    const shown = revealed ? value : maskKey(value);
    return `<div class="keys-line"><span class="keys-name">${escapeHtml(name)}=</span><span>${escapeHtml(shown)}</span></div>`;
  }

  function maskKey(v) {
    if (!v) return '';
    if (v.length <= 8) return '•'.repeat(v.length);
    return `${v.slice(0, 4)}••••${v.slice(-4)}`;
  }

  function deleteProject(id) {
    const p = state.projects.find((x) => x.id === id);
    if (!p) return;
    if (!confirm(`确定删除项目「${p.name}」？此操作不可恢复。`)) return;
    state.projects = state.projects.filter((x) => x.id !== id);
    save();
    renderProjects();
    renderRenewals();
  }

  // ---------- Project modal ----------
  const projectModal = document.getElementById('project-modal');
  const projectForm = document.getElementById('project-form');
  const projectModalTitle = document.getElementById('project-modal-title');
  const progressInput = projectForm.elements['progress'];
  const progressReadout = document.getElementById('progress-readout');

  progressInput.addEventListener('input', () => {
    progressReadout.textContent = `${progressInput.value}%`;
  });

  document.getElementById('btn-new-project').addEventListener('click', () => openProjectModal(null));
  projectModal.querySelectorAll('[data-close]').forEach((el) =>
    el.addEventListener('click', closeProjectModal)
  );

  function openProjectModal(p) {
    projectForm.reset();
    if (p) {
      projectModalTitle.textContent = '编辑项目';
      Object.entries(p).forEach(([k, v]) => {
        if (projectForm.elements[k] !== undefined) {
          projectForm.elements[k].value = v == null ? '' : v;
        }
      });
    } else {
      projectModalTitle.textContent = '新建项目';
      projectForm.elements['id'].value = '';
      projectForm.elements['status'].value = '构思中';
      projectForm.elements['progress'].value = '0';
    }
    progressReadout.textContent = `${projectForm.elements['progress'].value}%`;
    projectModal.hidden = false;
    setTimeout(() => projectForm.elements['name'].focus(), 0);
  }

  function closeProjectModal() {
    projectModal.hidden = true;
  }

  projectForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(projectForm);
    const data = Object.fromEntries(fd.entries());
    const id = data.id || uid();
    const existing = state.projects.find((x) => x.id === id);

    const project = {
      id,
      name: (data.name || '').trim(),
      status: data.status || '构思中',
      progress: clamp(Number(data.progress) || 0, 0, 100),
      domain: (data.domain || '').trim(),
      registrar: (data.registrar || '').trim(),
      domainFee: data.domainFee ? Number(data.domainFee) : null,
      domainExpiry: data.domainExpiry || '',
      stack: (data.stack || '').trim(),
      apiKeys: data.apiKeys || '',
      monthlyCost: data.monthlyCost ? Number(data.monthlyCost) : 0,
      monthlyRevenue: data.monthlyRevenue ? Number(data.monthlyRevenue) : 0,
      notes: data.notes || '',
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    if (!project.name) return;

    if (existing) {
      Object.assign(existing, project);
    } else {
      state.projects.push(project);
    }
    save();
    renderProjects();
    renderRenewals();
    closeProjectModal();
  });

  // ---------- Ideas ----------
  const ideaList = document.getElementById('idea-list');
  const ideaEmpty = document.getElementById('idea-empty');
  const ideaForm = document.getElementById('idea-quick-form');
  const ideaInput = document.getElementById('idea-quick-input');
  const ideaTag = document.getElementById('idea-quick-tag');
  const ideaPriority = document.getElementById('idea-quick-priority');

  ideaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = ideaInput.value.trim();
    if (!content) return;
    state.ideas.push({
      id: uid(),
      content,
      tag: ideaTag.value,
      priority: ideaPriority.value,
      createdAt: Date.now(),
    });
    save();
    ideaInput.value = '';
    ideaInput.focus();
    renderIdeas();
  });

  ideaInput.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      ideaForm.requestSubmit();
    }
  });

  function renderIdeas() {
    const filtered = state.ideas.filter((i) => matchesSearch(i.content, i.tag));
    ideaList.innerHTML = '';
    if (filtered.length === 0 && state.ideas.length > 0) {
      ideaEmpty.textContent = '没有匹配的灵感。';
      ideaEmpty.hidden = false;
    } else {
      ideaEmpty.textContent = '还没有灵感记录，先写一条试试。';
      ideaEmpty.hidden = filtered.length > 0;
    }
    filtered
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach((idea) => ideaList.appendChild(renderIdeaItem(idea)));
  }

  function renderIdeaItem(idea) {
    const el = document.createElement('article');
    el.className = 'idea';

    const content = document.createElement('div');
    content.className = 'idea-content';
    content.textContent = idea.content;

    const meta = document.createElement('div');
    meta.className = 'idea-meta';
    const tagPill = document.createElement('span');
    tagPill.className = 'pill';
    tagPill.textContent = idea.tag || '其他';
    const prioPill = document.createElement('span');
    prioPill.className = 'pill';
    prioPill.dataset.priority = idea.priority || '中';
    prioPill.textContent = `优先级 · ${idea.priority || '中'}`;
    const time = document.createElement('span');
    time.textContent = formatTime(idea.createdAt);

    const spacer = document.createElement('span');
    spacer.className = 'spacer';

    const actions = document.createElement('div');
    actions.className = 'idea-actions';
    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = '删除';
    del.addEventListener('click', () => deleteIdea(idea.id));
    actions.append(del);

    meta.append(tagPill, prioPill, time, spacer, actions);

    el.append(content, meta);
    return el;
  }

  function deleteIdea(id) {
    if (!confirm('删除这条灵感？')) return;
    state.ideas = state.ideas.filter((x) => x.id !== id);
    save();
    renderIdeas();
  }

  // ---------- Utilities ----------
  function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }
  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const pad = (n) => String(n).padStart(2, '0');
    if (sameDay) return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ---------- Costs ----------
  const costMetrics = document.getElementById('cost-metrics');
  const costTableBody = document.querySelector('#cost-table tbody');
  const costEmpty = document.getElementById('cost-empty');
  const costTableWrap = document.querySelector('#costs .table-wrap');

  function renderCosts() {
    const projects = state.projects;
    const totalCost = sum(projects.map((p) => Number(p.monthlyCost) || 0));
    const totalRev = sum(projects.map((p) => Number(p.monthlyRevenue) || 0));
    const net = totalRev - totalCost;
    const yearlyDomain = sum(projects.map((p) => Number(p.domainFee) || 0));

    costMetrics.innerHTML = [
      metricCard('月度总成本', `¥ ${totalCost.toFixed(2)}`),
      metricCard('月度总收入', `¥ ${totalRev.toFixed(2)}`),
      metricCard('月度净利', `${net >= 0 ? '+' : '-'} ¥ ${Math.abs(net).toFixed(2)}`, net >= 0 ? 'positive' : 'negative'),
      metricCard('域名年费总和', `¥ ${yearlyDomain.toFixed(2)}`),
    ].join('');

    costEmpty.hidden = projects.length > 0;
    costTableWrap.hidden = projects.length === 0;

    costTableBody.innerHTML = projects
      .slice()
      .sort((a, b) => (Number(b.monthlyCost) || 0) - (Number(a.monthlyCost) || 0))
      .map((p) => {
        const c = Number(p.monthlyCost) || 0;
        const r = Number(p.monthlyRevenue) || 0;
        const n = r - c;
        const cls = n > 0 ? 'positive' : n < 0 ? 'negative' : '';
        return `<tr>
          <td>${escapeHtml(p.name)}</td>
          <td><span class="status-pill" data-status="${escapeAttr(p.status || '构思中')}">${escapeHtml(p.status || '构思中')}</span></td>
          <td class="num">¥ ${c.toFixed(2)}</td>
          <td class="num">¥ ${r.toFixed(2)}</td>
          <td class="num ${cls}">${n >= 0 ? '+' : '-'} ¥ ${Math.abs(n).toFixed(2)}</td>
        </tr>`;
      })
      .join('');
  }

  function metricCard(label, value, cls) {
    return `<div class="metric">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value ${cls || ''}">${escapeHtml(value)}</div>
    </div>`;
  }

  function sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
  }

  // ---------- Review ----------
  const reviewMetrics = document.getElementById('review-metrics');
  const snapshotText = document.getElementById('snapshot-text');
  const btnAskClaude = document.getElementById('btn-ask-claude');
  const btnCopySnapshot = document.getElementById('btn-copy-snapshot');

  function renderReview() {
    const projects = state.projects;
    const ideas = state.ideas;

    const developing = projects.filter((p) => p.status === '开发中');
    const stuck = developing.filter((p) => (Number(p.progress) || 0) < 30);
    const almostDone = developing.filter((p) => (Number(p.progress) || 0) >= 70);
    const highPriorityIdeas = ideas.filter((i) => i.priority === '高');

    reviewMetrics.innerHTML = [
      metricCard('开发中', String(developing.length)),
      metricCard('可能卡住', String(stuck.length)),
      metricCard('快完成', String(almostDone.length)),
      metricCard('高优灵感', String(highPriorityIdeas.length)),
    ].join('');

    snapshotText.textContent = buildSnapshot();
  }

  function buildSnapshot() {
    const projects = state.projects;
    const ideas = state.ideas;
    const lines = [];
    lines.push('# 我的 SaaS 项目快照');
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');
    lines.push(`## 项目（共 ${projects.length} 个）`);
    if (projects.length === 0) lines.push('（暂无）');
    projects.forEach((p, idx) => {
      lines.push('');
      lines.push(`### ${idx + 1}. ${p.name}`);
      lines.push(`- 状态: ${p.status || '构思中'} · 完成度 ${p.progress || 0}%`);
      if (p.domain) lines.push(`- 域名: ${p.domain}${p.domainExpiry ? ` (到期 ${p.domainExpiry})` : ''}`);
      if (p.stack) lines.push(`- 技术栈: ${p.stack}`);
      const c = Number(p.monthlyCost) || 0;
      const r = Number(p.monthlyRevenue) || 0;
      if (c || r) lines.push(`- 月度: 成本 ¥${c.toFixed(2)} / 收入 ¥${r.toFixed(2)} / 净 ¥${(r - c).toFixed(2)}`);
      if (p.notes && p.notes.trim()) lines.push(`- 备注/下一步: ${p.notes.trim().replace(/\n+/g, ' / ')}`);
    });
    lines.push('');
    lines.push(`## 灵感（共 ${ideas.length} 条）`);
    if (ideas.length === 0) lines.push('（暂无）');
    ideas
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30)
      .forEach((i) => {
        lines.push(`- [${i.priority || '中'}·${i.tag || '其他'}] ${i.content.replace(/\n+/g, ' / ')}`);
      });
    lines.push('');
    lines.push('---');
    lines.push('请帮我做这几件事：');
    lines.push('1. 本周复盘 — 当前重点应该放在哪个项目？');
    lines.push('2. 6 个月成本与决策预测 — 哪些项目值得继续投入？');
    lines.push('3. 哪些灵感值得立刻动手？');
    return lines.join('\n');
  }

  btnAskClaude.addEventListener('click', () => {
    const text = buildSnapshot();
    const url = `https://claude.ai/new?q=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener');
  });

  btnCopySnapshot.addEventListener('click', async () => {
    const text = buildSnapshot();
    try {
      await navigator.clipboard.writeText(text);
      btnCopySnapshot.textContent = '已复制 ✓';
      setTimeout(() => (btnCopySnapshot.textContent = '复制快照文本'), 1500);
    } catch {
      alert('复制失败，请手动选中下方文本复制。');
    }
  });

  // ---------- Renewal alerts ----------
  const renewalsEl = document.getElementById('renewals');

  function renderRenewals() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const items = [];
    state.projects.forEach((p) => {
      if (!p.domainExpiry) return;
      const expiry = new Date(p.domainExpiry);
      if (isNaN(expiry)) return;
      const days = Math.floor((expiry - today) / 86400000);
      if (days > 30) return;
      const level = days <= 7 ? 'red' : 'yellow';
      let detail;
      if (days < 0) detail = `已过期 ${-days} 天`;
      else if (days === 0) detail = '今天到期';
      else detail = `${days} 天后到期`;
      items.push({ project: p, days, level, detail });
    });

    if (items.length === 0) {
      renewalsEl.hidden = true;
      renewalsEl.innerHTML = '';
      return;
    }

    items.sort((a, b) => a.days - b.days);
    renewalsEl.hidden = false;
    renewalsEl.innerHTML = items
      .map(
        (it) => `<div class="renewal" data-level="${it.level}" data-project-id="${escapeAttr(it.project.id)}">
          <span class="renewal-name">${escapeHtml(it.project.name)}</span>
          <span class="renewal-detail">${escapeHtml(it.project.domain || '域名')} · ${escapeHtml(it.detail)}${it.project.domainExpiry ? ` (${escapeHtml(it.project.domainExpiry)})` : ''}</span>
        </div>`
      )
      .join('');

    renewalsEl.querySelectorAll('.renewal').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.projectId;
        const p = state.projects.find((x) => x.id === id);
        if (p) {
          switchTab('projects');
          openProjectModal(p);
        }
      });
    });
  }

  // ---------- Theme ----------
  const themeToggle = document.getElementById('theme-toggle');
  const themeMenu = document.getElementById('theme-menu');

  function applyTheme(name) {
    const theme = VALID_THEMES.includes(name) ? name : 'white';
    document.body.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    themeMenu.querySelectorAll('.theme-option').forEach((b) =>
      b.classList.toggle('active', b.dataset.theme === theme)
    );
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      const bg = getComputedStyle(document.body).getPropertyValue('--bg-page').trim();
      if (bg) metaTheme.setAttribute('content', bg);
    }
  }

  themeToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    themeMenu.hidden = !themeMenu.hidden;
    settingsMenu.hidden = true;
  });
  themeMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-option');
    if (!btn) return;
    applyTheme(btn.dataset.theme);
    themeMenu.hidden = true;
  });

  applyTheme(localStorage.getItem(THEME_KEY) || 'white');

  // ---------- Settings menu (export / import / clear) ----------
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsMenu = document.getElementById('settings-menu');
  const importFile = document.getElementById('import-file');

  settingsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsMenu.hidden = !settingsMenu.hidden;
    themeMenu.hidden = true;
  });

  settingsMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    settingsMenu.hidden = true;
    if (btn.dataset.action === 'export') exportData();
    if (btn.dataset.action === 'import') importFile.click();
    if (btn.dataset.action === 'clear') clearAll();
  });

  importFile.addEventListener('change', async () => {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') throw new Error('格式不对');
      const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
      const ideas = Array.isArray(parsed.ideas) ? parsed.ideas : [];
      const mode = confirm(
        `发现 ${projects.length} 个项目、${ideas.length} 条灵感。\n\n确定 = 合并到现有数据\n取消 = 完全覆盖`
      );
      if (mode) {
        state.projects = mergeById(state.projects, projects);
        state.ideas = mergeById(state.ideas, ideas);
      } else {
        if (!confirm('确认用导入的数据覆盖当前所有数据？此操作不可恢复。')) {
          importFile.value = '';
          return;
        }
        state.projects = projects;
        state.ideas = ideas;
      }
      save();
      renderProjects();
      renderIdeas();
      renderRenewals();
      alert('导入成功。');
    } catch (err) {
      alert(`导入失败：${err.message || err}`);
    } finally {
      importFile.value = '';
    }
  });

  function mergeById(existing, incoming) {
    const map = new Map(existing.map((x) => [x.id, x]));
    incoming.forEach((x) => {
      if (x && x.id) map.set(x.id, x);
    });
    return Array.from(map.values());
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    a.href = url;
    a.download = `saas-command-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clearAll() {
    if (!confirm('确定清空所有项目和灵感？此操作不可恢复。建议先「导出 JSON」备份。')) return;
    if (!confirm('再次确认：真的全部清空？')) return;
    state.projects = [];
    state.ideas = [];
    save();
    renderProjects();
    renderIdeas();
    renderRenewals();
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#theme-picker')) themeMenu.hidden = true;
    if (!e.target.closest('#settings')) settingsMenu.hidden = true;
  });

  // ---------- Global keys ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!projectModal.hidden) closeProjectModal();
      themeMenu.hidden = true;
      settingsMenu.hidden = true;
      return;
    }

    // 输入框内不触发字母快捷键
    const active = document.activeElement;
    const inField =
      active &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === '/') {
      if (inField) return;
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }

    if (inField) return;

    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      switchTab('projects');
      openProjectModal(null);
    } else if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      switchTab('ideas');
      ideaInput.focus();
    } else if (e.key === '1') {
      e.preventDefault();
      switchTab('projects');
    } else if (e.key === '2') {
      e.preventDefault();
      switchTab('ideas');
    } else if (e.key === '3') {
      e.preventDefault();
      switchTab('costs');
    } else if (e.key === '4') {
      e.preventDefault();
      switchTab('review');
    }
  });

  // ---------- Init ----------
  renderProjects();
  renderIdeas();
  renderRenewals();

  // ---------- Service Worker ----------
  // 仅在 http/https 下注册，file:// 双击场景跳过。
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
})();
