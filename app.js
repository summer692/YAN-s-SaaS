/* Atlas · 项目地图 — App 逻辑
 * 范围：项目 CRUD、灵感 CRUD、localStorage 持久化、白色主题
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'saas-command:v1';
  const THEME_KEY = 'saas-command:theme';
  const LAST_EMAIL_KEY = 'atlas:last-email';  // 登录时帮用户记住邮箱
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
    // 优先用 UUID (Supabase 主键格式),老浏览器降级
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // ---------- 云端存储 (Supabase) ----------
  // currentUserId 由登录流程设置 (见文件末尾的 enterCloudMode)。
  // 未登录或没接云端时为 null,所有 persist/remove 自动降级到 localStorage。
  let currentUserId = null;

  function projectToRow(p, userId) {
    return {
      id: UUID_RE.test(p.id) ? p.id : undefined,
      user_id: userId,
      name: p.name,
      status: p.status || '构思中',
      progress: Number(p.progress) || 0,
      domain: p.domain || '',
      registrar: p.registrar || '',
      domain_expiry: p.domainExpiry || null,
      domain_fee: p.domainFee ?? null,
      domain_fee_currency: p.domainFeeCurrency || 'CNY',
      domain_renewal_fee: p.domainRenewalFee ?? null,
      domain_renewal_fee_currency: p.domainRenewalFeeCurrency || 'CNY',
      stack: p.stack || '',
      api_keys_cipher: p.apiKeys || '',  // Phase 3 加 PIN 加密;现在是明文,RLS 保证只有自己能读
      monthly_cost: Number(p.monthlyCost) || 0,
      monthly_revenue: Number(p.monthlyRevenue) || 0,
      notes: p.notes || '',
    };
  }
  function rowToProject(r) {
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      progress: r.progress,
      domain: r.domain || '',
      registrar: r.registrar || '',
      domainExpiry: r.domain_expiry || '',
      domainFee: r.domain_fee != null ? Number(r.domain_fee) : null,
      domainFeeCurrency: r.domain_fee_currency || 'CNY',
      domainRenewalFee: r.domain_renewal_fee != null ? Number(r.domain_renewal_fee) : null,
      domainRenewalFeeCurrency: r.domain_renewal_fee_currency || 'CNY',
      stack: r.stack || '',
      apiKeys: r.api_keys_cipher || '',
      monthlyCost: Number(r.monthly_cost) || 0,
      monthlyRevenue: Number(r.monthly_revenue) || 0,
      notes: r.notes || '',
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    };
  }
  function ideaToRow(i, userId) {
    return {
      id: UUID_RE.test(i.id) ? i.id : undefined,
      user_id: userId,
      content: i.content,
      tag: i.tag || '其他',
      priority: i.priority || '中',
    };
  }
  function rowToIdea(r) {
    return {
      id: r.id,
      content: r.content,
      tag: r.tag || '其他',
      priority: r.priority || '中',
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    };
  }

  async function cloudLoadAll(userId) {
    const [pRes, iRes] = await Promise.all([
      cloud.from('projects').select('*').eq('user_id', userId),
      cloud.from('ideas').select('*').eq('user_id', userId),
    ]);
    if (pRes.error) throw new Error('加载项目失败: ' + pRes.error.message);
    if (iRes.error) throw new Error('加载灵感失败: ' + iRes.error.message);
    return {
      projects: (pRes.data || []).map(rowToProject),
      ideas: (iRes.data || []).map(rowToIdea),
    };
  }

  function cloudError(label, error) {
    console.error(label, error);
    alert(`${label}:${error.message || error}`);
  }

  async function persistProject(p) {
    if (!currentUserId) { save(); return; }
    const row = projectToRow(p, currentUserId);
    const { data, error } = await cloud.from('projects').upsert(row).select().single();
    if (error) { cloudError('保存项目失败', error); return; }
    const updated = rowToProject(data);
    const idx = state.projects.findIndex((x) => x.id === p.id || x.id === updated.id);
    if (idx >= 0) state.projects[idx] = updated;
    else state.projects.push(updated);
  }
  async function removeProjectRemote(id) {
    if (!currentUserId) { save(); return; }
    const { error } = await cloud.from('projects').delete().eq('id', id);
    if (error) cloudError('删除项目失败', error);
  }
  async function persistIdea(i) {
    if (!currentUserId) { save(); return; }
    const row = ideaToRow(i, currentUserId);
    const { data, error } = await cloud.from('ideas').upsert(row).select().single();
    if (error) { cloudError('保存灵感失败', error); return; }
    const updated = rowToIdea(data);
    const idx = state.ideas.findIndex((x) => x.id === i.id || x.id === updated.id);
    if (idx >= 0) state.ideas[idx] = updated;
    else state.ideas.push(updated);
  }
  async function removeIdeaRemote(id) {
    if (!currentUserId) { save(); return; }
    const { error } = await cloud.from('ideas').delete().eq('id', id);
    if (error) cloudError('删除灵感失败', error);
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
      .forEach((p) => projectList.appendChild(wrapSwipeable(renderProjectCard(p), () => deleteProject(p.id))));
  }

  // ---------- Swipe-to-delete (mobile) ----------
  function wrapSwipeable(card, onDelete) {
    const wrap = document.createElement('div');
    wrap.className = 'swipe-wrap';
    const action = document.createElement('div');
    action.className = 'swipe-action';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swipe-delete';
    btn.textContent = '删除';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete();
    });
    action.append(btn);
    wrap.append(action, card);
    attachSwipe(card);
    return wrap;
  }

  function attachSwipe(card) {
    let startX = 0, startY = 0, dx = 0, locked = null, revealed = false;
    const REVEAL_WIDTH = 88;
    const THRESHOLD = 44;
    const setX = (x) => { card.style.transform = `translateX(${x}px)`; };

    card.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0;
      locked = null;
      card.style.transition = 'none';
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1 || locked === 'y') return;
      const ddx = e.touches[0].clientX - startX;
      const ddy = e.touches[0].clientY - startY;
      if (locked === null) {
        if (Math.abs(ddx) < 6 && Math.abs(ddy) < 6) return;
        locked = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y';
        if (locked === 'y') return;
      }
      e.preventDefault();
      const base = revealed ? -REVEAL_WIDTH : 0;
      dx = clamp(base + ddx, -REVEAL_WIDTH - 30, 20);
      setX(dx);
    }, { passive: false });

    const finish = () => {
      if (locked !== 'x') return;
      card.style.transition = 'transform 0.2s ease-out';
      if (dx < -THRESHOLD) {
        revealed = true;
        setX(-REVEAL_WIDTH);
      } else {
        revealed = false;
        setX(0);
      }
    };
    card.addEventListener('touchend', finish);
    card.addEventListener('touchcancel', finish);
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
    const feeText = formatDomainFee(p);
    if (feeText) rows.push(['域名年费', feeText]);
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

    // Footer: 创建时间
    if (p.createdAt) {
      const footer = document.createElement('div');
      footer.className = 'card-footer';
      footer.textContent = `创建于 ${formatDate(p.createdAt)}`;
      card.append(footer);
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
    renderProjects();
    renderRenewals();
    removeProjectRemote(id);  // 后端真删,失败时控制台会报但不阻塞 UI
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

  projectForm.addEventListener('submit', async (e) => {
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
      domainFeeCurrency: data.domainFeeCurrency === 'USD' ? 'USD' : 'CNY',
      domainRenewalFee: data.domainRenewalFee ? Number(data.domainRenewalFee) : null,
      domainRenewalFeeCurrency: data.domainRenewalFeeCurrency === 'USD' ? 'USD' : 'CNY',
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
    renderProjects();
    renderRenewals();
    closeProjectModal();
    // 持久化 (cloud 模式时把 DB 回写的真实 id/时间戳合并回 state,然后再渲染一次)
    await persistProject(project);
    renderProjects();
    renderRenewals();
  });

  // ---------- Ideas ----------
  const ideaList = document.getElementById('idea-list');
  const ideaEmpty = document.getElementById('idea-empty');
  const ideaForm = document.getElementById('idea-quick-form');
  const ideaInput = document.getElementById('idea-quick-input');
  const ideaTag = document.getElementById('idea-quick-tag');
  const ideaPriority = document.getElementById('idea-quick-priority');

  ideaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = ideaInput.value.trim();
    if (!content) return;
    const idea = {
      id: uid(),
      content,
      tag: ideaTag.value,
      priority: ideaPriority.value,
      createdAt: Date.now(),
    };
    state.ideas.push(idea);
    ideaInput.value = '';
    ideaInput.focus();
    renderIdeas();
    await persistIdea(idea);
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
      .forEach((idea) => ideaList.appendChild(wrapSwipeable(renderIdeaItem(idea), () => deleteIdea(idea.id))));
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
    renderIdeas();
    removeIdeaRemote(id);
  }

  // ---------- Utilities ----------
  function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
  }
  function currencySymbol(code) {
    return code === 'USD' ? '$' : '¥';
  }
  function formatMoney(amount, currency) {
    return `${currencySymbol(currency)}${Number(amount).toFixed(2)}`;
  }
  function formatDomainFee(p) {
    const first = Number(p.domainFee);
    const renew = Number(p.domainRenewalFee);
    const firstCur = p.domainFeeCurrency || 'CNY';
    const renewCur = p.domainRenewalFeeCurrency || 'CNY';
    if (first > 0 && renew > 0) {
      return `首年 ${formatMoney(first, firstCur)} · 续 ${formatMoney(renew, renewCur)}`;
    }
    if (first > 0) return `${formatMoney(first, firstCur)} / 年`;
    if (renew > 0) return `${formatMoney(renew, renewCur)} / 年`;
    return '';
  }
  function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

    // 年费按币种分别汇总；优先用续费价（反映长期成本），没续费的用首年价
    const yearlyByCur = { CNY: 0, USD: 0 };
    projects.forEach((p) => {
      const renew = Number(p.domainRenewalFee) || 0;
      const first = Number(p.domainFee) || 0;
      const amount = renew > 0 ? renew : first;
      if (amount <= 0) return;
      const cur = renew > 0
        ? (p.domainRenewalFeeCurrency || 'CNY')
        : (p.domainFeeCurrency || 'CNY');
      yearlyByCur[cur === 'USD' ? 'USD' : 'CNY'] += amount;
    });
    const yearlyParts = [];
    if (yearlyByCur.CNY > 0) yearlyParts.push(`¥${yearlyByCur.CNY.toFixed(2)}`);
    if (yearlyByCur.USD > 0) yearlyParts.push(`$${yearlyByCur.USD.toFixed(2)}`);
    const yearlyDisplay = yearlyParts.length ? yearlyParts.join(' + ') : '¥0.00';

    costMetrics.innerHTML = [
      metricCard('月度总成本', `¥ ${totalCost.toFixed(2)}`),
      metricCard('月度总收入', `¥ ${totalRev.toFixed(2)}`),
      metricCard('月度净利', `${net >= 0 ? '+' : '-'} ¥ ${Math.abs(net).toFixed(2)}`, net >= 0 ? 'positive' : 'negative'),
      metricCard('域名年费总和', yearlyDisplay),
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
      if (p.createdAt) lines.push(`- 创建于: ${formatDate(p.createdAt)}`);
      if (p.domain) lines.push(`- 域名: ${p.domain}${p.domainExpiry ? ` (到期 ${p.domainExpiry})` : ''}`);
      const feeText = formatDomainFee(p);
      if (feeText) lines.push(`- 域名年费: ${feeText}`);
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

  // ---------- Header menu (theme + settings combined) ----------
  const headerMenuToggle = document.getElementById('header-menu-toggle');
  const headerMenuPanel = document.getElementById('header-menu-panel');
  const importFile = document.getElementById('import-file');

  function applyTheme(name) {
    const theme = VALID_THEMES.includes(name) ? name : 'white';
    document.body.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    headerMenuPanel.querySelectorAll('.theme-swatch-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.theme === theme)
    );
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      const bg = getComputedStyle(document.body).getPropertyValue('--bg-page').trim();
      if (bg) metaTheme.setAttribute('content', bg);
    }
  }

  headerMenuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    headerMenuPanel.hidden = !headerMenuPanel.hidden;
  });

  headerMenuPanel.addEventListener('click', (e) => {
    const themeBtn = e.target.closest('.theme-swatch-btn');
    if (themeBtn) {
      applyTheme(themeBtn.dataset.theme);
      // 主题切换不关闭面板，方便快速试色
      return;
    }
    const actionBtn = e.target.closest('button[data-action]');
    if (!actionBtn) return;
    headerMenuPanel.hidden = true;
    if (actionBtn.dataset.action === 'export') exportData();
    if (actionBtn.dataset.action === 'import') importFile.click();
    if (actionBtn.dataset.action === 'clear') clearAll();
    // signout 由云端模块内部直接绑定,这里不重复处理
  });

  applyTheme(localStorage.getItem(THEME_KEY) || 'white');

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
      renderProjects();
      renderIdeas();
      renderRenewals();
      if (currentUserId) {
        // 云端模式:整批 upsert 到 Supabase
        if (!mode) {
          // 覆盖模式:先清云端所有数据
          await cloud.from('projects').delete().eq('user_id', currentUserId);
          await cloud.from('ideas').delete().eq('user_id', currentUserId);
        }
        if (projects.length) {
          const { error } = await cloud.from('projects')
            .upsert(projects.map((p) => projectToRow(p, currentUserId)));
          if (error) cloudError('导入项目失败', error);
        }
        if (ideas.length) {
          const { error } = await cloud.from('ideas')
            .upsert(ideas.map((i) => ideaToRow(i, currentUserId)));
          if (error) cloudError('导入灵感失败', error);
        }
      } else {
        save();
      }
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

  async function clearAll() {
    if (!confirm('确定清空所有项目和灵感？此操作不可恢复。建议先「导出 JSON」备份。')) return;
    if (!confirm('再次确认：真的全部清空？')) return;
    state.projects = [];
    state.ideas = [];
    renderProjects();
    renderIdeas();
    renderRenewals();
    if (currentUserId) {
      await cloud.from('projects').delete().eq('user_id', currentUserId);
      await cloud.from('ideas').delete().eq('user_id', currentUserId);
    } else {
      save();
    }
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#header-menu')) headerMenuPanel.hidden = true;
  });

  // ---------- Global keys ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!projectModal.hidden) closeProjectModal();
      headerMenuPanel.hidden = true;
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

  // ---------- 云端 (Supabase) + 登录态守卫 ----------
  // 阶段 1: 只接通登录,数据仍读 localStorage。
  // 下个 PR 才把读写都换成 Supabase + 迁移本地数据 + Realtime。
  const cloudConfig = window.ATLAS_CONFIG || {};
  const cloudEnabled = !!(cloudConfig.supabaseUrl && cloudConfig.supabaseKey && window.supabase);
  const cloud = cloudEnabled
    ? window.supabase.createClient(cloudConfig.supabaseUrl, cloudConfig.supabaseKey)
    : null;

  const authView = document.getElementById('auth-view');
  const appHeader = document.querySelector('.app-header');
  const appMainEl = document.querySelector('.app-main');
  const menuSignout = document.getElementById('menu-signout');
  const menuDividerAccount = document.getElementById('menu-divider-account');

  function showApp() {
    authView.hidden = true;
    appHeader.hidden = false;
    appMainEl.hidden = false;
    menuSignout.hidden = !cloudEnabled;
    menuDividerAccount.hidden = !cloudEnabled;
    renderProjects();
    renderIdeas();
    renderRenewals();
  }

  function showAuth() {
    authView.hidden = false;
    appHeader.hidden = true;
    appMainEl.hidden = true;
  }

  // 登录页两步表单的可见性切换 (外层定义,因为 exitCloudMode 也要用)
  function showEmailStep() {
    const formEmail = document.getElementById('auth-form-email');
    const formCode = document.getElementById('auth-form-code');
    const code = document.getElementById('auth-code');
    const status = document.getElementById('auth-status');
    if (formEmail) formEmail.hidden = false;
    if (formCode) formCode.hidden = true;
    if (code) code.value = '';
    if (status) { status.hidden = true; status.textContent = ''; }
  }

  // 登录表单 ---------------------------------------------------------
  // 两段式:邮箱 → 6 位登录码
  // (用 OTP code 而非 magic link,因为 iOS 邮件里点链接会跳 Safari,
  //  PWA 永远收不到 session。让用户把数字码手动输回 PWA 才能登上。)
  if (cloud) {
    const authFormEmail = document.getElementById('auth-form-email');
    const authFormCode = document.getElementById('auth-form-code');
    const authEmail = document.getElementById('auth-email');
    const authCode = document.getElementById('auth-code');
    const authSentEmail = document.getElementById('auth-sent-email');
    const authChangeEmail = document.getElementById('auth-change-email');
    const authStatus = document.getElementById('auth-status');
    const authSubmitEmail = authFormEmail.querySelector('.auth-submit');
    const authSubmitCode = authFormCode.querySelector('.auth-submit');

    let pendingEmail = '';

    // 预填上次登录的邮箱,免得每次都要从头输
    const rememberedEmail = localStorage.getItem(LAST_EMAIL_KEY);
    if (rememberedEmail) authEmail.value = rememberedEmail;

    const setStatus = (text, kind) => {
      authStatus.hidden = !text;
      authStatus.className = `auth-status${kind ? ' ' + kind : ''}`;
      authStatus.textContent = text || '';
    };

    // 内部版本:除了切换可见性,还重置 submit 按钮 disabled 态
    const resetEmailStep = () => {
      showEmailStep();
      authSubmitEmail.disabled = false;
      authSubmitCode.disabled = false;
    };
    const showCodeStep = (email) => {
      authFormEmail.hidden = true;
      authFormCode.hidden = false;
      authSentEmail.textContent = email;
      setTimeout(() => authCode.focus(), 0);
    };

    // 第 1 步:发送登录码
    authFormEmail.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = authEmail.value.trim();
      if (!email) return;
      authSubmitEmail.disabled = true;
      setStatus('正在发送…');
      try {
        const { error } = await cloud.auth.signInWithOtp({
          email,
          options: {
            // 邮件里依然包含一个可点的 magic link (桌面浏览器场景能用),
            // 但 iOS PWA 用户应该直接读 6 位数字回填到 App。
            emailRedirectTo: window.location.origin + window.location.pathname,
            shouldCreateUser: true,
          },
        });
        if (error) throw error;
        pendingEmail = email;
        localStorage.setItem(LAST_EMAIL_KEY, email);  // 下次预填
        showCodeStep(email);
        setStatus('邮件里有数字登录码,5 分钟内有效。', 'success');
      } catch (err) {
        setStatus(`发送失败:${err.message || err}`, 'error');
        authSubmitEmail.disabled = false;
      }
    });

    // 第 2 步:用登录码换 session
    authFormCode.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = authCode.value.trim();
      if (token.length < 6) {
        setStatus('登录码至少 6 位数字,看下邮件里那串。', 'error');
        return;
      }
      authSubmitCode.disabled = true;
      setStatus('验证中…');
      try {
        const { error } = await cloud.auth.verifyOtp({
          email: pendingEmail,
          token,
          type: 'email',
        });
        if (error) throw error;
        // 成功的话 onAuthStateChange 会立刻触发 SIGNED_IN,
        // 那边的 showApp() 会负责切到主界面,这里不用额外做
      } catch (err) {
        setStatus(`验证失败:${err.message || err}。看下数字有没有打错,或者再发一次新码。`, 'error');
        authSubmitCode.disabled = false;
      }
    });

    // Supabase OTP 长度可配置 (默认 6,本项目实际是 8)。
    // 接受 6/8 两种最常见长度;到了这两个边界自动提交,免一次手动点。
    authCode.addEventListener('input', () => {
      authCode.value = authCode.value.replace(/\D/g, '').slice(0, 10);
      if (authCode.value.length === 6 || authCode.value.length === 8) {
        authFormCode.requestSubmit();
      }
    });

    // 换邮箱按钮:回到第 1 步
    authChangeEmail.addEventListener('click', () => {
      pendingEmail = '';
      resetEmailStep();
    });

    // 退出登录
    menuSignout.addEventListener('click', async () => {
      await cloud.auth.signOut();
    });

    // 监听登录态变化
    cloud.auth.onAuthStateChange(async (event, session) => {
      if (session) await enterCloudMode(session.user.id);
      else exitCloudMode();
    });
  }

  // 实时订阅 (Realtime) -------------------------------------------------
  let realtimeChannel = null;
  function setupRealtime(userId) {
    if (!cloud) return;
    if (realtimeChannel) cloud.removeChannel(realtimeChannel);
    realtimeChannel = cloud
      .channel(`atlas-${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` },
        handleProjectChange)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'ideas', filter: `user_id=eq.${userId}` },
        handleIdeaChange)
      .subscribe();
  }
  function handleProjectChange(payload) {
    const t = payload.eventType;
    if (t === 'INSERT' || t === 'UPDATE') {
      const p = rowToProject(payload.new);
      const idx = state.projects.findIndex((x) => x.id === p.id);
      if (idx >= 0) state.projects[idx] = p; else state.projects.push(p);
    } else if (t === 'DELETE') {
      state.projects = state.projects.filter((x) => x.id !== payload.old.id);
    }
    renderProjects();
    renderRenewals();
  }
  function handleIdeaChange(payload) {
    const t = payload.eventType;
    if (t === 'INSERT' || t === 'UPDATE') {
      const i = rowToIdea(payload.new);
      const idx = state.ideas.findIndex((x) => x.id === i.id);
      if (idx >= 0) state.ideas[idx] = i; else state.ideas.push(i);
    } else if (t === 'DELETE') {
      state.ideas = state.ideas.filter((x) => x.id !== payload.old.id);
    }
    renderIdeas();
  }

  // 本地 → 云端迁移 (仅首次登录后,本地有数据 + 云端为空时触发) ----------
  // 数据安全准则: localStorage 是数据的最后一份本地副本,
  // **只有在上传成功** 才清掉。用户取消 / 网络出错 / RLS 失败一律保留本地。
  async function maybeMigrateLocalToCloud(userId) {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    let local;
    try { local = JSON.parse(raw); } catch (e) {
      localStorage.removeItem(STORAGE_KEY);  // 损坏的 JSON,删掉
      return;
    }
    const localProjects = Array.isArray(local.projects) ? local.projects : [];
    const localIdeas = Array.isArray(local.ideas) ? local.ideas : [];
    if (localProjects.length + localIdeas.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    // 云端已有数据 → 保留本地不动,下次还会提示 (避免覆盖云端)
    const cloudData = await cloudLoadAll(userId);
    if (cloudData.projects.length + cloudData.ideas.length > 0) {
      return;
    }
    const msg = `检测到这台设备本地有 ${localProjects.length} 个项目、${localIdeas.length} 条灵感,云端目前是空的。\n\n• 确定 → 上传到云端 (上传成功后才清本地)\n• 取消 → 保留本地不动,下次再问`;
    if (!confirm(msg)) {
      // 用户先放一放,localStorage 保留,下次启动还会问
      return;
    }
    // 上传 — 任一项失败就保留本地,让用户截图找开发者
    let allOk = true;
    if (localProjects.length) {
      const rows = localProjects.map((p) => projectToRow(p, userId));
      const { error } = await cloud.from('projects').insert(rows);
      if (error) {
        cloudError('上传项目失败 (本地数据保留)', error);
        allOk = false;
      }
    }
    if (allOk && localIdeas.length) {
      const rows = localIdeas.map((i) => ideaToRow(i, userId));
      const { error } = await cloud.from('ideas').insert(rows);
      if (error) {
        cloudError('上传灵感失败 (本地数据保留)', error);
        allOk = false;
      }
    }
    if (allOk) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // 进入云端模式 (首次登录 或 onAuthStateChange 触发 SIGNED_IN) ----------
  async function enterCloudMode(userId) {
    if (currentUserId === userId) return;  // 防重复触发
    currentUserId = userId;
    try {
      await maybeMigrateLocalToCloud(userId);
      const data = await cloudLoadAll(userId);
      state = data;
      setupRealtime(userId);
    } catch (err) {
      cloudError('云端连接失败,显示空状态。请刷新重试', err);
    }
    showApp();  // 不管成功失败都展示主界面 (避免卡在 splash)
  }
  function exitCloudMode() {
    if (realtimeChannel) {
      cloud.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    currentUserId = null;
    state = { projects: [], ideas: [] };
    showEmailStep();
    showAuth();
  }

  // 首次启动:根据登录态决定显示哪一面 ---------------------------------
  async function bootstrap() {
    if (!cloud) {
      // 没接云端 (config 空) — 单机模式,保持原行为
      showApp();
      return;
    }
    const { data: { session } } = await cloud.auth.getSession();
    if (session) await enterCloudMode(session.user.id);
    else showAuth();
  }
  bootstrap();

  // 启动画面淡出 ----------------------------------------------------
  const splash = document.getElementById('splash');
  if (splash) {
    const hide = () => {
      splash.classList.add('fade-out');
      setTimeout(() => splash.remove(), 500);
    };
    const minShow = sessionStorage.getItem('splash-shown') ? 250 : 700;
    sessionStorage.setItem('splash-shown', '1');
    if (document.readyState === 'complete') {
      setTimeout(hide, minShow);
    } else {
      window.addEventListener('load', () => setTimeout(hide, minShow));
    }
  }

  // ---------- Service Worker + 自动更新 ----------
  // 流程：
  //  1) 注册时若已有 waiting worker（上次未刷新），立即提示
  //  2) 之后每次 updatefound，新 SW 状态变为 installed 时提示
  //  3) 每小时主动 reg.update() 拉一次（长时间停留场景）
  //  4) 用户点「立即刷新」→ postMessage SKIP_WAITING → controllerchange → reload
  //  5) 用户忽略也没关系：下次冷启动新 SW 自动激活
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then((reg) => {
          if (reg.waiting && navigator.serviceWorker.controller) {
            showUpdateBanner(reg.waiting);
          }
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateBanner(installing);
              }
            });
          });
          setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
        })
        .catch(() => {});

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  }

  function showUpdateBanner(waitingWorker) {
    if (document.getElementById('update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.className = 'update-banner';
    const text = document.createElement('span');
    text.className = 'update-text';
    text.textContent = '有新版本可用';
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'update-now';
    apply.textContent = '立即刷新';
    apply.addEventListener('click', () => {
      apply.disabled = true;
      apply.textContent = '正在刷新…';
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    });
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'update-dismiss';
    dismiss.setAttribute('aria-label', '稍后');
    dismiss.textContent = '×';
    dismiss.addEventListener('click', () => banner.remove());
    banner.append(text, apply, dismiss);
    document.body.prepend(banner);
  }
})();
