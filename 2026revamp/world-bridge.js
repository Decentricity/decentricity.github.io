(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const hasWebGPU = !!navigator.gpu;
  let worldHost = null;
  let worldFrame = null;
  let worldLoaded = false;

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

  function showUnavailable() {
    glitch(() => {
      hideAllScreens();
      document.body.classList.remove('hedgeyos-active', 'world-active');
      const code = $('#message-code');
      const title = $('#message-title');
      const copy = $('#message-copy');
      if (code) code.textContent = 'DISPLAY:WORLD';
      if (title) title.textContent = 'WORLD REQUIRES WEBGPU';
      if (copy) copy.textContent = 'This browser does not expose WebGPU. Shell and HedgeyOS remain available.';
      $('#message-screen')?.classList.remove('hidden');
    });
  }

  function ensureWorldHost() {
    if (worldHost && worldFrame) return { host: worldHost, frame: worldFrame };

    worldHost = document.createElement('section');
    worldHost.id = 'world-host-screen';
    worldHost.className = 'screen hidden';
    worldHost.setAttribute('aria-label', 'Decentricity 3D world');
    worldHost.style.cssText = 'position:fixed;inset:0;z-index:300;background:#02030a;overflow:hidden;';

    worldFrame = document.createElement('iframe');
    worldFrame.id = 'world-frame';
    worldFrame.title = 'Decentricity World';
    worldFrame.src = 'world/?v=20260911c';
    worldFrame.setAttribute('allow', 'fullscreen');
    worldFrame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:#02030a;';
    worldFrame.addEventListener('load', () => {
      worldLoaded = true;
      syncLabels();
    }, { once: true });

    worldHost.appendChild(worldFrame);
    ($('#machine') || document.body).appendChild(worldHost);
    return { host: worldHost, frame: worldFrame };
  }

  function preloadWorld() {
    if (!hasWebGPU) return;
    ensureWorldHost();
  }

  function openWorld() {
    if (!hasWebGPU) return showUnavailable();
    const { host, frame } = ensureWorldHost();
    glitch(() => {
      hideAllScreens();
      document.body.classList.remove('hedgeyos-active');
      document.body.classList.add('world-active');
      host.classList.remove('hidden');
      frame.focus();
    });
  }

  function leaveWorld(target = 'selector') {
    glitch(() => {
      worldHost?.classList.add('hidden');
      document.body.classList.remove('world-active');
      if (target === 'shell') {
        $('#terminal-screen')?.classList.remove('hidden');
        window.setTimeout(() => $('#command-input')?.focus(), 80);
        return;
      }
      if (target === 'desktop') {
        $('#selector-screen')?.classList.remove('hidden');
        window.setTimeout(() => $('[data-interface="desktop"]')?.click(), 30);
        return;
      }
      $('#selector-screen')?.classList.remove('hidden');
    });
  }

  // Deliberately updates only WORLD-owned labels. HedgeyOS has its own
  // MutationObserver; touching its shared help/home labels here would make
  // the two renderers fight over the same DOM nodes.
  function syncLabels() {
    const card = $('[data-interface="world"]');
    if (card) {
      const state = $('em', card);
      if (hasWebGPU) {
        card.classList.remove('pending');
        card.classList.add('ready');
        if (state) state.textContent = worldLoaded ? 'online' : 'loading…';
      } else {
        card.classList.add('pending');
        card.classList.remove('ready');
        if (state) state.textContent = 'WebGPU required';
      }
    }

    const worldButton = $('[data-display="world"]');
    if (worldButton) {
      const article = worldButton.closest('.data-card');
      const h3 = article?.querySelector('h3');
      const p = article?.querySelector('p');
      if (h3) h3.textContent = hasWebGPU ? '◎ WORLD // ONLINE' : '◎ WORLD // WEBGPU REQUIRED';
      if (p) p.textContent = 'NFTMassacre-derived first-person project world. The house is home; project families occupy districts around it.';
      worldButton.textContent = hasWebGPU ? 'OPEN WORLD' : 'WEBGPU REQUIRED';
    }

    const boot = $('#boot-log');
    if (boot?.textContent && hasWebGPU && worldLoaded) {
      const text = boot.textContent.replace(/SPAWN nftworld\.service[^\n]*STAGED/g, 'SPAWN nftworld.service ......................................... OK');
      if (boot.textContent !== text) boot.textContent = text;
    }
  }

  function interceptWorldClick(event) {
    const target = event.target.closest?.('[data-interface="world"], [data-display="world"], [data-hos-action="world"]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openWorld();
  }

  function interceptWorldCommand(event) {
    if (!event.target.closest?.('#command-form')) return;
    const input = $('#command-input');
    if ((input?.value || '').trim().toLowerCase() !== 'world') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    input.value = '';
    openWorld();
  }

  function interceptWorldKeyboard(event) {
    const selector = $('#selector-screen');
    const visible = selector && !selector.classList.contains('hidden');
    if (!visible) return;
    const selectedWorld = $('[data-interface="world"]')?.classList.contains('selected');
    if (event.key !== '1' && !(event.key === 'Enter' && selectedWorld)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openWorld();
  }

  document.addEventListener('click', interceptWorldClick, true);
  document.addEventListener('submit', interceptWorldCommand, true);
  document.addEventListener('keydown', interceptWorldKeyboard, true);

  window.addEventListener('message', event => {
    if (!worldFrame || event.source !== worldFrame.contentWindow) return;
    const msg = event.data;
    if (!msg || msg.type !== 'decentricity:switch') return;
    leaveWorld(msg.target || 'selector');
  });

  // The interfaces page is rendered dynamically, so refresh only WORLD-owned
  // labels periodically rather than observing/mutating the whole document.
  window.setInterval(syncLabels, 750);

  preloadWorld();
  syncLabels();
})();
