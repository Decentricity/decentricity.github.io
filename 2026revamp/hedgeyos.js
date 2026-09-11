(() => {
  'use strict';

  const data = window.DECENTRI_DATA || { projects: [], families: [], archive: [], timeline: [] };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const screen = $('#hedgeyos-screen');
  const desktop = $('#hos-desktop');
  const iconLayer = $('#hos-icons');
  const windowLayer = $('#hos-window-layer');
  const taskLayer = $('#hos-tasks');
  const template = $('#hos-window-template');
  const clock = $('#hos-clock');
  const count = $('#hos-window-count');
  let z = 50;
  let cascadeIndex = 0;
  const windows = new Map();

  const familyGlyphs = {
    'tiny-computers': '▣',
    'xr-hardware': '◉',
    'machine-minds': '✣',
    'artificial-media': '♫',
    'decentralized-systems': '⌘',
    'worlds-art': '◇'
  };

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function escapeAttr(value = '') { return escapeHtml(value); }

  function glitch(callback) {
    document.body.classList.add('glitching');
    window.setTimeout(() => {
      callback?.();
      window.setTimeout(() => document.body.classList.remove('glitching'), 220);
    }, 210);
  }

  function hideAllScreens() {
    $$('.screen').forEach(el => el.classList.add('hidden'));
  }

  function openHedgey(projectId = null) {
    glitch(() => {
      hideAllScreens();
      screen.classList.remove('hidden');
      document.body.classList.add('hedgeyos-active');
      closeMenus();
      if (projectId) openProject(projectId);
    });
  }

  function leaveHedgey(target = 'selector') {
    glitch(() => {
      screen.classList.add('hidden');
      document.body.classList.remove('hedgeyos-active');
      const dest = target === 'shell' ? $('#terminal-screen') : $('#selector-screen');
      dest?.classList.remove('hidden');
      if (target === 'shell') window.setTimeout(() => $('#command-input')?.focus(), 80);
    });
  }

  function showWorldReserved() {
    glitch(() => {
      hideAllScreens();
      document.body.classList.remove('hedgeyos-active');
      $('#message-code').textContent = 'DISPLAY:WORLD';
      $('#message-title').textContent = 'WORLD RENDERER STAGED';
      $('#message-copy').textContent = navigator.gpu
        ? 'WebGPU is available. The NFTMassacre-style world renderer is the next interface to be mounted here.'
        : 'This browser does not expose WebGPU. The world renderer will remain unavailable here; Shell and HedgeyOS stay online.';
      $('#message-screen').classList.remove('hidden');
    });
  }

  function familyFor(project) { return data.families.find(f => f.id === project.family); }
  function glyphFor(project) { return familyGlyphs[project.family] || '□'; }

  function renderIcons() {
    const system = [
      { id:'system-about', title:'About Pandu', glyph:'🦔', note:'system file', action:() => openGeneric('about') },
      { id:'system-projects', title:'Projects', glyph:'📁', note:`${data.projects.length} items`, action:() => openGeneric('projects') },
      { id:'system-archive', title:'Archive', glyph:'🗄️', note:'read-only', action:() => openGeneric('archive') },
      { id:'system-timeline', title:'Timeline', glyph:'🕘', note:'2007→2026', action:() => openGeneric('timeline') }
    ];

    iconLayer.innerHTML = '';
    [...system, ...data.projects.map(p => ({
      id:`project-${p.id}`,
      title:p.title,
      glyph:glyphFor(p),
      note:String(p.year),
      action:() => openProject(p.id)
    }))].forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hos-icon';
      btn.dataset.hosIcon = item.id;
      btn.innerHTML = `<span class="hos-icon-glyph" aria-hidden="true">${escapeHtml(item.glyph)}</span><span class="hos-icon-label">${escapeHtml(item.title)}</span><span class="hos-icon-dot">${escapeHtml(item.note)}</span>`;
      btn.addEventListener('click', () => {
        $$('.hos-icon.selected', iconLayer).forEach(i => i.classList.remove('selected'));
        btn.classList.add('selected');
        item.action();
      });
      iconLayer.appendChild(btn);
    });
  }

  function windowPosition() {
    const mobile = window.matchMedia('(max-width: 720px)').matches;
    if (mobile) return { left: 8, top: 8 };
    const n = cascadeIndex++ % 9;
    return { left: 44 + n * 26, top: 28 + n * 23 };
  }

  function createWindow(id, title, html) {
    const existing = windows.get(id);
    if (existing) {
      existing.el.classList.remove('minimized');
      focusWindow(existing.el);
      return existing.el;
    }

    const el = template.content.firstElementChild.cloneNode(true);
    const pos = windowPosition();
    el.dataset.windowId = id;
    el.style.left = `${pos.left}px`;
    el.style.top = `${pos.top}px`;
    el.style.height = 'min(520px, calc(100% - 56px))';
    $('[data-hos-title]', el).textContent = title;
    $('[data-hos-body]', el).innerHTML = html;
    windowLayer.appendChild(el);

    const task = document.createElement('button');
    task.type = 'button';
    task.className = 'hos-task';
    task.textContent = title;
    task.title = title;
    task.addEventListener('click', () => {
      el.classList.remove('minimized');
      focusWindow(el);
    });
    taskLayer.appendChild(task);
    windows.set(id, { el, task });

    $('[data-hos-close]', el).addEventListener('click', e => { e.stopPropagation(); closeWindow(id); });
    $('[data-hos-min]', el).addEventListener('click', e => { e.stopPropagation(); el.classList.add('minimized'); updateTasks(); });
    $('[data-hos-zoom]', el).addEventListener('click', e => { e.stopPropagation(); el.classList.toggle('maximized'); focusWindow(el); });
    el.addEventListener('pointerdown', () => focusWindow(el));
    bindDrag(el, $('[data-hos-drag]', el));
    bindWindowButtons(el);
    focusWindow(el);
    updateTasks();
    return el;
  }

  function closeWindow(id) {
    const rec = windows.get(id);
    if (!rec) return;
    rec.el.remove();
    rec.task.remove();
    windows.delete(id);
    updateTasks();
  }

  function closeAll() {
    [...windows.keys()].forEach(closeWindow);
  }

  function focusWindow(el) {
    z += 1;
    $$('.hos-window.focused', windowLayer).forEach(w => w.classList.remove('focused'));
    el.classList.add('focused');
    el.style.zIndex = String(z);
    updateTasks();
  }

  function updateTasks() {
    windows.forEach(({el, task}) => {
      task.classList.toggle('active', el.classList.contains('focused') && !el.classList.contains('minimized'));
    });
    count.textContent = `${windows.size} window${windows.size === 1 ? '' : 's'}`;
  }

  function bindDrag(el, bar) {
    let drag = null;
    bar.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || el.classList.contains('maximized') || window.matchMedia('(max-width: 720px)').matches) return;
      const rect = el.getBoundingClientRect();
      const deskRect = desktop.getBoundingClientRect();
      drag = { x:e.clientX, y:e.clientY, left:rect.left-deskRect.left, top:rect.top-deskRect.top };
      bar.setPointerCapture(e.pointerId);
      focusWindow(el);
    });
    bar.addEventListener('pointermove', e => {
      if (!drag) return;
      const deskRect = desktop.getBoundingClientRect();
      const maxLeft = Math.max(0, deskRect.width - el.offsetWidth);
      const maxTop = Math.max(0, deskRect.height - 40);
      const left = Math.min(maxLeft, Math.max(0, drag.left + e.clientX - drag.x));
      const top = Math.min(maxTop, Math.max(0, drag.top + e.clientY - drag.y));
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    });
    const stop = e => {
      if (!drag) return;
      drag = null;
      try { bar.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    bar.addEventListener('pointerup', stop);
    bar.addEventListener('pointercancel', stop);
  }

  function projectHtml(p) {
    const fam = familyFor(p);
    const links = p.links?.length
      ? p.links.map(l => `<a class="hos-button" href="${escapeAttr(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)} ↗</a>`).join('')
      : '<span class="hos-tag">NO PUBLIC LINK EXPOSED</span>';
    return `<div class="hos-project">
      <div class="hos-project-head">
        <div class="hos-project-bigicon">${escapeHtml(glyphFor(p))}</div>
        <div><div class="hos-project-kicker">${escapeHtml(fam?.title || p.family)} · ${escapeHtml(p.status)} · ${p.year}</div><h2>${escapeHtml(p.title)}</h2></div>
      </div>
      <p class="hos-project-summary">${escapeHtml(p.summary)}</p>
      <p class="hos-project-notes">${escapeHtml(p.notes)}</p>
      <div class="hos-tags">${(p.tech || []).map(t => `<span class="hos-tag">${escapeHtml(t)}</span>`).join('')}</div>
      <table class="hos-meta-table"><tr><th>Family</th><td>${escapeHtml(fam?.title || p.family)}</td></tr><tr><th>Status</th><td>${escapeHtml(p.status)}</td></tr><tr><th>Year</th><td>${p.year}</td></tr><tr><th>Record</th><td>/projects/${escapeHtml(p.id)}</td></tr></table>
      <div class="hos-links">${links}</div>
      <div class="hos-readme"><h3>Project dossier</h3><p>This window renders the same canonical record used by the terminal UI. The project graph is shared; only the interface changed.</p></div>
    </div>`;
  }

  function openProject(id) {
    const p = data.projects.find(x => x.id === id);
    if (!p) return;
    createWindow(`project:${p.id}`, p.title, projectHtml(p));
  }

  function genericHtml(kind) {
    if (kind === 'about') return `<div class="hos-generic"><h2>Pandu Sastrowardoyo // Decentricity</h2><p>Engineer, entrepreneur, researcher and maker working across AI, decentralized systems, tiny computers, XR, computational neuroscience and deliberately strange personal software.</p><p><strong>System philosophy:</strong> this is a personal machine, not a conventional portfolio. The résumé is one artifact inside a larger map of work.</p><p><a class="hos-button" href="https://github.com/Decentricity" target="_blank" rel="noopener">GitHub ↗</a></p></div>`;
    if (kind === 'projects') return `<div class="hos-generic"><h2>Projects Folder</h2><p>${data.projects.length} curated public project records are mounted on this desktop.</p><div class="hos-folder-list">${data.families.map(f => {
      const ps = data.projects.filter(p => p.family === f.id);
      return `<div class="hos-folder-item"><strong>${escapeHtml(f.title)}</strong><small>${escapeHtml(f.description)}</small><br><button class="hos-button" type="button" data-open-family="${escapeAttr(f.id)}">Open ${ps.length}</button></div>`;
    }).join('')}</div></div>`;
    if (kind === 'archive') return `<div class="hos-generic"><h2>Archive // read-only</h2><p>The old decentri.city material remains mounted rather than flattened away.</p><div class="hos-folder-list">${data.archive.map(a => `<div class="hos-folder-item"><strong>${escapeHtml(a.title)}</strong><small>${escapeHtml(a.detail)}</small><br><a class="hos-button" href="${escapeAttr(a.href)}" ${a.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>Open</a></div>`).join('')}</div></div>`;
    if (kind === 'timeline') return `<div class="hos-generic"><h2>Timeline</h2><ul>${data.timeline.map(t => `<li><strong>${escapeHtml(t.year)} — ${escapeHtml(t.title)}</strong><br>${escapeHtml(t.text)}</li>`).join('')}</ul></div>`;
    return '<div class="hos-generic"><h2>HedgeyOS</h2><p>Ready.</p></div>';
  }

  function openGeneric(kind) {
    const titles = { about:'About This Machine', projects:'Projects Folder', archive:'Archive', timeline:'Timeline' };
    const el = createWindow(`system:${kind}`, titles[kind] || 'System', genericHtml(kind));
    bindWindowButtons(el);
  }

  function bindWindowButtons(el) {
    $$('[data-open-family]', el).forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => openFamily(btn.dataset.openFamily));
    });
  }

  function openFamily(id) {
    const fam = data.families.find(f => f.id === id);
    if (!fam) return;
    const ps = data.projects.filter(p => p.family === id);
    const html = `<div class="hos-generic"><h2>${escapeHtml(fam.title)}</h2><p>${escapeHtml(fam.description)}</p><div class="hos-folder-list">${ps.map(p => `<div class="hos-folder-item"><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml(p.summary)}</small><br><button class="hos-button" type="button" data-open-project="${escapeAttr(p.id)}">Open</button></div>`).join('')}</div></div>`;
    const el = createWindow(`family:${id}`, fam.title, html);
    $$('[data-open-project]', el).forEach(btn => btn.addEventListener('click', () => openProject(btn.dataset.openProject)));
  }

  function arrangeIcons() {
    iconLayer.scrollTo({ top:0, behavior:'smooth' });
    $$('.hos-icon.selected', iconLayer).forEach(i => i.classList.remove('selected'));
  }

  function cascadeWindows() {
    let i = 0;
    windows.forEach(({el}) => {
      el.classList.remove('minimized', 'maximized');
      el.style.left = `${34 + (i % 10) * 24}px`;
      el.style.top = `${24 + (i % 10) * 21}px`;
      focusWindow(el);
      i += 1;
    });
  }

  function closeMenus() {
    $$('.hos-menu.open').forEach(m => m.classList.remove('open'));
    $$('.hos-menu-trigger.active').forEach(b => b.classList.remove('active'));
  }

  function toggleMenu(name) {
    const menu = $(`[data-hos-dropdown="${name}"]`);
    const trigger = $(`[data-hos-menu="${name}"]`);
    const opening = !menu?.classList.contains('open');
    closeMenus();
    if (opening && menu) { menu.classList.add('open'); trigger?.classList.add('active'); }
  }

  function handleAction(action) {
    closeMenus();
    if (action === 'about') return openGeneric('about');
    if (action === 'archive') return openGeneric('archive');
    if (action === 'timeline') return openGeneric('timeline');
    if (action === 'show-projects') return openGeneric('projects');
    if (action === 'close-all') return closeAll();
    if (action === 'arrange') return arrangeIcons();
    if (action === 'cascade') return cascadeWindows();
    if (action === 'selector') return leaveHedgey('selector');
    if (action === 'shell') return leaveHedgey('shell');
    if (action === 'world') return showWorldReserved();
    if (action === 'github') return window.open('https://github.com/Decentricity', '_blank', 'noopener');
  }

  function syncIntegrationLabels() {
    const card = $('[data-interface="desktop"]');
    if (card) {
      card.classList.remove('pending');
      card.classList.add('ready');
      const em = $('em', card);
      if (em && em.textContent !== 'online') em.textContent = 'online';
    }
    const help = $('.selector-help');
    const helpHtml = 'Use ← → and ENTER, press <kbd>2</kbd>/<kbd>3</kbd>, or click a display. HEDGEYOS and SHELL are online; WORLD remains staged for the WebGPU build.';
    if (help && help.innerHTML !== helpHtml) help.innerHTML = helpHtml;

    const displayBtn = $('[data-display="desktop"]');
    if (displayBtn) {
      const article = displayBtn.closest('.data-card');
      const h3 = $('h3', article);
      const p = $('p', article);
      if (h3 && h3.textContent !== '▣ HEDGEYOS // ONLINE') h3.textContent = '▣ HEDGEYOS // ONLINE';
      const deskCopy = 'Mac OS 9-ish HedgeyOS desktop. Every project is a desktop icon opening a shared project dossier window.';
      if (p && p.textContent !== deskCopy) p.textContent = deskCopy;
      if (displayBtn.textContent !== 'OPEN DESKTOP') displayBtn.textContent = 'OPEN DESKTOP';
    }
    const homeDisplay = $('[data-go="interfaces"]');
    if (homeDisplay) {
      const small = $('.menu-main small', homeDisplay);
      const meta = $('.menu-meta', homeDisplay);
      if (small && small.textContent !== 'Shell + HedgeyOS online; World renderer next') small.textContent = 'Shell + HedgeyOS online; World renderer next';
      if (meta && meta.textContent !== '2 online') meta.textContent = '2 online';
    }

    const boot = $('#boot-log');
    if (boot && boot.textContent) {
      let t = boot.textContent;
      t = t.replace(/SPAWN hedgeyos-display\.service[^\n]*STAGED/g, 'SPAWN hedgeyos-display.service ................................. OK');
      t = t.replace('NOTE graphical renderers are reserved for a later build', 'MOUNT HedgeyOS project desktop ................................. OK');
      if (boot.textContent !== t) boot.textContent = t;
    }
  }

  function intercept(e) {
    const target = e.target.closest?.('[data-interface="desktop"], [data-display="desktop"]');
    if (!target) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openHedgey();
  }

  function interceptCommand(e) {
    const form = e.target.closest?.('#command-form');
    if (!form) return;
    const value = ($('#command-input')?.value || '').trim().toLowerCase();
    if (value !== 'desktop' && value !== 'hedgeyos') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if ($('#command-input')) $('#command-input').value = '';
    openHedgey();
  }

  document.addEventListener('click', intercept, true);
  document.addEventListener('submit', interceptCommand, true);
  document.addEventListener('click', e => {
    const menu = e.target.closest?.('[data-hos-menu]');
    if (menu) { e.stopPropagation(); toggleMenu(menu.dataset.hosMenu); return; }
    const action = e.target.closest?.('[data-hos-action]');
    if (action) { e.stopPropagation(); handleAction(action.dataset.hosAction); return; }
    if (!e.target.closest?.('.hos-menu')) closeMenus();
  });

  document.addEventListener('keydown', e => {
    const selectorVisible = !$('#selector-screen')?.classList.contains('hidden');
    if (selectorVisible && (e.key === '2' || (e.key === 'Enter' && $('[data-interface="desktop"]')?.classList.contains('selected')))) {
      e.preventDefault(); e.stopImmediatePropagation(); openHedgey(); return;
    }
    if (!screen.classList.contains('hidden')) {
      if (e.key === 'Escape') { closeMenus(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); leaveHedgey('shell'); }
    }
  }, true);

  const observer = new MutationObserver(syncIntegrationLabels);
  observer.observe(document.body, { childList:true, subtree:true, characterData:true });

  window.setInterval(() => {
    if (clock) clock.textContent = new Intl.DateTimeFormat([], {hour:'2-digit', minute:'2-digit'}).format(new Date());
  }, 1000);

  renderIcons();
  syncIntegrationLabels();
})();
