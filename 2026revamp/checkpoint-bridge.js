(() => {
  'use strict';

  const data = window.DECENTRI_DATA || {};
  const projectCount = Array.isArray(data.projects) ? data.projects.length : 0;
  let applyingHistory = false;
  let lastKey = null;
  let historyInitialized = false;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const visible = el => !!el && !el.classList.contains('hidden');

  function patchCheckpointLabels() {
    const eyebrow = $('#selector-screen .eyebrow');
    if (eyebrow) eyebrow.textContent = 'DISPLAY MANAGER // AUDIT CHECKPOINT 01';

    const boot = $('#boot-log');
    if (boot?.textContent) {
      let text = boot.textContent
        .replace(/INDEX 18 curated project records/g, `INDEX ${projectCount} audited project records`)
        .replace(/NOTE graphical renderers are reserved for a later build/g, 'NOTE project graph rebuilt from manual repository audit')
        .replace(/SPAWN hedgeyos-display\.service([^\n]*)STAGED/g, 'SPAWN hedgeyos-display.service ................................. OK');
      if (boot.textContent !== text) boot.textContent = text;
    }

    $$('.menu-meta').forEach(el => {
      if (/^18 records$/i.test(el.textContent.trim())) el.textContent = `${projectCount} records`;
    });

    $$('.menu-row small, .data-card p').forEach(el => {
      if (el.textContent.includes('Shell now; World and HedgeyOS next')) {
        el.textContent = 'Shell, HedgeyOS and World share one audited project graph.';
      }
    });
  }

  function currentState() {
    const world = $('#world-host-screen');
    if (visible(world)) return { view: 'world' };
    if (visible($('#hedgeyos-screen'))) return { view: 'desktop' };
    if (visible($('#selector-screen'))) return { view: 'selector' };
    if (visible($('#terminal-screen'))) {
      const crumb = ($('#breadcrumb')?.textContent || 'SYS:/HOME').replace(/^SYS:/i, '');
      const projectMatch = crumb.match(/^\/PROJECTS\/([^/]+)$/i);
      if (projectMatch) return { view: 'shell', route: 'projects', project: projectMatch[1].toLowerCase() };
      const route = crumb.replace(/^\//, '').split('/')[0].toLowerCase() || 'home';
      return { view: 'shell', route };
    }
    if (visible($('#message-screen'))) return { view: 'message' };
    return { view: 'boot' };
  }

  function stateKey(state) {
    return [state.view, state.route || '', state.project || ''].join(':');
  }

  function recordCurrentState() {
    if (applyingHistory) return;
    const state = currentState();
    const key = stateKey(state);
    if (key === lastKey) return;

    const payload = { decentri2026: true, ...state };
    if (!historyInitialized) {
      history.replaceState(payload, '', location.href);
      historyInitialized = true;
    } else {
      history.pushState(payload, '', location.href);
    }
    lastKey = key;
  }

  function showOnly(id) {
    $$('.screen').forEach(el => el.classList.add('hidden'));
    $(id)?.classList.remove('hidden');
  }

  function openShellRoute(state) {
    document.body.classList.remove('world-active', 'hedgeyos-active');
    showOnly('#terminal-screen');

    const route = state.route || 'home';
    const rail = $(`.rail-item[data-route="${CSS.escape(route)}"]`);
    rail?.click();

    if (state.project) {
      const projectButton = $(`[data-project="${CSS.escape(state.project)}"]`);
      projectButton?.click();
    }

    window.setTimeout(() => $('#command-input')?.focus(), 40);
  }

  function applyState(state) {
    if (!state) return;
    if (state.view === 'shell') return openShellRoute(state);

    if (state.view === 'selector' || state.view === 'boot') {
      document.body.classList.remove('world-active', 'hedgeyos-active');
      showOnly(state.view === 'boot' ? '#boot-screen' : '#selector-screen');
      return;
    }

    if (state.view === 'desktop') {
      document.body.classList.remove('world-active');
      document.body.classList.add('hedgeyos-active');
      showOnly('#hedgeyos-screen');
      return;
    }

    if (state.view === 'world') {
      const worldCard = $('[data-interface="world"]');
      worldCard?.click();
      return;
    }

    if (state.view === 'message') {
      document.body.classList.remove('world-active', 'hedgeyos-active');
      showOnly('#message-screen');
    }
  }

  window.addEventListener('popstate', event => {
    const state = event.state;
    if (!state?.decentri2026) return;
    applyingHistory = true;
    lastKey = stateKey(state);
    applyState(state);
    window.setTimeout(() => { applyingHistory = false; }, 60);
  });

  const observer = new MutationObserver(() => {
    patchCheckpointLabels();
    window.clearTimeout(observer._historyTimer);
    observer._historyTimer = window.setTimeout(recordCurrentState, 25);
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class']
  });

  patchCheckpointLabels();
  recordCurrentState();
})();
