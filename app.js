/* SaaS 指挥中心 — MVP
 * 范围：项目 CRUD、灵感 CRUD、localStorage 持久化、白色主题
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'saas-command:v1';

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
    const filtered = state.projects.filter(
      (p) => currentFilter === 'all' || p.status === currentFilter
    );
    projectList.innerHTML = '';
    projectEmpty.hidden = filtered.length > 0;

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

    // API keys (masked)
    if (p.apiKeys && p.apiKeys.trim()) {
      const block = document.createElement('div');
      block.className = 'keys-block';
      const lines = p.apiKeys
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      block.innerHTML = lines.map(renderKeyLine).join('');
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
    const editBtn = document.createElement('button');
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', () => openProjectModal(p));
    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = '删除';
    delBtn.addEventListener('click', () => deleteProject(p.id));
    actions.append(editBtn, delBtn);
    card.append(actions);

    return card;
  }

  function renderKeyLine(line) {
    const eq = line.indexOf('=');
    if (eq === -1) {
      return `<div class="keys-line"><span class="keys-name">${escapeHtml(line)}</span></div>`;
    }
    const name = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    return `<div class="keys-line"><span class="keys-name">${escapeHtml(name)}=</span><span>${escapeHtml(maskKey(value))}</span></div>`;
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
    ideaList.innerHTML = '';
    ideaEmpty.hidden = state.ideas.length > 0;
    state.ideas
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

  // ---------- Global keys ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !projectModal.hidden) {
      closeProjectModal();
    }
  });

  // ---------- Init ----------
  renderProjects();
  renderIdeas();
})();
