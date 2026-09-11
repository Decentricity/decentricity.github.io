(() => {
  'use strict';

  const data = window.DECENTRI_DATA;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const screens = {
    boot: $('#boot-screen'),
    selector: $('#selector-screen'),
    terminal: $('#terminal-screen'),
    message: $('#message-screen')
  };

  const panelTitle = $('#panel-title');
  const panel = $('#panel-content');
  const breadcrumb = $('#breadcrumb');
  const statusLine = $('#status-line');
  const commandForm = $('#command-form');
  const commandInput = $('#command-input');
  const clock = $('#clock');

  const state = {
    route: 'home',
    history: [],
    historyIndex: 0,
    selectorIndex: 2,
    path: '/home',
    previousRoute: 'home',
    webgpu: false
  };

  const routes = ['home', 'projects', 'families', 'timeline', 'archive', 'about', 'interfaces'];
  const routeNames = {
    home: 'MAIN MENU', projects: 'PROJECT INDEX', families: 'PROJECT FAMILIES', timeline: 'TIMELINE',
    archive: 'WRITING + ARCHIVE', about: 'ABOUT / SYSTEM ID', interfaces: 'DISPLAY MANAGER'
  };

  const ascii = String.raw`  ____  _____ ____ _____ _   _ _____ ____  ___ ____ ___ _______   __
 |  _ \| ____/ ___| ____| \ | |_   _|  _ \|_ _/ ___|_ _|_   _\ \ / /
 | | | |  _|| |   |  _| |  \| | | | | |_) || | |    | |  | |  \ V /
 | |_| | |__| |___| |___| |\  | | | |  _ < | | |___ | |  | |   | |
 |____/|_____\____|_____|_| \_| |_| |_| \_\___\____|___| |_|   |_|`;

  function setScreen(name) {
    Object.entries(screens).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
  }

  function glitch(callback, delay = 220) {
    document.body.classList.add('glitching');
    window.setTimeout(() => {
      callback?.();
      window.setTimeout(() => document.body.classList.remove('glitching'), 220);
    }, delay);
  }

  function detectWebGPU() {
    state.webgpu = !!navigator.gpu;
    const pill = $('#gpu-state');
    const world = $('#world-state');
    if (state.webgpu) {
      pill.textContent = 'WEBGPU: AVAILABLE';
      world.textContent = 'renderer reserved';
    } else {
      pill.textContent = 'WEBGPU: UNAVAILABLE';
      world.textContent = 'fallback required';
    }
  }

  async function boot() {
    detectWebGPU();
    const log = $('#boot-log');
    const bar = $('#boot-progress i');
    const cold = !sessionStorage.getItem('decentricity.booted');
    const gpuMsg = state.webgpu ? 'navigator.gpu present' : 'navigator.gpu not present';
    const lines = cold ? [
      'DECENTRICITY ROM monitor 26.09',
      'CPU0: browser execution context ................................ OK',
      'RAM: allocating personal-memory map ............................ OK',
      'MOUNT /home .................................................... OK',
      'MOUNT /projects ................................................ OK',
      'MOUNT /archive ................................................. OK',
      'INDEX 18 curated project records ............................... OK',
      'LOAD retraux-shell.service ..................................... OK',
      `PROBE webgpu0: ${gpuMsg}`,
      'SPAWN nftworld.service ......................................... STAGED',
      'SPAWN hedgeyos-display.service ................................. STAGED',
      'NOTE graphical renderers are reserved for a later build',
      'START display-manager .......................................... OK',
      'SYSTEM READY.'
    ] : [
      'DECENTRICITY warm boot',
      'Restoring terminal state ....................................... OK',
      `webgpu0: ${gpuMsg}`,
      'Display manager ready.'
    ];

    let cancelled = false;
    $('#skip-boot').onclick = () => { cancelled = true; finishBoot(); };
    document.addEventListener('keydown', function bootEscape(e) {
      if (e.key === 'Escape' && !screens.boot.classList.contains('hidden')) {
        cancelled = true;
        finishBoot();
        document.removeEventListener('keydown', bootEscape);
      }
    });

    log.textContent = '';
    for (let i = 0; i < lines.length; i++) {
      if (cancelled) return;
      log.textContent += lines[i] + '\n';
      bar.style.width = `${Math.round(((i + 1) / lines.length) * 100)}%`;
      await wait(cold ? 170 + Math.random() * 110 : 90);
    }
    await wait(cold ? 420 : 120);
    finishBoot();
  }

  function finishBoot() {
    sessionStorage.setItem('decentricity.booted', '1');
    glitch(() => setScreen('selector'));
  }

  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function selectInterface(which) {
    if (which === 'shell') {
      glitch(() => {
        setScreen('terminal');
        navigate('home');
        window.setTimeout(() => commandInput.focus(), 80);
      });
      return;
    }
    showReserved(which);
  }

  function showReserved(which) {
    const isWorld = which === 'world';
    $('#message-code').textContent = isWorld ? 'DISPLAY:WORLD' : 'DISPLAY:HEDGEYOS';
    $('#message-title').textContent = isWorld ? 'WORLD RENDERER RESERVED' : 'HEDGEYOS RENDERER RESERVED';
    $('#message-copy').textContent = isWorld
      ? `The world UI belongs here next. ${state.webgpu ? 'This browser exposes WebGPU and will be eligible for the full renderer.' : 'This browser does not currently expose WebGPU, so the future build will keep the terminal available as the fallback.'}`
      : 'The HedgeyOS-style window manager belongs here next. Project icons will open dossiers containing GitHub, live-site, presentation and archival links.';
    glitch(() => setScreen('message'));
  }

  function navigate(route, opts = {}) {
    if (!routes.includes(route)) route = 'home';
    state.previousRoute = state.route;
    state.route = route;
    state.path = route === 'home' ? '/home' : `/${route}`;
    breadcrumb.textContent = `SYS:${state.path.toUpperCase()}`;
    panelTitle.textContent = `${routeNames[route]} // ${new Date().getFullYear()}`;
    $$('.rail-item').forEach(btn => btn.classList.toggle('active', btn.dataset.route === route));
    renderRoute(route, opts);
  }

  function renderRoute(route, opts = {}) {
    if (route === 'home') return renderHome();
    if (route === 'projects') return renderProjects(opts.family);
    if (route === 'families') return renderFamilies();
    if (route === 'timeline') return renderTimeline();
    if (route === 'archive') return renderArchive();
    if (route === 'about') return renderAbout();
    if (route === 'interfaces') return renderInterfaces();
  }

  function renderHome() {
    panel.innerHTML = `
      <div class="hero-terminal">
        <pre class="ascii">${escapeHtml(ascii)}</pre>
        <h2>PANDU'S MACHINE, NOT PANDU'S RÉSUMÉ.</h2>
        <p>A terminal-first personal archive, laboratory and map of projects. This 2026 revision merges the compact cyberpunk homepage, the old decentri.city corpus and current project work into one underlying system.</p>
      </div>
      <div class="menu-list">
        ${menuRow('1', 'PROJECTS', 'Browse individual builds and experiments', '18 records', 'projects')}
        ${menuRow('2', 'PROJECT FAMILIES', 'Follow lineages rather than repository names', '6 families', 'families')}
        ${menuRow('3', 'TIMELINE', 'Move through eras of work', '2007 → 2026', 'timeline')}
        ${menuRow('4', 'WRITING + ARCHIVE', 'Old site essays, reviews and preservation mirror', 'mounted', 'archive')}
        ${menuRow('5', 'ABOUT / SYSTEM ID', 'Short professional identity; the CV is one file, not the site', 'human', 'about')}
        ${menuRow('6', 'DISPLAY MANAGER', 'Shell now; World and HedgeyOS next', '3 UIs', 'interfaces')}
      </div>`;
    bindMenuRoutes();
    setStatus('Select a menu item, press 1–6, or type HELP.');
  }

  function menuRow(key, title, detail, meta, route) {
    return `<button class="menu-row" type="button" data-go="${route}"><span class="menu-key">${key}</span><span class="menu-main"><strong>${title}</strong><small>${detail}</small></span><span class="menu-meta">${meta}</span></button>`;
  }

  function bindMenuRoutes() {
    $$('[data-go]', panel).forEach(btn => btn.onclick = () => navigate(btn.dataset.go));
  }

  function renderProjects(family = null) {
    const projects = family ? data.projects.filter(p => p.family === family) : data.projects;
    const fam = family ? data.families.find(f => f.id === family) : null;
    panel.innerHTML = `
      ${fam ? `<div class="hero-terminal"><h2>${escapeHtml(fam.title)}</h2><p>${escapeHtml(fam.description)}</p><button class="inline-button" data-all-projects type="button">SHOW ALL PROJECTS</button></div>` : ''}
      <div class="menu-list" id="projects-list">
        ${projects.map((p, i) => `<button class="menu-row project-row" type="button" data-project="${p.id}"><span class="menu-key">${String(i + 1).padStart(2,'0')}</span><span class="menu-main"><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml(p.summary)}</small></span><span class="menu-meta">${escapeHtml(p.status)} · ${p.year}</span></button>`).join('')}
      </div>`;
    $$('[data-project]', panel).forEach(btn => btn.onclick = () => renderProject(btn.dataset.project));
    $('[data-all-projects]', panel)?.addEventListener('click', () => renderProjects());
    setStatus(`${projects.length} project dossiers. Type OPEN <name> or use the menu.`);
  }

  function renderProject(id) {
    const p = data.projects.find(x => x.id === id);
    if (!p) return terminalError(`project not found: ${id}`);
    const fam = data.families.find(f => f.id === p.family);
    panelTitle.textContent = `PROJECT // ${p.title.toUpperCase()}`;
    breadcrumb.textContent = `SYS:/PROJECTS/${p.id.toUpperCase()}`;
    panel.innerHTML = `
      <article class="project-view">
        <div class="project-head">
          <div><div class="eyebrow">${escapeHtml(fam?.title || p.family)}</div><h2>${escapeHtml(p.title)}</h2></div>
          <div class="badges"><span class="badge">${escapeHtml(p.status)}</span><span class="badge">${p.year}</span>${p.tech.map(t => `<span class="badge">${escapeHtml(t)}</span>`).join('')}</div>
        </div>
        <p class="project-summary">${escapeHtml(p.summary)}</p>
        <p class="project-notes">${escapeHtml(p.notes)}</p>
        <dl class="kv"><dt>FAMILY</dt><dd>${escapeHtml(fam?.title || p.family)}</dd><dt>STATUS</dt><dd>${escapeHtml(p.status)}</dd><dt>YEAR</dt><dd>${p.year}</dd><dt>RECORD</dt><dd>/projects/${escapeHtml(p.id)}</dd></dl>
        <div class="project-links">${p.links.length ? p.links.map(l => `<a class="link-button" href="${escapeAttr(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)} ↗</a>`).join('') : '<span class="badge">PUBLIC LINK NOT EXPOSED</span>'}<button class="inline-button" data-back-projects type="button">← PROJECT INDEX</button></div>
      </article>`;
    $('[data-back-projects]', panel).onclick = () => navigate('projects');
    setStatus(`OPEN ${p.id} // ${p.links.length} external link${p.links.length === 1 ? '' : 's'}`);
  }

  function renderFamilies() {
    panel.innerHTML = `<div class="section-grid">${data.families.map((f, i) => {
      const count = data.projects.filter(p => p.family === f.id).length;
      return `<article class="data-card"><h3>${String(i+1).padStart(2,'0')} // ${escapeHtml(f.title)}</h3><p>${escapeHtml(f.description)}</p><button type="button" data-family="${f.id}">OPEN ${count} PROJECT${count === 1 ? '' : 'S'}</button></article>`;
    }).join('')}</div>`;
    $$('[data-family]', panel).forEach(btn => btn.onclick = () => { navigate('projects', {family: btn.dataset.family}); });
    setStatus('Project families are idea lineages; repositories are evidence underneath them.');
  }

  function renderTimeline() {
    panel.innerHTML = `<div class="timeline">${data.timeline.map(item => `<article class="timeline-item"><time>${escapeHtml(item.year)}</time><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></article>`).join('')}</div>`;
    setStatus('Timeline is intentionally era-based; detailed event logs come later.');
  }

  function renderArchive() {
    panel.innerHTML = `
      <div class="hero-terminal"><h2>ARCHIVE MOUNTED READ-ONLY</h2><p>The old site is not treated as obsolete garbage. Its reviews, essays, presentations, media and weird historical debris remain part of the machine, while the literal Google Sites mirror stays preserved separately.</p></div>
      <div class="section-grid">${data.archive.map((a, i) => `<article class="data-card"><h3>${String(i+1).padStart(2,'0')} // ${escapeHtml(a.title)}</h3><p>${escapeHtml(a.detail)}</p><a class="link-button" href="${escapeAttr(a.href)}" ${a.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>OPEN ↗</a></article>`).join('')}</div>`;
    setStatus('/archive is mounted from the preserved decentri.city corpus.');
  }

  function renderAbout() {
    panel.innerHTML = `
      <div class="hero-terminal"><h2>PANDU SASTROWARDOYO // DECENTRICITY</h2><p>Engineer, entrepreneur, researcher and maker working across AI, decentralized systems, tiny computers, XR, computational neuroscience and deliberately strange personal software.</p></div>
      <div class="section-grid">
        <article class="data-card"><h3>SYSTEM PHILOSOPHY</h3><p>This site is a personal machine rather than a conventional portfolio. The résumé is one artifact inside a larger map of work.</p></article>
        <article class="data-card"><h3>PUBLIC SOURCE</h3><p>The project layer is seeded from public GitHub work and the preserved old website. Private repositories are not exposed automatically.</p><a class="link-button" href="https://github.com/Decentricity" target="_blank" rel="noopener">GITHUB ↗</a></article>
        <article class="data-card"><h3>LEGACY</h3><p>Earlier Decentricity material covers decentralization, transhumanism, reviews, media, metaverse spaces and the RobotPuisi-era bot children.</p><button type="button" data-go="archive">OPEN ARCHIVE</button></article>
      </div>`;
    bindMenuRoutes();
    setStatus('WHOAMI returns the short system identity.');
  }

  function renderInterfaces() {
    panel.innerHTML = `
      <div class="section-grid">
        <article class="data-card"><h3>$_ SHELL // ONLINE</h3><p>Retraux menu system with mouse-aware rows and a small command language. This is the first fully deployed interface.</p><button type="button" data-display="selector">DISPLAY SELECTOR</button></article>
        <article class="data-card"><h3>▣ HEDGEYOS // RESERVED</h3><p>Window-manager UI. Projects will appear as desktop icons and open dossier windows with external links.</p><button type="button" data-display="desktop">PROBE MODULE</button></article>
        <article class="data-card"><h3>◎ WORLD // RESERVED</h3><p>NFTMassacre-style world. Projects will spawn outside the main house. Full renderer will require WebGPU.</p><button type="button" data-display="world">PROBE MODULE</button></article>
      </div>`;
    $$('[data-display]', panel).forEach(btn => btn.onclick = () => {
      if (btn.dataset.display === 'selector') glitch(() => setScreen('selector'));
      else showReserved(btn.dataset.display);
    });
    setStatus(`WEBGPU=${state.webgpu ? 'yes' : 'no'} // shell renderer active`);
  }

  function setStatus(text) { statusLine.textContent = text; }

  function terminalError(message) {
    panelTitle.textContent = 'COMMAND ERROR';
    panel.innerHTML = `<div class="cli-output"><p class="error">ERROR: ${escapeHtml(message)}</p><p class="dim">Type HELP for available commands.</p></div>`;
    setStatus('Command failed.');
  }

  function renderCli(command, output, error = false) {
    panelTitle.textContent = `COMMAND // ${command.toUpperCase()}`;
    panel.innerHTML = `<div class="cli-output"><p class="cmd">SYS:&gt; ${escapeHtml(command)}</p><pre class="${error ? 'error' : ''}">${escapeHtml(output)}</pre></div>`;
    setStatus(error ? 'Command returned an error.' : 'Command complete. F3 returns to the previous menu.');
  }

  function execute(raw) {
    const command = raw.trim();
    if (!command) return;
    state.history.push(command);
    state.historyIndex = state.history.length;
    const [verbRaw, ...args] = tokenize(command);
    const verb = (verbRaw || '').toLowerCase();
    const arg = args.join(' ');

    const aliases = { dir: 'ls', cls: 'clear', '?': 'help', menu: 'home' };
    const v = aliases[verb] || verb;

    if (v === 'help') return renderCli(command, helpText());
    if (v === 'man') return renderCli(command, man(args[0]));
    if (v === 'clear') { panel.innerHTML = ''; panelTitle.textContent = 'CLEAR'; return; }
    if (v === 'home') return navigate('home');
    if (v === 'projects') return navigate('projects');
    if (v === 'families') return navigate('families');
    if (v === 'timeline') return navigate('timeline');
    if (v === 'archive') return navigate('archive');
    if (v === 'about' || v === 'whoami') return v === 'whoami' ? renderCli(command, 'Pandu Sastrowardoyo // Decentricity\nEngineer · entrepreneur · researcher · maker') : navigate('about');
    if (v === 'pwd') return renderCli(command, state.path);
    if (v === 'ls') return renderCli(command, ls(arg || state.path));
    if (v === 'cd') return cd(arg || '/home');
    if (v === 'cat') return cat(arg);
    if (v === 'open') return openProject(arg);
    if (v === 'ui' || v === 'display') { glitch(() => setScreen('selector')); return; }
    if (v === 'world') return showReserved('world');
    if (v === 'desktop' || v === 'hedgeyos') return showReserved('desktop');
    if (v === 'shell') return navigate('home');
    if (v === 'history') return renderCli(command, state.history.map((h,i) => `${String(i+1).padStart(3,' ')}  ${h}`).join('\n'));
    if (v === 'date') return renderCli(command, new Date().toString());
    if (v === 'reboot') { sessionStorage.removeItem('decentricity.booted'); location.reload(); return; }
    if (v === 'echo') return renderCli(command, arg);

    return renderCli(command, `command not found: ${verb}\nType HELP for available commands.`, true);
  }

  function helpText() {
    return `DECENTRICITY/400 command summary\n\nNAVIGATION\n  home              main menu\n  projects          project index\n  families          project lineages\n  timeline          era timeline\n  archive           old-site archive mount\n  about             system identity\n\nSHELL\n  ls [path]         list virtual directory\n  cd <path>         change virtual directory/menu\n  pwd               print current virtual path\n  cat <record>      print project summary\n  open <project>    open a project dossier by id or title\n  man <command>     command help\n  history           command history\n  clear             clear panel\n\nDISPLAY\n  ui | display      display selector\n  world             probe World UI (reserved)\n  desktop           probe HedgeyOS UI (reserved)\n  shell             return to shell\n\nSYSTEM\n  whoami            short identity\n  date              browser date/time\n  reboot            cold-boot animation`;
  }

  function man(name = '') {
    const docs = {
      ls: 'LS [path]\nLists the virtual filesystem. Try: ls /, ls /projects, ls /archive',
      cd: 'CD <path>\nChanges the current virtual location and opens the corresponding menu.',
      open: 'OPEN <project>\nOpens a project dossier. IDs work best: open tamp, open hedgeyos-mini',
      cat: 'CAT <project>\nPrints a compact project record without changing the menu.',
      ui: 'UI\nOpens the three-interface display selector.',
      reboot: 'REBOOT\nClears the session boot flag and reruns the full cold boot.'
    };
    if (!name) return 'MAN requires a command. Try MAN LS, MAN OPEN, MAN UI.';
    return docs[name.toLowerCase()] || `No manual entry for ${name}.`;
  }

  function ls(path) {
    const p = normalizePath(path);
    if (p === '/') return 'about/\narchive/\ninterfaces/\nprojects/\ntimeline/\nREADME.sys';
    if (p === '/projects') return data.projects.map(x => `${x.id}/`).join('\n');
    if (p === '/archive') return data.archive.map((x, i) => `${String(i+1).padStart(2,'0')}  ${x.title}`).join('\n');
    if (p.startsWith('/projects/')) {
      const id = p.split('/')[2];
      const project = data.projects.find(x => x.id === id);
      return project ? 'README\nlinks\nmetadata' : `ls: cannot access ${p}: no such project`;
    }
    return `ls: cannot access ${p}: no such virtual directory`;
  }

  function cd(path) {
    const p = normalizePath(path);
    const map = {'/':'home','/home':'home','/projects':'projects','/families':'families','/timeline':'timeline','/archive':'archive','/about':'about','/interfaces':'interfaces'};
    if (map[p]) return navigate(map[p]);
    if (p.startsWith('/projects/')) {
      const id = p.split('/')[2];
      if (data.projects.some(x => x.id === id)) { state.path = p; return renderProject(id); }
    }
    renderCli(`cd ${path}`, `cd: ${path}: no such virtual directory`, true);
  }

  function cat(name) {
    if (!name) return renderCli('cat', 'cat: missing record name', true);
    const p = findProject(name.replace(/^\/projects\//,''));
    if (!p) return renderCli(`cat ${name}`, `cat: ${name}: record not found`, true);
    const fam = data.families.find(f => f.id === p.family);
    return renderCli(`cat ${name}`, `${p.title}\n${'='.repeat(p.title.length)}\nSTATUS  ${p.status}\nYEAR    ${p.year}\nFAMILY  ${fam?.title || p.family}\n\n${p.summary}\n\n${p.notes}\n\nLINKS\n${p.links.length ? p.links.map(l => `- ${l.label}: ${l.url}`).join('\n') : '- no public link exposed'}`);
  }

  function openProject(name) {
    if (!name) return renderCli('open', 'open: missing project name', true);
    const p = findProject(name);
    if (!p) return renderCli(`open ${name}`, `open: project not found: ${name}`, true);
    navigate('projects');
    renderProject(p.id);
  }

  function findProject(query) {
    const q = query.toLowerCase().trim();
    return data.projects.find(p => p.id === q)
      || data.projects.find(p => p.title.toLowerCase() === q)
      || data.projects.find(p => p.title.toLowerCase().includes(q));
  }

  function normalizePath(path) {
    let p = path.trim();
    if (!p.startsWith('/')) p = `/${p}`;
    p = p.replace(/\/+$/, '') || '/';
    return p.toLowerCase();
  }

  function tokenize(input) {
    const matches = input.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    return matches.map(x => x.replace(/^"|"$/g, ''));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function escapeAttr(value) { return escapeHtml(value); }

  const interfaceCards = $$('.interface-card');
  function updateSelector() {
    interfaceCards.forEach((card, i) => card.classList.toggle('selected', i === state.selectorIndex));
  }
  interfaceCards.forEach((card, i) => card.addEventListener('click', () => { state.selectorIndex = i; updateSelector(); selectInterface(card.dataset.interface); }));

  $$('.rail-item').forEach(btn => btn.onclick = () => navigate(btn.dataset.route));

  commandForm.addEventListener('submit', e => {
    e.preventDefault();
    const value = commandInput.value;
    commandInput.value = '';
    execute(value);
  });

  document.addEventListener('keydown', e => {
    if (!screens.selector.classList.contains('hidden')) {
      if (e.key === 'ArrowRight') { state.selectorIndex = Math.min(2, state.selectorIndex + 1); updateSelector(); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { state.selectorIndex = Math.max(0, state.selectorIndex - 1); updateSelector(); e.preventDefault(); }
      if (['1','2','3'].includes(e.key)) { state.selectorIndex = Number(e.key) - 1; updateSelector(); selectInterface(interfaceCards[state.selectorIndex].dataset.interface); }
      if (e.key === 'Enter') selectInterface(interfaceCards[state.selectorIndex].dataset.interface);
      return;
    }

    if (!screens.terminal.classList.contains('hidden')) {
      if (e.key === 'F1') { e.preventDefault(); renderCli('help', helpText()); }
      if (e.key === 'F3') { e.preventDefault(); navigate(state.previousRoute || 'home'); }
      if (e.key === 'F5') { e.preventDefault(); renderRoute(state.route); }
      if (e.key === 'F9') { e.preventDefault(); commandInput.focus(); }
      if (e.key === '/' && document.activeElement !== commandInput) { e.preventDefault(); commandInput.focus(); }
      if (e.key === 'Escape') navigate('home');

      if (document.activeElement !== commandInput && state.route === 'home' && /^[1-6]$/.test(e.key)) {
        const target = ['projects','families','timeline','archive','about','interfaces'][Number(e.key)-1];
        navigate(target);
      }
    }

    if (document.activeElement === commandInput) {
      if (e.key === 'ArrowUp') {
        if (!state.history.length) return;
        e.preventDefault();
        state.historyIndex = Math.max(0, state.historyIndex - 1);
        commandInput.value = state.history[state.historyIndex] || '';
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.historyIndex = Math.min(state.history.length, state.historyIndex + 1);
        commandInput.value = state.history[state.historyIndex] || '';
      }
    }
  });

  $('#message-return').onclick = () => glitch(() => { setScreen('terminal'); commandInput.focus(); });

  function tickClock() {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], {hour12:false});
  }
  tickClock();
  window.setInterval(tickClock, 1000);

  boot();
})();
