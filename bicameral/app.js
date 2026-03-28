const FILES_STORAGE_KEY = "bicameral.ide.files.v5";
const LAYOUT_STORAGE_KEY = "bicameral.ide.layout.v5";
const PROMPT_LOG_KEY = "bicameral.ide.prompt.v4";
const FILE_ORDER = ["index.html", "styles.css", "app.js"];
const GRAPH_ORDER = ["view", "style", "value", "event", "function", "binding", "effect"];
const KIND_COLORS = {
  view: "#94b7ff",
  style: "#7fd7ff",
  value: "#5fd0a5",
  event: "#ffca62",
  function: "#ff7d6b",
  effect: "#79a8ff",
  binding: "#cf9bff"
};
const DOM_MUTATION_METHODS = new Set([
  "append",
  "appendChild",
  "before",
  "after",
  "prepend",
  "remove",
  "removeChild",
  "replaceChildren",
  "replaceWith",
  "insertAdjacentHTML",
  "setAttribute",
  "removeAttribute"
]);
const CLASSLIST_METHODS = new Set(["add", "remove", "toggle", "replace"]);
const EFFECT_PREFIXES = [
  "fetch",
  "localStorage.",
  "sessionStorage.",
  "history.",
  "console.",
  "navigator.clipboard.",
  "window.open",
  "location.",
  "setTimeout",
  "setInterval",
  "clearTimeout",
  "clearInterval",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "alert",
  "confirm",
  "prompt"
];

const DEFAULT_FILES = {
  "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bicameral Demo</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="shell">
    <section class="card">
      <header class="card-header">
        <h1>Bicameral Demo</h1>
        <p id="task-status">Nothing loaded yet.</p>
      </header>

      <form id="task-form" class="composer">
        <input id="task-input" type="text" placeholder="What should Bicameral track?">
        <button type="submit">Add task</button>
      </form>

      <ul id="task-list" class="task-list"></ul>
    </section>
  </main>

  <script src="app.js"></script>
</body>
</html>`,
  "styles.css": `:root {
  color-scheme: dark;
  --bg: #0c1322;
  --panel: #141f36;
  --border: rgba(255, 255, 255, 0.14);
  --text: #edf4ff;
  --muted: #9cb1d1;
  --accent: #7ec7ff;
  --good: #5fd0a5;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: "Segoe UI", system-ui, sans-serif;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(126, 199, 255, 0.14), transparent 28%),
    linear-gradient(180deg, #09111f 0%, var(--bg) 100%);
}

.shell {
  width: min(780px, calc(100vw - 32px));
  margin: 48px auto;
}

.card {
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 24px;
  background: linear-gradient(180deg, rgba(20, 31, 54, 0.96), rgba(13, 20, 34, 0.96));
}

.card-header h1 {
  margin: 0 0 6px;
}

.card-header p {
  margin: 0 0 18px;
  color: var(--muted);
}

.composer {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
}

.composer input,
.composer button {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
}

.composer button {
  cursor: pointer;
  background: linear-gradient(135deg, rgba(126, 199, 255, 0.22), rgba(95, 208, 165, 0.16));
}

.task-list {
  list-style: none;
  margin: 18px 0 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.task-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.04);
}

.task-row.done span {
  text-decoration: line-through;
  color: var(--muted);
}

.task-toggle {
  border: 1px solid rgba(95, 208, 165, 0.34);
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(95, 208, 165, 0.12);
  color: var(--good);
  cursor: pointer;
}`,
  "app.js": [
    'const refs = {',
    '  taskForm: document.querySelector("#task-form"),',
    '  taskInput: document.querySelector("#task-input"),',
    '  taskList: document.querySelector("#task-list"),',
    '  taskStatus: document.querySelector("#task-status")',
    '};',
    '',
    'let tasks = [];',
    'let filter = "all";',
    '',
    'function renderTasks() {',
    '  const visibleTasks = tasks.filter((task) => filter === "all" || !task.done);',
    '  refs.taskList.innerHTML = visibleTasks.map((task) =>',
    '    `<li class="task-row ${task.done ? "done" : ""}" data-task-id="${task.id}">\\n      <button class="task-toggle" type="button">${task.done ? "Undo" : "Done"}</button>\\n      <span>${task.label}</span>\\n    </li>`',
    '  ).join("");',
    '  refs.taskStatus.textContent = `${tasks.length} tasks in memory`;',
    '}',
    '',
    'function saveCache() {',
    '  localStorage.setItem("bicameral.tasks", JSON.stringify(tasks));',
    '}',
    '',
    'function loadCache() {',
    '  tasks = JSON.parse(localStorage.getItem("bicameral.tasks") || "[]");',
    '}',
    '',
    'function addTask(event) {',
    '  event.preventDefault();',
    '  const label = refs.taskInput.value.trim();',
    '  if (!label) return;',
    '  tasks = [{ id: makeId(), label, done: false }, ...tasks];',
    '  refs.taskInput.value = "";',
    '  renderTasks();',
    '  saveCache();',
    '}',
    '',
    'function toggleTask(taskId) {',
    '  tasks = tasks.map((task) => task.id === taskId ? { ...task, done: !task.done } : task);',
    '  renderTasks();',
    '  saveCache();',
    '}',
    '',
    'function makeId() {',
    '  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now());',
    '}',
    '',
    'document.addEventListener("DOMContentLoaded", () => {',
    '  loadCache();',
    '  renderTasks();',
    '});',
    '',
    'refs.taskForm.addEventListener("submit", addTask);',
    'refs.taskList.addEventListener("click", (event) => {',
    '  const row = event.target.closest("[data-task-id]");',
    '  if (!row) return;',
    '  toggleTask(row.dataset.taskId);',
    '});'
  ].join("\n")
};

const elements = {
  sourceEditor: document.querySelector("#sourceEditor"),
  sourceLineNumbers: document.querySelector("#sourceLineNumbers"),
  previewFrame: document.querySelector("#previewFrame"),
  selectionView: document.querySelector("#selectionView"),
  fileTabs: [...document.querySelectorAll("[data-file-tab]")],
  lowerTabs: [...document.querySelectorAll("[data-lower-tab]")],
  lowerPanes: [...document.querySelectorAll("[data-lower-pane]")],
  graphCanvas: document.querySelector("#graphCanvas"),
  graphSvg: document.querySelector("#graphSvg"),
  promptLog: document.querySelector("#promptLog"),
  promptInput: document.querySelector("#promptInput"),
  inspectorHeading: document.querySelector("#inspectorHeading"),
  inspectorKindPill: document.querySelector("#inspectorKindPill"),
  inspectorEmpty: document.querySelector("#inspectorEmpty"),
  inspectorContent: document.querySelector("#inspectorContent"),
  nodeIdField: document.querySelector("#nodeIdField"),
  nodeNameField: document.querySelector("#nodeNameField"),
  nodeNameLabel: document.querySelector("#nodeNameLabel"),
  nodePrimaryField: document.querySelector("#nodePrimaryField"),
  nodePrimaryLabel: document.querySelector("#nodePrimaryLabel"),
  nodeSecondaryField: document.querySelector("#nodeSecondaryField"),
  nodeSecondaryLabel: document.querySelector("#nodeSecondaryLabel"),
  nodeBodyField: document.querySelector("#nodeBodyField"),
  nodeBodyLabel: document.querySelector("#nodeBodyLabel"),
  nodeBodyHint: document.querySelector("#nodeBodyHint"),
  nodeLocationField: document.querySelector("#nodeLocationField"),
  edgeList: document.querySelector("#edgeList"),
  applyCodeButton: document.querySelector("#applyCodeButton"),
  resetWorkspaceButton: document.querySelector("#resetWorkspaceButton"),
  runPromptButton: document.querySelector("#runPromptButton"),
  helpPromptButton: document.querySelector("#helpPromptButton"),
  linkModeButton: document.querySelector("#linkModeButton"),
  autoLayoutButton: document.querySelector("#autoLayoutButton"),
  deleteNodeButton: document.querySelector("#deleteNodeButton"),
  sourceStatusText: document.querySelector("#sourceStatusText"),
  fileMetaText: document.querySelector("#fileMetaText"),
  secondaryMetaText: document.querySelector("#secondaryMetaText"),
  statusText: document.querySelector("#statusText"),
  selectionText: document.querySelector("#selectionText"),
  storageText: document.querySelector("#storageText"),
  syncPill: document.querySelector("#syncPill"),
  addKindButtons: [...document.querySelectorAll("[data-add-kind]")],
  exampleChips: [...document.querySelectorAll("[data-prompt]")]
};

let files = loadFiles();
let layout = loadLayout();
let promptLog = loadPromptLog();
let activeFile = "app.js";
let activeLowerTab = "preview";
let selectedNodeId = null;
let lastSuccessfulParse = null;
let parseError = "";
let sourceParseTimer = null;
let syncingSourceEditor = false;
let linkSourceId = null;

function boot() {
  if (!window.acorn || !window.acorn.walk) {
    setStatus("Parser libraries failed to load.", "error");
    return;
  }

  let initial;
  try {
    initial = parseSources(files);
  } catch (error) {
    console.error(error);
    elements.sourceStatusText.textContent = `Boot parse error: ${error.message}`;
    setStatus(`Boot parse error: ${error.message}`, "error");
    return;
  }
  lastSuccessfulParse = initial;
  selectedNodeId = initial.nodes[0] ? initial.nodes[0].id : null;
  renderPromptLog();
  syncSourceEditor();
  renderAll("Booted Bicameral in universal code-first mode.");
  bindEvents();
}

function bindEvents() {
  elements.sourceEditor.addEventListener("input", onSourceInput);
  elements.sourceEditor.addEventListener("scroll", () => {
    elements.sourceLineNumbers.scrollTop = elements.sourceEditor.scrollTop;
  });

  elements.fileTabs.forEach((button) => {
    button.addEventListener("click", () => setActiveFile(button.dataset.fileTab));
  });

  elements.lowerTabs.forEach((button) => {
    button.addEventListener("click", () => setLowerTab(button.dataset.lowerTab));
  });

  elements.applyCodeButton.addEventListener("click", () => applyCurrentSource("Applied source editor changes."));
  elements.resetWorkspaceButton.addEventListener("click", resetWorkspace);
  elements.runPromptButton.addEventListener("click", runPrompt);
  elements.helpPromptButton.addEventListener("click", showPromptHelp);
  elements.linkModeButton.addEventListener("click", enterLinkMode);
  elements.autoLayoutButton.addEventListener("click", () => {
    autoLayoutCurrentGraph();
    renderAll("Auto layout applied.");
  });
  elements.deleteNodeButton.addEventListener("click", deleteSelectedNode);

  elements.addKindButtons.forEach((button) => {
    button.addEventListener("click", () => addNodeFromGraph(button.dataset.addKind));
  });

  elements.exampleChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      elements.promptInput.value = chip.dataset.prompt;
      elements.promptInput.focus();
    });
  });

  elements.nodeNameField.addEventListener("change", applyInspectorChanges);
  elements.nodePrimaryField.addEventListener("change", applyInspectorChanges);
  elements.nodeSecondaryField.addEventListener("change", applyInspectorChanges);
  elements.nodeBodyField.addEventListener("change", applyInspectorChanges);

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && document.activeElement === elements.promptInput) {
      event.preventDefault();
      runPrompt();
    }
  });
}

function loadFiles() {
  try {
    const saved = JSON.parse(localStorage.getItem(FILES_STORAGE_KEY) || "null");
    if (!saved) {
      return { ...DEFAULT_FILES };
    }
    return {
      "index.html": typeof saved["index.html"] === "string" ? saved["index.html"] : DEFAULT_FILES["index.html"],
      "styles.css": typeof saved["styles.css"] === "string" ? saved["styles.css"] : DEFAULT_FILES["styles.css"],
      "app.js": typeof saved["app.js"] === "string" ? saved["app.js"] : DEFAULT_FILES["app.js"]
    };
  } catch (error) {
    return { ...DEFAULT_FILES };
  }
}

function loadLayout() {
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function loadPromptLog() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROMPT_LOG_KEY) || "null");
    if (Array.isArray(saved) && saved.length) {
      return saved;
    }
  } catch (error) {
    // Ignore invalid prompt history.
  }

  return [
    {
      role: "assistant",
      text: "Code is the source of truth. Bicameral parses real HTML, CSS, and JS into a semantic graph, and supported graph edits patch the source back."
    }
  ];
}

function saveFiles() {
  localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(files));
}

function saveLayout() {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

function savePromptLog() {
  localStorage.setItem(PROMPT_LOG_KEY, JSON.stringify(promptLog.slice(-24)));
}

function onSourceInput() {
  if (syncingSourceEditor) {
    return;
  }

  files[activeFile] = elements.sourceEditor.value;
  saveFiles();
  updateLineNumbers(elements.sourceEditor, elements.sourceLineNumbers);
  elements.sourceStatusText.textContent = `Editing ${activeFile}`;
  renderPreview();

  clearTimeout(sourceParseTimer);
  sourceParseTimer = setTimeout(() => {
    applyCurrentSource(`Parsed ${activeFile}.`);
  }, 320);
}

function setActiveFile(fileName) {
  activeFile = fileName;
  syncSourceEditor();
  renderEditorTabs();
}

function setLowerTab(tabId) {
  activeLowerTab = tabId;
  elements.lowerTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.lowerTab === tabId);
  });
  elements.lowerPanes.forEach((pane) => {
    pane.classList.toggle("active", pane.dataset.lowerPane === tabId);
  });
}

function syncSourceEditor() {
  syncingSourceEditor = true;
  elements.sourceEditor.value = files[activeFile];
  updateLineNumbers(elements.sourceEditor, elements.sourceLineNumbers);
  elements.sourceLineNumbers.scrollTop = elements.sourceEditor.scrollTop;
  elements.fileMetaText.textContent = `Editing ${activeFile}`;
  syncingSourceEditor = false;
  renderEditorTabs();
}

function renderEditorTabs() {
  elements.fileTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.fileTab === activeFile);
  });
}

function updateLineNumbers(textarea, gutter) {
  const count = Math.max(1, textarea.value.split("\n").length);
  gutter.textContent = Array.from({ length: count }, (_, index) => index + 1).join("\n");
}

function applyCurrentSource(statusMessage, selectionMatcher) {
  renderPreview();

  try {
    const parsed = parseSources(files);
    lastSuccessfulParse = parsed;
    parseError = "";
    if (typeof selectionMatcher === "function") {
      const matchedNode = parsed.nodes.find(selectionMatcher);
      if (matchedNode) {
        selectedNodeId = matchedNode.id;
      }
    }
    if (!parsed.nodes.find((node) => node.id === selectedNodeId)) {
      selectedNodeId = parsed.nodes[0] ? parsed.nodes[0].id : null;
    }
    renderAll(statusMessage);
  } catch (error) {
    parseError = error.message;
    elements.sourceStatusText.textContent = `Parse error: ${error.message}`;
    setStatus("Source parse failed. The graph is still showing the last valid parse.", "error");
    renderPreview();
    renderSelectionDetails();
  }
}

function renderAll(statusMessage) {
  renderEditorTabs();
  renderPreview();
  renderGraph();
  renderInspector();
  renderSelectionDetails();
  renderPromptLog();
  updateStorageStatus();
  if (statusMessage) {
    setStatus(statusMessage, "ok");
  }
  elements.sourceStatusText.textContent = parseError ? `Parse error: ${parseError}` : `${activeFile} is in sync`;
}

function updateStorageStatus() {
  const count = lastSuccessfulParse ? `${lastSuccessfulParse.nodes.length} nodes / ${lastSuccessfulParse.edges.length} edges` : "No parse available";
  elements.selectionText.textContent = selectedNodeId ? `Selected: ${selectedNodeId}` : "No node selected";
  elements.storageText.textContent = `Autosaving ${count}`;
}

function setStatus(message, tone) {
  elements.statusText.textContent = message;
  elements.syncPill.textContent = tone === "error" ? "Error" : tone === "warning" ? "Needs review" : "Synced";
  elements.syncPill.style.borderColor = tone === "error"
    ? "rgba(255, 125, 107, 0.42)"
    : tone === "warning"
      ? "rgba(255, 202, 98, 0.42)"
      : "rgba(95, 208, 165, 0.42)";
  elements.syncPill.style.color = tone === "error"
    ? "#ffb2a9"
    : tone === "warning"
      ? "#ffda91"
      : "#baf0da";
}

function renderPreview() {
  elements.previewFrame.srcdoc = buildPreviewDocument(files);
}

function buildPreviewDocument(sourceFiles) {
  let html = sourceFiles["index.html"];
  const styles = `<style>${sourceFiles["styles.css"]}</style>`;
  const script = `<script>${sourceFiles["app.js"].replace(/<\/script>/g, "<\\/script>")}</script>`;

  if (html.includes("</head>")) {
    html = html.replace("</head>", `${styles}\n</head>`);
  } else {
    html = `${styles}\n${html}`;
  }

  html = html.replace(/<link[^>]+href=["']styles\.css["'][^>]*>\s*/i, "");
  html = html.replace(/<script[^>]+src=["']app\.js["'][^>]*><\/script>\s*/i, "");

  if (html.includes("</body>")) {
    html = html.replace("</body>", `${script}\n</body>`);
  } else {
    html = `${html}\n${script}`;
  }

  return html;
}

function parseSources(sourceFiles) {
  const html = parseHtmlSource(sourceFiles["index.html"]);
  const css = parseCssSource(sourceFiles["styles.css"], html);
  const js = parseJavaScriptSource(sourceFiles["app.js"], html);
  const nodes = applyLayout([...html.nodes, ...css.nodes, ...js.nodes]);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = dedupeEdges([...css.edges, ...js.edges].filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)));

  return {
    html,
    css,
    js,
    nodes,
    edges
  };
}

function parseHtmlSource(source) {
  const doc = new DOMParser().parseFromString(source, "text/html");
  const nodes = [];
  const selectorToId = new Map();

  [...doc.querySelectorAll("[id]")].forEach((element) => {
    const selector = `#${element.id}`;
    const snippet = extractHtmlSnippet(source, element.id);
    const id = uniqueNodeId(`view.${slugify(element.id)}`, nodes);
    nodes.push({
      id,
      kind: "view",
      label: selector,
      name: selector,
      selector,
      tagName: element.tagName.toLowerCase(),
      file: "index.html",
      line: snippet.line,
      snippet: snippet.text,
      readOnly: true,
      summary: `${element.tagName.toLowerCase()} in index.html`
    });
    selectorToId.set(selector, id);
  });

  return {
    source,
    doc,
    nodes,
    selectorToId
  };
}

function parseCssSource(source, htmlInfo) {
  const nodes = [];
  const edges = [];
  const rules = [];

  walkCssRules(source, 0, source.length, "", rules);

  rules.forEach((rule, index) => {
    const node = {
      id: `style.${slugify(rule.scope ? `${rule.scope}-${rule.selector}` : rule.selector)}-${index + 1}`,
      kind: "style",
      label: rule.selector,
      name: rule.selector,
      selector: rule.selector,
      scopeLabel: rule.scope || "global",
      file: "styles.css",
      line: rule.line,
      sourceRange: [rule.start, rule.end],
      selectorRange: [rule.selectorStart, rule.selectorEnd],
      bodyRange: [rule.bodyStart, rule.bodyEnd],
      bodyText: source.slice(rule.bodyStart, rule.bodyEnd).trim(),
      snippet: source.slice(rule.start, rule.end),
      readOnly: false,
      renameable: false,
      summary: rule.scope ? `${rule.scope}` : "global stylesheet rule"
    };
    nodes.push(node);

    splitCssSelectors(rule.selector).forEach((selector) => {
      try {
        [...htmlInfo.doc.querySelectorAll(selector)].forEach((element) => {
          if (!element.id) {
            return;
          }
          const viewId = htmlInfo.selectorToId.get(`#${element.id}`);
          if (viewId) {
            edges.push({ from: node.id, to: viewId, label: "styles" });
          }
        });
      } catch (error) {
        // Ignore unsupported selector fragments.
      }
    });
  });

  return {
    source,
    rules,
    nodes,
    edges
  };
}

function walkCssRules(source, start, end, scope, rules) {
  let cursor = start;
  while (cursor < end) {
    cursor = skipCssTrivia(source, cursor, end);
    if (cursor >= end) {
      break;
    }

    const headerStart = cursor;
    const headerEnd = findCssHeaderEnd(source, cursor, end);
    if (headerEnd === -1) {
      break;
    }

    const header = source.slice(headerStart, headerEnd).trim();
    if (!header) {
      cursor = headerEnd + 1;
      continue;
    }

    if (source[headerEnd] === ";") {
      cursor = headerEnd + 1;
      continue;
    }

    const blockEnd = findMatchingBrace(source, headerEnd, end);
    if (blockEnd === -1) {
      break;
    }

    if (header.startsWith("@")) {
      if (/^@(media|supports|layer|container|scope)\b/i.test(header)) {
        walkCssRules(source, headerEnd + 1, blockEnd, header, rules);
      }
      cursor = blockEnd + 1;
      continue;
    }

    rules.push({
      scope,
      selector: header,
      start: headerStart,
      end: blockEnd + 1,
      selectorStart: headerStart,
      selectorEnd: headerEnd,
      bodyStart: headerEnd + 1,
      bodyEnd: blockEnd,
      line: lineNumberFromIndex(source, headerStart)
    });

    cursor = blockEnd + 1;
  }
}

function skipCssTrivia(source, index, end) {
  let cursor = index;
  while (cursor < end) {
    if (/\s/.test(source[cursor])) {
      cursor += 1;
      continue;
    }
    if (source[cursor] === "/" && source[cursor + 1] === "*") {
      const close = source.indexOf("*/", cursor + 2);
      cursor = close === -1 ? end : close + 2;
      continue;
    }
    break;
  }
  return cursor;
}

function findCssHeaderEnd(source, start, end) {
  let cursor = start;
  let quote = "";
  let parenDepth = 0;
  while (cursor < end) {
    const char = source[cursor];
    const next = source[cursor + 1];

    if (quote) {
      if (char === "\\") {
        cursor += 2;
        continue;
      }
      if (char === quote) {
        quote = "";
      }
      cursor += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      const close = source.indexOf("*/", cursor + 2);
      cursor = close === -1 ? end : close + 2;
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      cursor += 1;
      continue;
    }

    if (char === "(") {
      parenDepth += 1;
      cursor += 1;
      continue;
    }

    if (char === ")" && parenDepth > 0) {
      parenDepth -= 1;
      cursor += 1;
      continue;
    }

    if (parenDepth === 0 && (char === "{" || char === ";")) {
      return cursor;
    }

    cursor += 1;
  }
  return -1;
}

function findMatchingBrace(source, openIndex, end) {
  let cursor = openIndex;
  let depth = 0;
  let quote = "";
  while (cursor < end) {
    const char = source[cursor];
    const next = source[cursor + 1];

    if (quote) {
      if (char === "\\") {
        cursor += 2;
        continue;
      }
      if (char === quote) {
        quote = "";
      }
      cursor += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      const close = source.indexOf("*/", cursor + 2);
      cursor = close === -1 ? end : close + 2;
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      cursor += 1;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return cursor;
      }
    }

    cursor += 1;
  }
  return -1;
}

function splitCssSelectors(selectorText) {
  const selectors = [];
  let current = "";
  let parenDepth = 0;
  let bracketDepth = 0;
  let quote = "";

  for (let index = 0; index < selectorText.length; index += 1) {
    const char = selectorText[index];

    if (quote) {
      current += char;
      if (char === "\\") {
        current += selectorText[index + 1] || "";
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "(") {
      parenDepth += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      current += char;
      continue;
    }
    if (char === "[") {
      bracketDepth += 1;
      current += char;
      continue;
    }
    if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += char;
      continue;
    }

    if (char === "," && parenDepth === 0 && bracketDepth === 0) {
      if (current.trim()) {
        selectors.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    selectors.push(current.trim());
  }

  return selectors;
}

function parseJavaScriptSource(source, htmlInfo) {
  const ast = acorn.parse(source, {
    ecmaVersion: "latest",
    sourceType: "script",
    locations: true
  });

  const context = {
    source,
    htmlInfo,
    domAliases: new Map(),
    nodes: [],
    edges: [],
    valueNodes: new Map(),
    functionNodes: new Map(),
    rawNodesById: new Map(),
    overlayNodes: [],
    overlayEdges: []
  };

  collectProgramDeclarations(ast, context);
  collectEventNodes(ast, context);
  collectSemanticOverlays(context);

  return {
    source,
    ast,
    domAliases: context.domAliases,
    nodes: [...context.nodes, ...context.overlayNodes],
    edges: [...context.edges, ...context.overlayEdges],
    valueNodes: context.valueNodes,
    functionNodes: context.functionNodes
  };
}

function collectProgramDeclarations(ast, context) {
  ast.body.forEach((statement) => {
    if (statement.type === "VariableDeclaration") {
      collectVariableDeclaration(statement, context, null, null);
      return;
    }

    if (statement.type === "FunctionDeclaration") {
      const node = createFunctionNodeFromDeclaration(statement, context, {
        path: statement.id ? statement.id.name : `anonymous-${statement.start}`,
        scopeLabel: "top level",
        collection: null,
        callPath: statement.id ? statement.id.name : null,
        declarationType: "functionDeclaration",
        renameStrategy: statement.id ? { type: "identifier", name: statement.id.name } : null
      });
      registerFunctionNode(context, node);
      return;
    }

    if (statement.type === "ClassDeclaration") {
      const className = statement.id ? statement.id.name : `Class${statement.start}`;
      const classNode = createFunctionNodeFromClass(statement, context, {
        path: className,
        scopeLabel: "top level",
        collection: null,
        renameStrategy: statement.id ? { type: "identifier", name: className } : null
      });
      registerFunctionNode(context, classNode);
      collectClassMembers(statement.body, className, classNode.id, context);
    }
  });
}

function collectVariableDeclaration(statement, context, parentPath, parentId) {
  const declaratorRanges = statement.declarations.map((declaration) => [declaration.start, declaration.end]);

  statement.declarations.forEach((declaration, index) => {
    if (declaration.id.type !== "Identifier") {
      return;
    }

    const name = declaration.id.name;
    const path = parentPath ? `${parentPath}.${name}` : name;
    const collection = {
      type: "variable-declarators",
      index,
      ranges: declaratorRanges,
      statementRange: [statement.start, statement.end]
    };

    registerDomAlias(context.domAliases, path, declaration.init, context.source);

    if (isFunctionLikeExpression(declaration.init)) {
      const node = createFunctionNodeFromFunctionLike(declaration, declaration.init, context, {
        path,
        scopeLabel: parentPath || "top level",
        collection,
        callPath: path,
        declarationType: "variableFunction",
        renameStrategy: { type: "identifier", name }
      });
      registerFunctionNode(context, node);
      if (parentId) {
        context.edges.push({ from: parentId, to: node.id, label: "contains" });
      }
      return;
    }

    if (declaration.init && declaration.init.type === "ClassExpression") {
      const classNode = createFunctionNodeFromClassExpression(declaration, declaration.init, context, {
        path,
        scopeLabel: parentPath || "top level",
        collection,
        renameStrategy: { type: "identifier", name }
      });
      registerFunctionNode(context, classNode);
      if (parentId) {
        context.edges.push({ from: parentId, to: classNode.id, label: "contains" });
      }
      collectClassMembers(declaration.init.body, path, classNode.id, context);
      return;
    }

    const valueNode = createValueNodeFromDeclarator(declaration, context, {
      path,
      scopeLabel: parentPath || "top level",
      collection,
      renameStrategy: { type: "identifier", name }
    });
    registerValueNode(context, valueNode);
    if (parentId) {
      context.edges.push({ from: parentId, to: valueNode.id, label: "contains" });
    }

    if (declaration.init && declaration.init.type === "ObjectExpression") {
      collectObjectMembers(declaration.init, path, valueNode.id, context);
    }
  });
}

function collectObjectMembers(objectExpression, parentPath, parentId, context) {
  const propertyRanges = objectExpression.properties
    .filter((property) => property.type === "Property")
    .map((property) => [property.start, property.end]);

  objectExpression.properties.forEach((property) => {
    if (property.type !== "Property") {
      return;
    }

    const propertyName = objectPropertyName(property);
    if (!propertyName) {
      return;
    }

    const index = propertyRanges.findIndex((range) => range[0] === property.start && range[1] === property.end);
    const path = `${parentPath}.${propertyName}`;
    const renameStrategy = property.key.type === "Identifier"
      ? { type: "path", path }
      : null;
    const collection = {
      type: "object-properties",
      index,
      ranges: propertyRanges,
      statementRange: [property.start, property.end]
    };

    registerDomAlias(context.domAliases, path, property.value, context.source);

    if (isFunctionProperty(property)) {
      const node = createFunctionNodeFromProperty(property, context, {
        path,
        scopeLabel: parentPath,
        collection,
        callPath: path,
        declarationType: "objectMethod",
        renameStrategy
      });
      registerFunctionNode(context, node);
      context.edges.push({ from: parentId, to: node.id, label: "contains" });
      return;
    }

    const valueNode = createValueNodeFromProperty(property, context, {
      path,
      scopeLabel: parentPath,
      collection,
      renameStrategy
    });
    registerValueNode(context, valueNode);
    context.edges.push({ from: parentId, to: valueNode.id, label: "contains" });

    if (property.value && property.value.type === "ObjectExpression") {
      collectObjectMembers(property.value, path, valueNode.id, context);
    }
  });
}

function collectClassMembers(classBody, classPath, parentId, context) {
  const methods = classBody.body.filter((entry) => entry.type === "MethodDefinition" || entry.type === "PropertyDefinition");
  const methodRanges = methods.map((entry) => [entry.start, entry.end]);

  methods.forEach((entry) => {
    if (entry.type !== "MethodDefinition") {
      return;
    }

    const methodName = objectPropertyName(entry);
    if (!methodName || !entry.value) {
      return;
    }

    const path = `${classPath}.${methodName}`;
    const collection = {
      type: "class-methods",
      index: methodRanges.findIndex((range) => range[0] === entry.start && range[1] === entry.end),
      ranges: methodRanges,
      statementRange: [entry.start, entry.end]
    };
    const renameStrategy = entry.static && entry.key.type === "Identifier"
      ? { type: "path", path }
      : null;

    const node = createFunctionNodeFromClassMethod(entry, context, {
      path,
      scopeLabel: classPath,
      collection,
      callPath: entry.static ? path : null,
      declarationType: "classMethod",
      renameStrategy
    });
    registerFunctionNode(context, node);
    context.edges.push({ from: parentId, to: node.id, label: "contains" });
  });
}

function registerDomAlias(domAliases, path, expression, source) {
  const selector = extractSelectorFromExpression(expression, source, domAliases);
  if (selector) {
    domAliases.set(path, selector);
  }
}

function registerValueNode(context, node) {
  context.nodes.push(node);
  context.rawNodesById.set(node.id, node);
  context.valueNodes.set(node.qualifiedName, node);
}

function registerFunctionNode(context, node) {
  context.nodes.push(node);
  context.rawNodesById.set(node.id, node);
  context.functionNodes.set(node.qualifiedName, node);
}

function createValueNodeFromDeclarator(declaration, context, options) {
  const source = context.source;
  const init = declaration.init;
  const hasInitializer = Boolean(init);
  const valueRange = hasInitializer ? [init.start, init.end] : [declaration.id.end, declaration.id.end];
  const bodyText = hasInitializer ? source.slice(init.start, init.end) : "undefined";
  return {
    id: `value.${options.path}`,
    kind: "value",
    label: options.path,
    name: leafName(options.path),
    qualifiedName: options.path,
    file: "app.js",
    line: declaration.loc.start.line,
    sourceRange: [declaration.start, declaration.end],
    nameRange: [declaration.id.start, declaration.id.end],
    valueRange,
    valueInsertMode: !hasInitializer,
    bodyText,
    snippet: source.slice(declaration.start, declaration.end),
    scopeLabel: options.scopeLabel,
    collection: options.collection,
    renameStrategy: options.renameStrategy,
    renameable: Boolean(options.renameStrategy),
    summary: options.scopeLabel === "top level" ? "top-level value" : `member of ${options.scopeLabel}`
  };
}

function createValueNodeFromProperty(property, context, options) {
  const source = context.source;
  return {
    id: `value.${options.path}`,
    kind: "value",
    label: options.path,
    name: leafName(options.path),
    qualifiedName: options.path,
    file: "app.js",
    line: property.loc.start.line,
    sourceRange: [property.start, property.end],
    nameRange: [property.key.start, property.key.end],
    valueRange: [property.value.start, property.value.end],
    valueInsertMode: false,
    bodyText: source.slice(property.value.start, property.value.end),
    snippet: source.slice(property.start, property.end),
    scopeLabel: options.scopeLabel,
    collection: options.collection,
    renameStrategy: options.renameStrategy,
    renameable: Boolean(options.renameStrategy),
    summary: `member of ${options.scopeLabel}`
  };
}

function createFunctionNodeFromDeclaration(statement, context, options) {
  const source = context.source;
  const bodyRange = functionBodyRange(statement);
  return {
    id: `function.${options.path}`,
    kind: "function",
    label: options.path,
    name: leafName(options.path),
    qualifiedName: options.path,
    callPath: options.callPath,
    file: "app.js",
    line: statement.loc.start.line,
    sourceRange: [statement.start, statement.end],
    nameRange: statement.id ? [statement.id.start, statement.id.end] : null,
    bodyRange,
    bodyStyle: statement.body && statement.body.type === "BlockStatement" ? "block" : "expression",
    bodyText: source.slice(bodyRange[0], bodyRange[1]).replace(/^\n+|\n+$/g, ""),
    snippet: source.slice(statement.start, statement.end),
    scopeLabel: options.scopeLabel,
    collection: options.collection,
    renameStrategy: options.renameStrategy,
    renameable: Boolean(options.renameStrategy),
    declarationType: options.declarationType,
    astNode: statement,
    summary: "top-level function"
  };
}

function createFunctionNodeFromFunctionLike(declaration, fn, context, options) {
  const source = context.source;
  const bodyRange = functionBodyRange(fn);
  return {
    id: `function.${options.path}`,
    kind: "function",
    label: options.path,
    name: leafName(options.path),
    qualifiedName: options.path,
    callPath: options.callPath,
    file: "app.js",
    line: declaration.loc.start.line,
    sourceRange: [declaration.start, declaration.end],
    nameRange: [declaration.id.start, declaration.id.end],
    bodyRange,
    bodyStyle: fn.body && fn.body.type === "BlockStatement" ? "block" : "expression",
    bodyText: source.slice(bodyRange[0], bodyRange[1]).replace(/^\n+|\n+$/g, ""),
    snippet: source.slice(declaration.start, declaration.end),
    scopeLabel: options.scopeLabel,
    collection: options.collection,
    renameStrategy: options.renameStrategy,
    renameable: Boolean(options.renameStrategy),
    declarationType: options.declarationType,
    astNode: fn,
    summary: options.scopeLabel === "top level" ? "top-level function value" : `callable member of ${options.scopeLabel}`
  };
}

function createFunctionNodeFromProperty(property, context, options) {
  const source = context.source;
  const fn = property.value;
  const bodyRange = functionBodyRange(fn);
  return {
    id: `function.${options.path}`,
    kind: "function",
    label: options.path,
    name: leafName(options.path),
    qualifiedName: options.path,
    callPath: options.callPath,
    file: "app.js",
    line: property.loc.start.line,
    sourceRange: [property.start, property.end],
    nameRange: property.key.type === "Identifier" ? [property.key.start, property.key.end] : null,
    bodyRange,
    bodyStyle: fn.body && fn.body.type === "BlockStatement" ? "block" : "expression",
    bodyText: source.slice(bodyRange[0], bodyRange[1]).replace(/^\n+|\n+$/g, ""),
    snippet: source.slice(property.start, property.end),
    scopeLabel: options.scopeLabel,
    collection: options.collection,
    renameStrategy: options.renameStrategy,
    renameable: Boolean(options.renameStrategy),
    declarationType: options.declarationType,
    astNode: fn,
    summary: `callable member of ${options.scopeLabel}`
  };
}

function createFunctionNodeFromClass(statement, context, options) {
  const source = context.source;
  const bodyRange = [statement.body.start + 1, statement.body.end - 1];
  return {
    id: `function.${options.path}`,
    kind: "function",
    label: `class ${options.path}`,
    name: options.path,
    qualifiedName: options.path,
    callPath: null,
    file: "app.js",
    line: statement.loc.start.line,
    sourceRange: [statement.start, statement.end],
    nameRange: statement.id ? [statement.id.start, statement.id.end] : null,
    bodyRange,
    bodyStyle: "block",
    bodyText: source.slice(bodyRange[0], bodyRange[1]).replace(/^\n+|\n+$/g, ""),
    snippet: source.slice(statement.start, statement.end),
    scopeLabel: options.scopeLabel,
    collection: options.collection,
    renameStrategy: options.renameStrategy,
    renameable: Boolean(options.renameStrategy),
    declarationType: "classDeclaration",
    astNode: statement,
    summary: "top-level class"
  };
}

function createFunctionNodeFromClassExpression(declaration, classExpression, context, options) {
  const source = context.source;
  const bodyRange = [classExpression.body.start + 1, classExpression.body.end - 1];
  return {
    id: `function.${options.path}`,
    kind: "function",
    label: `class ${options.path}`,
    name: options.path,
    qualifiedName: options.path,
    callPath: null,
    file: "app.js",
    line: declaration.loc.start.line,
    sourceRange: [declaration.start, declaration.end],
    nameRange: [declaration.id.start, declaration.id.end],
    bodyRange,
    bodyStyle: "block",
    bodyText: source.slice(bodyRange[0], bodyRange[1]).replace(/^\n+|\n+$/g, ""),
    snippet: source.slice(declaration.start, declaration.end),
    scopeLabel: options.scopeLabel,
    collection: options.collection,
    renameStrategy: options.renameStrategy,
    renameable: Boolean(options.renameStrategy),
    declarationType: "classDeclaration",
    astNode: classExpression,
    summary: options.scopeLabel === "top level" ? "top-level class value" : `class member of ${options.scopeLabel}`
  };
}

function createFunctionNodeFromClassMethod(method, context, options) {
  const source = context.source;
  const bodyRange = functionBodyRange(method.value);
  return {
    id: `function.${options.path}`,
    kind: "function",
    label: options.path,
    name: leafName(options.path),
    qualifiedName: options.path,
    callPath: options.callPath,
    file: "app.js",
    line: method.loc.start.line,
    sourceRange: [method.start, method.end],
    nameRange: method.key.type === "Identifier" ? [method.key.start, method.key.end] : null,
    bodyRange,
    bodyStyle: method.value.body && method.value.body.type === "BlockStatement" ? "block" : "expression",
    bodyText: source.slice(bodyRange[0], bodyRange[1]).replace(/^\n+|\n+$/g, ""),
    snippet: source.slice(method.start, method.end),
    scopeLabel: options.scopeLabel,
    collection: options.collection,
    renameStrategy: options.renameStrategy,
    renameable: Boolean(options.renameStrategy),
    declarationType: options.declarationType,
    astNode: method.value,
    summary: method.static ? `static method on ${options.scopeLabel}` : `instance method on ${options.scopeLabel}`
  };
}

function collectEventNodes(ast, context) {
  const eventCounts = new Map();

  acorn.walk.ancestor(ast, {
    CallExpression(node, ancestors) {
      if (!isEventListenerCall(node)) {
        return;
      }

      const statement = nearestStatement(ancestors);
      const selector = extractSelectorFromExpression(node.callee.object, context.source, context.domAliases)
        || context.source.slice(node.callee.object.start, node.callee.object.end);
      const eventType = literalOrSource(node.arguments[0], context.source);
      const handlerSource = literalOrSource(node.arguments[1], context.source);
      const baseId = `event.${slugify(selector)}.${slugify(eventType)}.${slugify(handlerSource)}`;
      const count = eventCounts.get(baseId) || 0;
      eventCounts.set(baseId, count + 1);
      const id = count ? `${baseId}-${count + 1}` : baseId;
      const resolved = resolveHandlerTarget(node.arguments[1], context);

      context.nodes.push({
        id,
        kind: "event",
        label: `${eventType} @ ${selector}`,
        name: `${eventType} @ ${selector}`,
        selector,
        eventType,
        handlerSource,
        handlerTargetId: resolved ? resolved.id : null,
        file: "app.js",
        line: statement ? statement.loc.start.line : node.loc.start.line,
        sourceRange: statement ? [statement.start, statement.end] : [node.start, node.end],
        snippet: context.source.slice(statement ? statement.start : node.start, statement ? statement.end : node.end),
        readOnly: false,
        renameable: false,
        summary: `listens on ${selector}`
      });

      const viewId = context.htmlInfo.selectorToId.get(selector);
      if (viewId) {
        context.edges.push({ from: viewId, to: id, label: "dispatches" });
      }
      if (resolved) {
        context.edges.push({ from: id, to: resolved.id, label: "triggers" });
      }
    }
  });
}

function collectSemanticOverlays(context) {
  context.functionNodes.forEach((functionNode) => {
    if (!functionNode.astNode || functionNode.declarationType === "classDeclaration") {
      return;
    }

    const analysis = analyzeFunctionNode(functionNode, context);
    analysis.valueReads.forEach((path) => {
      const valueNode = context.valueNodes.get(path);
      if (valueNode) {
        context.overlayEdges.push({ from: valueNode.id, to: functionNode.id, label: "feeds" });
      }
    });
    analysis.valueWrites.forEach((path) => {
      const valueNode = context.valueNodes.get(path);
      if (valueNode) {
        context.overlayEdges.push({ from: functionNode.id, to: valueNode.id, label: "writes" });
      }
    });
    analysis.functionCalls.forEach((path) => {
      const targetNode = context.functionNodes.get(path);
      if (targetNode && targetNode.id !== functionNode.id) {
        context.overlayEdges.push({ from: functionNode.id, to: targetNode.id, label: "calls" });
      }
    });
    analysis.overlayNodes.forEach((node) => context.overlayNodes.push(node));
    analysis.overlayEdges.forEach((edge) => context.overlayEdges.push(edge));
  });
}

function analyzeFunctionNode(functionNode, context) {
  const valueReads = new Set();
  const valueWrites = new Set();
  const functionCalls = new Set();
  const overlayNodes = [];
  const overlayEdges = [];
  const overlayKeys = new Set();
  const bodyNode = functionNode.astNode.body;
  const walkRoot = bodyNode && bodyNode.type === "BlockStatement" ? bodyNode : functionNode.astNode;
  const locals = collectLocalBindings(functionNode.astNode);

  acorn.walk.ancestor(walkRoot, {
    Identifier(node, ancestors) {
      const parent = ancestors[ancestors.length - 2];
      if (!isReferenceIdentifier(node, parent)) {
        return;
      }
      if (locals.has(node.name)) {
        return;
      }
      if (context.valueNodes.has(node.name)) {
        if (isWriteIdentifier(node, parent)) {
          valueWrites.add(node.name);
        } else {
          valueReads.add(node.name);
        }
      }
      if (context.functionNodes.has(node.name) && isCallCallee(node, parent)) {
        functionCalls.add(node.name);
      }
    },
    MemberExpression(node, ancestors) {
      const parent = ancestors[ancestors.length - 2];
      const path = expressionPath(node);
      if (!path) {
        return;
      }
      const root = rootIdentifier(path);
      if (locals.has(root)) {
        return;
      }
      const valuePath = longestMatchingPath(path, context.valueNodes);
      if (valuePath) {
        if (isWriteMemberExpression(node, parent)) {
          valueWrites.add(valuePath);
        } else {
          valueReads.add(valuePath);
        }
      }
      if (context.functionNodes.has(path) && isCallCallee(node, parent)) {
        functionCalls.add(path);
      }
    },
    AssignmentExpression(node, ancestors) {
      const statement = nearestStatement(ancestors);
      const target = resolveDomWriteTarget(node.left, context.source, context.domAliases);
      if (statement && target) {
        registerBindingOverlay(functionNode, statement, target, overlayNodes, overlayEdges, overlayKeys, context, locals);
      }
    },
    UpdateExpression(node, ancestors) {
      const statement = nearestStatement(ancestors);
      const target = resolveDomWriteTarget(node.argument, context.source, context.domAliases);
      if (statement && target) {
        registerBindingOverlay(functionNode, statement, target, overlayNodes, overlayEdges, overlayKeys, context, locals);
      }
    },
    CallExpression(node, ancestors) {
      if (isEventListenerCall(node)) {
        return;
      }
      const statement = nearestStatement(ancestors);
      if (!statement) {
        return;
      }
      const domTarget = resolveDomMutationTarget(node, context.source, context.domAliases);
      if (domTarget) {
        registerBindingOverlay(functionNode, statement, domTarget, overlayNodes, overlayEdges, overlayKeys, context, locals);
        return;
      }
      const effectLabel = effectLabelForCall(node, context);
      if (effectLabel) {
        registerEffectOverlay(functionNode, statement, effectLabel, overlayNodes, overlayEdges, overlayKeys, context, locals);
      }
    }
  });

  return {
    valueReads,
    valueWrites,
    functionCalls,
    overlayNodes,
    overlayEdges
  };
}

function registerBindingOverlay(ownerNode, statement, target, overlayNodes, overlayEdges, overlayKeys, context, locals) {
  const key = `binding:${ownerNode.id}:${statement.start}:${target.selector}:${target.label}`;
  if (overlayKeys.has(key)) {
    return;
  }
  overlayKeys.add(key);

  const id = `binding.${slugify(ownerNode.qualifiedName)}.${statement.loc.start.line}.${slugify(target.selector)}.${slugify(target.label)}`;
  const snippet = context.source.slice(statement.start, statement.end);
  const node = {
    id,
    kind: "binding",
    label: `${target.selector}.${target.label}`,
    name: `${target.selector}.${target.label}`,
    ownerPath: ownerNode.qualifiedName,
    targetSelector: target.selector,
    targetLabel: target.label,
    file: "app.js",
    line: statement.loc.start.line,
    sourceRange: [statement.start, statement.end],
    bodyRange: [statement.start, statement.end],
    bodyText: snippet,
    snippet,
    renameable: false,
    summary: `DOM write in ${ownerNode.qualifiedName}`
  };
  overlayNodes.push(node);
  overlayEdges.push({ from: ownerNode.id, to: node.id, label: "emits" });

  const viewId = context.htmlInfo.selectorToId.get(target.selector);
  if (viewId) {
    overlayEdges.push({ from: node.id, to: viewId, label: "targets" });
  }

  collectReferencedValuePaths(statement, context, locals).forEach((path) => {
    const valueNode = context.valueNodes.get(path);
    if (valueNode) {
      overlayEdges.push({ from: valueNode.id, to: node.id, label: "feeds" });
    }
  });
}

function registerEffectOverlay(ownerNode, statement, effectLabel, overlayNodes, overlayEdges, overlayKeys, context, locals) {
  const key = `effect:${ownerNode.id}:${statement.start}:${effectLabel}`;
  if (overlayKeys.has(key)) {
    return;
  }
  overlayKeys.add(key);

  const id = `effect.${slugify(ownerNode.qualifiedName)}.${statement.loc.start.line}.${slugify(effectLabel)}`;
  const snippet = context.source.slice(statement.start, statement.end);
  const node = {
    id,
    kind: "effect",
    label: effectLabel,
    name: effectLabel,
    ownerPath: ownerNode.qualifiedName,
    effectLabel,
    file: "app.js",
    line: statement.loc.start.line,
    sourceRange: [statement.start, statement.end],
    bodyRange: [statement.start, statement.end],
    bodyText: snippet,
    snippet,
    renameable: false,
    summary: `side effect in ${ownerNode.qualifiedName}`
  };
  overlayNodes.push(node);
  overlayEdges.push({ from: ownerNode.id, to: node.id, label: "emits" });

  collectReferencedValuePaths(statement, context, locals).forEach((path) => {
    const valueNode = context.valueNodes.get(path);
    if (valueNode) {
      overlayEdges.push({ from: valueNode.id, to: node.id, label: "feeds" });
    }
  });
}

function collectReferencedValuePaths(node, context, locals) {
  const paths = new Set();
  acorn.walk.ancestor(node, {
    Identifier(identifier, ancestors) {
      const parent = ancestors[ancestors.length - 2];
      if (!isReferenceIdentifier(identifier, parent) || locals.has(identifier.name)) {
        return;
      }
      if (context.valueNodes.has(identifier.name)) {
        paths.add(identifier.name);
      }
    },
    MemberExpression(memberExpression) {
      const path = expressionPath(memberExpression);
      if (!path) {
        return;
      }
      const root = rootIdentifier(path);
      if (locals.has(root)) {
        return;
      }
      const match = longestMatchingPath(path, context.valueNodes);
      if (match) {
        paths.add(match);
      }
    }
  });
  return paths;
}

function collectLocalBindings(fnNode) {
  const locals = new Set();
  if (fnNode.id && fnNode.id.name) {
    locals.add(fnNode.id.name);
  }
  (fnNode.params || []).forEach((param) => declarePatternNames(param, locals));

  const root = fnNode.body && fnNode.body.type === "BlockStatement" ? fnNode.body : fnNode;
  acorn.walk.simple(root, {
    VariableDeclaration(node) {
      node.declarations.forEach((declaration) => declarePatternNames(declaration.id, locals));
    },
    FunctionDeclaration(node) {
      if (node.id && node.id.name) {
        locals.add(node.id.name);
      }
    },
    ClassDeclaration(node) {
      if (node.id && node.id.name) {
        locals.add(node.id.name);
      }
    },
    CatchClause(node) {
      if (node.param) {
        declarePatternNames(node.param, locals);
      }
    }
  });

  return locals;
}

function declarePatternNames(pattern, names) {
  if (!pattern) {
    return;
  }
  if (pattern.type === "Identifier") {
    names.add(pattern.name);
    return;
  }
  if (pattern.type === "ArrayPattern") {
    pattern.elements.forEach((element) => declarePatternNames(element, names));
    return;
  }
  if (pattern.type === "ObjectPattern") {
    pattern.properties.forEach((property) => {
      if (property.type === "Property") {
        declarePatternNames(property.value, names);
      } else if (property.type === "RestElement") {
        declarePatternNames(property.argument, names);
      }
    });
    return;
  }
  if (pattern.type === "RestElement") {
    declarePatternNames(pattern.argument, names);
    return;
  }
  if (pattern.type === "AssignmentPattern") {
    declarePatternNames(pattern.left, names);
  }
}

function objectPropertyName(prop) {
  if (!prop || !prop.key) {
    return null;
  }
  if (prop.key.type === "Identifier") {
    return prop.key.name;
  }
  if (prop.key.type === "Literal" && typeof prop.key.value === "string") {
    return prop.key.value;
  }
  return null;
}

function isFunctionProperty(property) {
  return property && property.type === "Property" && isFunctionLikeExpression(property.value);
}

function isFunctionLikeExpression(node) {
  return Boolean(node) && (
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

function functionBodyRange(fn) {
  if (!fn || !fn.body) {
    return [fn.start, fn.end];
  }
  if (fn.body.type === "BlockStatement") {
    return [fn.body.start + 1, fn.body.end - 1];
  }
  return [fn.body.start, fn.body.end];
}

function literalOrSource(node, source) {
  if (!node) {
    return "";
  }
  if (node.type === "Literal") {
    return String(node.value);
  }
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return source.slice(node.start, node.end);
}

function expressionPath(node) {
  if (!node) {
    return null;
  }
  if (node.type === "Identifier") {
    return node.name;
  }
  if (node.type === "ThisExpression") {
    return "this";
  }
  if (node.type === "Super") {
    return "super";
  }
  if (node.type === "MemberExpression") {
    const objectPath = expressionPath(node.object);
    if (!objectPath) {
      return null;
    }
    if (!node.computed && node.property.type === "Identifier") {
      return `${objectPath}.${node.property.name}`;
    }
    if (node.computed && node.property.type === "Literal" && (typeof node.property.value === "string" || typeof node.property.value === "number")) {
      return `${objectPath}.${String(node.property.value)}`;
    }
  }
  return null;
}

function rootIdentifier(path) {
  return path.split(".")[0];
}

function leafName(path) {
  const parts = String(path).split(".");
  return parts[parts.length - 1];
}

function longestMatchingPath(path, nodeMap) {
  let candidate = path;
  while (candidate) {
    if (nodeMap.has(candidate)) {
      return candidate;
    }
    const dot = candidate.lastIndexOf(".");
    if (dot === -1) {
      return null;
    }
    candidate = candidate.slice(0, dot);
  }
  return null;
}

function extractSelectorFromExpression(expression, source, domAliases) {
  if (!expression) {
    return null;
  }

  if (
    expression.type === "CallExpression" &&
    expression.callee.type === "MemberExpression" &&
    expression.callee.object.type === "Identifier" &&
    expression.callee.object.name === "document" &&
    expression.arguments[0]
  ) {
    if (["querySelector", "querySelectorAll"].includes(expression.callee.property.name)) {
      const firstArg = expression.arguments[0];
      if (firstArg.type === "Literal") {
        return String(firstArg.value);
      }
      if (firstArg.type === "TemplateLiteral" && firstArg.expressions.length === 0) {
        return firstArg.quasis[0].value.cooked;
      }
    }
    if (expression.callee.property.name === "getElementById" && expression.arguments[0].type === "Literal") {
      return `#${expression.arguments[0].value}`;
    }
  }

  const path = expressionPath(expression);
  if (path && domAliases.has(path)) {
    return domAliases.get(path);
  }

  return null;
}

function resolveHandlerTarget(expression, context) {
  if (!expression) {
    return null;
  }

  const path = expressionPath(expression);
  if (path && context.functionNodes.has(path)) {
    return context.functionNodes.get(path);
  }

  if (expression.type === "ArrowFunctionExpression" || expression.type === "FunctionExpression") {
    let resolved = null;
    acorn.walk.simple(expression.body, {
      CallExpression(node) {
        if (resolved) {
          return;
        }
        const callPath = expressionPath(node.callee);
        if (callPath && context.functionNodes.has(callPath)) {
          resolved = context.functionNodes.get(callPath);
        }
      }
    });
    return resolved;
  }

  return null;
}

function resolveDomWriteTarget(target, source, domAliases) {
  if (!target || target.type !== "MemberExpression") {
    return null;
  }

  let current = target;
  const labels = [];
  while (current && current.type === "MemberExpression") {
    if (!current.computed && current.property.type === "Identifier") {
      labels.unshift(current.property.name);
    } else if (current.computed && current.property.type === "Literal") {
      labels.unshift(String(current.property.value));
    } else {
      return null;
    }
    current = current.object;
    const selector = extractSelectorFromExpression(current, source, domAliases);
    if (selector) {
      return {
        selector,
        label: labels.join(".") || "node"
      };
    }
  }

  return null;
}

function resolveDomMutationTarget(call, source, domAliases) {
  if (!call || call.callee.type !== "MemberExpression") {
    return null;
  }

  const methodName = memberPropertyName(call.callee.property, call.callee.computed);
  if (!methodName) {
    return null;
  }

  if (DOM_MUTATION_METHODS.has(methodName)) {
    const selector = extractSelectorFromExpression(call.callee.object, source, domAliases);
    if (selector) {
      return { selector, label: methodName };
    }
  }

  if (
    call.callee.object.type === "MemberExpression" &&
    !call.callee.object.computed &&
    call.callee.object.property.type === "Identifier" &&
    call.callee.object.property.name === "classList" &&
    CLASSLIST_METHODS.has(methodName)
  ) {
    const selector = extractSelectorFromExpression(call.callee.object.object, source, domAliases);
    if (selector) {
      return { selector, label: `classList.${methodName}` };
    }
  }

  return null;
}

function memberPropertyName(property, computed) {
  if (!computed && property.type === "Identifier") {
    return property.name;
  }
  if (computed && property.type === "Literal") {
    return String(property.value);
  }
  return null;
}

function effectLabelForCall(call, context) {
  const path = expressionPath(call.callee);
  if (!path) {
    return null;
  }
  if (context.functionNodes.has(path)) {
    return null;
  }
  if (path.endsWith(".addEventListener")) {
    return null;
  }
  if (EFFECT_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))) {
    return path;
  }
  return null;
}

function isEventListenerCall(node) {
  return Boolean(
    node &&
    node.callee &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "addEventListener" &&
    node.arguments.length >= 2
  );
}

function nearestStatement(ancestors) {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const candidate = ancestors[index];
    if (candidate && /Statement$/.test(candidate.type)) {
      return candidate;
    }
  }
  return null;
}

function isReferenceIdentifier(node, parent) {
  if (!parent) {
    return true;
  }
  if ((parent.type === "VariableDeclarator" || parent.type === "FunctionDeclaration" || parent.type === "FunctionExpression" || parent.type === "ClassDeclaration" || parent.type === "ClassExpression") && parent.id === node) {
    return false;
  }
  if ((parent.type === "Property" || parent.type === "MethodDefinition") && parent.key === node && !parent.computed) {
    return false;
  }
  if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) {
    return false;
  }
  if (parent.type === "LabeledStatement" || parent.type === "BreakStatement" || parent.type === "ContinueStatement") {
    return false;
  }
  if (parent.type === "CatchClause" && parent.param === node) {
    return false;
  }
  if ((parent.type === "RestElement" || parent.type === "AssignmentPattern") && parent.left === node) {
    return false;
  }
  return true;
}

function isWriteIdentifier(node, parent) {
  return Boolean(
    parent && (
      (parent.type === "AssignmentExpression" && parent.left === node) ||
      (parent.type === "UpdateExpression" && parent.argument === node)
    )
  );
}

function isWriteMemberExpression(node, parent) {
  return Boolean(
    parent && (
      (parent.type === "AssignmentExpression" && parent.left === node) ||
      (parent.type === "UpdateExpression" && parent.argument === node)
    )
  );
}

function isCallCallee(node, parent) {
  return Boolean(parent && parent.type === "CallExpression" && parent.callee === node);
}

function applyLayout(nodes) {
  const grouped = new Map();
  GRAPH_ORDER.forEach((kind) => grouped.set(kind, []));
  nodes.forEach((node) => {
    if (!grouped.has(node.kind)) {
      grouped.set(node.kind, []);
    }
    grouped.get(node.kind).push(node);
  });

  const nextNodes = [];
  GRAPH_ORDER.forEach((kind, columnIndex) => {
    const bucket = grouped.get(kind) || [];
    bucket.forEach((node, rowIndex) => {
      const saved = layout[node.id];
      nextNodes.push({
        ...node,
        x: saved ? saved.x : 48 + columnIndex * 238,
        y: saved ? saved.y : 52 + rowIndex * 148
      });
    });
  });

  return nextNodes;
}

function renderGraph() {
  if (!lastSuccessfulParse) {
    return;
  }

  elements.graphCanvas.innerHTML = "";
  elements.graphSvg.innerHTML = "";

  const activeNode = getSelectedNode();
  lastSuccessfulParse.edges.forEach((edge) => {
    const from = lastSuccessfulParse.nodes.find((node) => node.id === edge.from);
    const to = lastSuccessfulParse.nodes.find((node) => node.id === edge.to);
    if (!from || !to) {
      return;
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `graph-edge ${activeNode && (edge.from === activeNode.id || edge.to === activeNode.id) ? "active" : ""}`);
    path.setAttribute("stroke", KIND_COLORS[from.kind] || "#cfd8ea");
    path.setAttribute("d", edgePath(from, to));
    elements.graphSvg.appendChild(path);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const point = edgeLabelPoint(from, to);
    label.setAttribute("class", "graph-edge-label");
    label.setAttribute("x", point.x);
    label.setAttribute("y", point.y);
    label.textContent = edge.label;
    elements.graphSvg.appendChild(label);
  });

  lastSuccessfulParse.nodes.forEach((node) => {
    const card = document.createElement("article");
    card.className = `graph-node ${node.kind}${node.id === selectedNodeId ? " selected" : ""}${node.id === linkSourceId ? " link-source" : ""}${node.readOnly ? " readonly" : ""}`;
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
    card.dataset.nodeId = node.id;
    card.innerHTML = `
      <span class="graph-node-kind">${escapeHtml(node.kind)}</span>
      <h3>${escapeHtml(node.label)}</h3>
      <p>${escapeHtml(node.summary || node.file)}</p>
    `;
    card.addEventListener("click", () => onGraphNodeClick(node.id));
    card.addEventListener("pointerdown", (event) => startDraggingNode(event, node.id));
    elements.graphCanvas.appendChild(card);
  });
}

function edgePath(from, to) {
  const startX = from.x + 196;
  const startY = from.y + 52;
  const endX = to.x;
  const endY = to.y + 52;
  const curve = Math.max(72, Math.abs(endX - startX) * 0.42);
  return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
}

function edgeLabelPoint(from, to) {
  return {
    x: (from.x + to.x + 196) / 2,
    y: (from.y + to.y) / 2 + 26
  };
}

function onGraphNodeClick(nodeId) {
  if (linkSourceId && linkSourceId !== nodeId) {
    connectNodes(linkSourceId, nodeId);
    linkSourceId = null;
    return;
  }

  selectedNodeId = nodeId;
  renderInspector();
  renderSelectionDetails();
  updateStorageStatus();
  setStatus("Selected semantic node.", "ok");
}

function startDraggingNode(event, nodeId) {
  if (event.button !== 0 || !lastSuccessfulParse) {
    return;
  }

  const node = lastSuccessfulParse.nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    return;
  }

  selectedNodeId = nodeId;
  const drag = {
    id: nodeId,
    originX: node.x,
    originY: node.y,
    pointerX: event.clientX,
    pointerY: event.clientY
  };

  const move = (moveEvent) => {
    const dx = moveEvent.clientX - drag.pointerX;
    const dy = moveEvent.clientY - drag.pointerY;
    layout[nodeId] = {
      x: Math.max(12, drag.originX + dx),
      y: Math.max(12, drag.originY + dy)
    };
    const renderedNode = lastSuccessfulParse.nodes.find((entry) => entry.id === nodeId);
    if (renderedNode) {
      renderedNode.x = layout[nodeId].x;
      renderedNode.y = layout[nodeId].y;
    }
    renderGraph();
    updateStorageStatus();
  };

  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    saveLayout();
    setStatus("Moved graph node.", "ok");
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function renderInspector() {
  const node = getSelectedNode();
  if (!node) {
    elements.inspectorHeading.textContent = "No node selected";
    elements.inspectorKindPill.textContent = "Select a node";
    elements.inspectorEmpty.classList.remove("hidden");
    elements.inspectorContent.classList.add("hidden");
    return;
  }

  elements.inspectorEmpty.classList.add("hidden");
  elements.inspectorContent.classList.remove("hidden");
  elements.inspectorHeading.textContent = node.label;
  elements.inspectorKindPill.textContent = node.kind;
  elements.nodeIdField.value = node.id;
  elements.nodeLocationField.textContent = node.line ? `${node.file}:${node.line}` : node.file;

  const config = inspectorConfig(node);
  elements.nodeNameLabel.textContent = config.nameLabel;
  elements.nodeNameField.value = config.nameValue;
  elements.nodeNameField.disabled = config.nameDisabled;
  elements.nodePrimaryLabel.textContent = config.primaryLabel;
  elements.nodePrimaryField.value = config.primaryValue;
  elements.nodePrimaryField.disabled = config.primaryDisabled;
  elements.nodeSecondaryLabel.textContent = config.secondaryLabel;
  elements.nodeSecondaryField.value = config.secondaryValue;
  elements.nodeSecondaryField.disabled = config.secondaryDisabled;
  elements.nodeBodyLabel.textContent = config.bodyLabel;
  elements.nodeBodyField.value = config.bodyValue;
  elements.nodeBodyField.disabled = config.bodyDisabled;
  elements.nodeBodyHint.textContent = config.hint;

  const relatedEdges = lastSuccessfulParse.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
  elements.edgeList.innerHTML = relatedEdges.length
    ? relatedEdges.map((edge) => `
      <li class="edge-item">
        <div>
          <div>${escapeHtml(edge.label)}</div>
          <div class="edge-copy">${escapeHtml(edge.from)} -> ${escapeHtml(edge.to)}</div>
        </div>
      </li>
    `).join("")
    : '<li class="edge-item"><div class="edge-copy">No edges connected to this node.</div></li>';
}

function inspectorConfig(node) {
  if (node.kind === "value") {
    return {
      nameLabel: "Symbol",
      nameValue: node.name,
      nameDisabled: !node.renameable,
      primaryLabel: "Scope",
      primaryValue: node.scopeLabel,
      primaryDisabled: true,
      secondaryLabel: "File",
      secondaryValue: node.file,
      secondaryDisabled: true,
      bodyLabel: "Initializer / expression",
      bodyValue: node.bodyText,
      bodyDisabled: false,
      hint: "Editing this field patches the actual value expression in app.js."
    };
  }

  if (node.kind === "function") {
    return {
      nameLabel: "Function name",
      nameValue: node.name,
      nameDisabled: !node.renameable,
      primaryLabel: "Scope",
      primaryValue: node.scopeLabel,
      primaryDisabled: true,
      secondaryLabel: "File",
      secondaryValue: node.file,
      secondaryDisabled: true,
      bodyLabel: node.bodyStyle === "block" ? "Function body" : "Function expression",
      bodyValue: node.bodyText,
      bodyDisabled: false,
      hint: node.bodyStyle === "block"
        ? "This editor patches the real function body in app.js."
        : "This editor patches the expression body of the function value."
    };
  }

  if (node.kind === "style") {
    return {
      nameLabel: "Rule",
      nameValue: node.label,
      nameDisabled: true,
      primaryLabel: "Selector",
      primaryValue: node.selector,
      primaryDisabled: false,
      secondaryLabel: "Scope",
      secondaryValue: node.scopeLabel,
      secondaryDisabled: true,
      bodyLabel: "Declarations",
      bodyValue: node.bodyText,
      bodyDisabled: false,
      hint: "Editing this rule patches the real CSS selector and declaration block."
    };
  }

  if (node.kind === "event") {
    return {
      nameLabel: "Listener label",
      nameValue: node.label,
      nameDisabled: true,
      primaryLabel: "Selector",
      primaryValue: node.selector,
      primaryDisabled: false,
      secondaryLabel: "Event",
      secondaryValue: node.eventType,
      secondaryDisabled: false,
      bodyLabel: "Handler expression",
      bodyValue: node.handlerSource,
      bodyDisabled: false,
      hint: "This updates the actual addEventListener statement in app.js."
    };
  }

  if (node.kind === "binding") {
    return {
      nameLabel: "Binding",
      nameValue: node.label,
      nameDisabled: true,
      primaryLabel: "Owner",
      primaryValue: node.ownerPath,
      primaryDisabled: true,
      secondaryLabel: "Target",
      secondaryValue: node.targetSelector,
      secondaryDisabled: true,
      bodyLabel: "Statement",
      bodyValue: node.bodyText,
      bodyDisabled: false,
      hint: "This patches the DOM write statement that generated the semantic binding."
    };
  }

  if (node.kind === "effect") {
    return {
      nameLabel: "Effect",
      nameValue: node.label,
      nameDisabled: true,
      primaryLabel: "Owner",
      primaryValue: node.ownerPath,
      primaryDisabled: true,
      secondaryLabel: "Kind",
      secondaryValue: node.effectLabel,
      secondaryDisabled: true,
      bodyLabel: "Statement",
      bodyValue: node.bodyText,
      bodyDisabled: false,
      hint: "This patches the side-effecting statement in app.js."
    };
  }

  return {
    nameLabel: "View",
    nameValue: node.label,
    nameDisabled: true,
    primaryLabel: "Tag",
    primaryValue: node.tagName,
    primaryDisabled: true,
    secondaryLabel: "File",
    secondaryValue: node.file,
    secondaryDisabled: true,
    bodyLabel: "HTML snippet",
    bodyValue: node.snippet || "Edit index.html on the left to change this node.",
    bodyDisabled: true,
    hint: "View nodes are parsed from index.html and are currently edited from the text pane."
  };
}

function renderSelectionDetails() {
  const node = getSelectedNode();
  if (!node) {
    elements.selectionView.textContent = "Select a node to see its source slice.";
    elements.secondaryMetaText.textContent = activeLowerTab === "preview" ? "Live preview and selected source slice." : "Live preview and selected source slice.";
    return;
  }

  elements.secondaryMetaText.textContent = node.line ? `${node.file}:${node.line}` : node.file;
  elements.selectionView.textContent = node.snippet || "No source slice available for this node.";
}

function getSelectedNode() {
  return lastSuccessfulParse ? lastSuccessfulParse.nodes.find((node) => node.id === selectedNodeId) || null : null;
}

function applyInspectorChanges() {
  if (!lastSuccessfulParse || parseError) {
    setStatus("Fix code parse errors before editing from the graph.", "warning");
    return;
  }

  const node = getSelectedNode();
  if (!node) {
    return;
  }

  if (node.kind === "view") {
    setStatus("View nodes are edited from index.html on the left.", "warning");
    return;
  }

  if (node.kind === "style") {
    updateStyleNode(node, {
      selector: elements.nodePrimaryField.value.trim(),
      body: elements.nodeBodyField.value
    });
    return;
  }

  if (node.kind === "event") {
    updateEventNode(node, {
      selector: elements.nodePrimaryField.value.trim(),
      eventType: elements.nodeSecondaryField.value.trim(),
      handlerSource: elements.nodeBodyField.value.trim()
    });
    return;
  }

  if (node.kind === "binding" || node.kind === "effect") {
    updateStatementNode(node, elements.nodeBodyField.value);
    return;
  }

  if (node.renameable && elements.nodeNameField.value.trim() && elements.nodeNameField.value.trim() !== node.name) {
    renameSemanticNode(node, elements.nodeNameField.value.trim());
    return;
  }

  if (node.kind === "value") {
    updateValueNode(node, elements.nodeBodyField.value);
    return;
  }

  if (node.kind === "function") {
    updateFunctionBody(node, elements.nodeBodyField.value);
  }
}

function renameSemanticNode(node, requestedName) {
  if (!node.renameable || !node.renameStrategy) {
    setStatus("This node cannot be renamed safely from the graph yet.", "warning");
    return;
  }

  const nextName = sanitizeIdentifier(requestedName);
  if (!nextName) {
    setStatus("Names must be valid JavaScript identifiers.", "warning");
    return;
  }

  if (node.kind === "value" || node.kind === "function") {
    const collision = lastSuccessfulParse.nodes.find((entry) => entry.id !== node.id && entry.kind === node.kind && entry.qualifiedName === replaceLeafName(node.qualifiedName, nextName));
    if (collision) {
      setStatus(`A ${node.kind} named ${nextName} already exists in that scope.`, "warning");
      return;
    }
  }

  const replacements = [];
  const declarationText = node.nameRange ? formatDeclarationName(node, nextName) : null;
  if (node.nameRange && declarationText) {
    replacements.push({ start: node.nameRange[0], end: node.nameRange[1], text: declarationText });
  }

  if (node.renameStrategy.type === "path") {
    collectPathReferenceRanges(lastSuccessfulParse.js.ast, node.renameStrategy.path).forEach((range) => {
      replacements.push({ ...range, text: nextName });
    });
  } else if (node.renameStrategy.type === "identifier") {
    collectIdentifierReferenceRanges(lastSuccessfulParse.js.ast, node.renameStrategy.name).forEach((range) => {
      replacements.push({ ...range, text: nextName });
    });
  }

  files["app.js"] = applyReplacements(files["app.js"], replacements);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  const nextPath = replaceLeafName(node.qualifiedName, nextName);
  applyCurrentSource(`Renamed ${node.id} to ${nextName}.`, (candidate) => candidate.kind === node.kind && candidate.qualifiedName === nextPath);
}

function updateValueNode(node, nextValue) {
  const replacement = node.valueInsertMode ? ` = ${nextValue}` : nextValue;
  files["app.js"] = replaceRange(files["app.js"], node.valueRange[0], node.valueRange[1], replacement);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  applyCurrentSource(`Updated ${node.id}.`, (candidate) => candidate.id === node.id || candidate.qualifiedName === node.qualifiedName);
}

function updateFunctionBody(node, nextBody) {
  const replacement = formatFunctionBody(files["app.js"], node, nextBody);
  files["app.js"] = replaceRange(files["app.js"], node.bodyRange[0], node.bodyRange[1], replacement);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  applyCurrentSource(`Updated ${node.id}.`, (candidate) => candidate.kind === "function" && candidate.qualifiedName === node.qualifiedName);
}

function updateStyleNode(node, patch) {
  const selector = patch.selector || node.selector;
  if (!selector) {
    setStatus("CSS selectors cannot be empty.", "warning");
    return;
  }

  const bodyReplacement = formatCssBody(files["styles.css"], node, patch.body);
  const nextSource = applyReplacements(files["styles.css"], [
    { start: node.selectorRange[0], end: node.selectorRange[1], text: selector },
    { start: node.bodyRange[0], end: node.bodyRange[1], text: bodyReplacement }
  ]);
  files["styles.css"] = nextSource;
  saveFiles();
  if (activeFile === "styles.css") {
    syncSourceEditor();
  }
  applyCurrentSource(`Updated ${node.id}.`, (candidate) => candidate.kind === "style" && candidate.selector === selector && candidate.line === node.line);
}

function updateEventNode(node, patch) {
  const selector = patch.selector || node.selector;
  const eventType = patch.eventType || node.eventType;
  const handlerSource = patch.handlerSource || node.handlerSource;
  if (!selector || !eventType || !handlerSource) {
    setStatus("Event nodes need a selector, an event type, and a handler.", "warning");
    return;
  }
  const indent = lineIndentAt(files["app.js"], node.sourceRange[0]);
  const statement = `${indent}${buildListenerStatement(selector, eventType, handlerSource)}`;
  files["app.js"] = replaceRange(files["app.js"], node.sourceRange[0], node.sourceRange[1], statement);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  applyCurrentSource("Updated event listener.", (candidate) => candidate.kind === "event" && candidate.selector === selector && candidate.eventType === eventType && candidate.handlerSource === handlerSource);
}

function updateStatementNode(node, nextStatement) {
  const formatted = formatStatementReplacement(files["app.js"], node, nextStatement);
  files["app.js"] = replaceRange(files["app.js"], node.sourceRange[0], node.sourceRange[1], formatted);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  applyCurrentSource(`Updated ${node.id}.`, (candidate) => candidate.kind === node.kind && candidate.line === node.line && candidate.ownerPath === node.ownerPath);
}

function buildListenerStatement(selector, eventType, handlerSource) {
  return `document.querySelector(${JSON.stringify(selector)}).addEventListener(${JSON.stringify(eventType)}, ${handlerSource});`;
}

function collectPathReferenceRanges(ast, targetPath) {
  const ranges = [];
  acorn.walk.simple(ast, {
    MemberExpression(node) {
      if (expressionPath(node) !== targetPath) {
        return;
      }
      if (!node.computed && node.property.type === "Identifier") {
        ranges.push({ start: node.property.start, end: node.property.end });
      }
    }
  });
  return dedupeReplacementRanges(ranges);
}

function collectIdentifierReferenceRanges(ast, name) {
  const ranges = [];
  acorn.walk.ancestor(ast, {
    Identifier(node, ancestors) {
      if (node.name !== name) {
        return;
      }
      const parent = ancestors[ancestors.length - 2];
      if (!isReferenceIdentifier(node, parent)) {
        return;
      }
      ranges.push({ start: node.start, end: node.end });
    }
  });
  return dedupeReplacementRanges(ranges);
}

function formatDeclarationName(node, nextName) {
  if (!node.nameRange) {
    return null;
  }
  const currentSource = files["app.js"].slice(node.nameRange[0], node.nameRange[1]);
  if (/^['"]/.test(currentSource)) {
    return JSON.stringify(nextName);
  }
  return nextName;
}

function addNodeFromGraph(kind) {
  if (!lastSuccessfulParse || parseError) {
    setStatus("Fix parse errors before adding graph nodes.", "warning");
    return;
  }

  if (kind === "event") {
    addEventListenerNode();
    return;
  }
  if (kind === "value") {
    addValueNode();
    return;
  }
  if (kind === "function") {
    addFunctionNode();
    return;
  }
  if (kind === "style") {
    addStyleNode();
  }
}

function addValueNode() {
  const name = nextAvailableName("value", "valueNode");
  const snippet = `const ${name} = null;`;
  files["app.js"] = appendToFile(files["app.js"], snippet);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  applyCurrentSource(`Added value ${name}.`, (candidate) => candidate.kind === "value" && candidate.qualifiedName === name);
}

function addFunctionNode() {
  const name = nextAvailableName("function", "newFunction");
  const snippet = `function ${name}() {\n  // TODO: implement\n}`;
  files["app.js"] = appendToFile(files["app.js"], snippet);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  applyCurrentSource(`Added function ${name}.`, (candidate) => candidate.kind === "function" && candidate.qualifiedName === name);
}

function addStyleNode() {
  const selector = `.block-${Date.now().toString(36)}`;
  const snippet = `${selector} {\n  color: #ffffff;\n}`;
  files["styles.css"] = appendToFile(files["styles.css"], snippet);
  saveFiles();
  if (activeFile === "styles.css") {
    syncSourceEditor();
  }
  applyCurrentSource(`Added style rule ${selector}.`, (candidate) => candidate.kind === "style" && candidate.selector === selector);
}

function addEventListenerNode() {
  const selector = firstHtmlSelector() || "#app";
  const handler = firstCallableFunction() || "() => {}";
  files["app.js"] = appendToFile(files["app.js"], buildListenerStatement(selector, "click", handler));
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  applyCurrentSource(`Added click listener on ${selector}.`, (candidate) => candidate.kind === "event" && candidate.selector === selector && candidate.eventType === "click" && candidate.handlerSource === handler);
}

function appendToFile(source, snippet) {
  const trimmed = source.trimEnd();
  return trimmed ? `${trimmed}\n\n${snippet}\n` : `${snippet}\n`;
}

function connectNodes(sourceId, targetId) {
  const sourceNode = lastSuccessfulParse.nodes.find((node) => node.id === sourceId);
  const targetNode = lastSuccessfulParse.nodes.find((node) => node.id === targetId);
  if (!sourceNode || !targetNode) {
    return;
  }

  if (sourceNode.kind === "event" && targetNode.kind === "function") {
    const handlerSource = targetNode.callPath || targetNode.qualifiedName;
    if (!handlerSource) {
      setStatus("That function does not expose a direct call path yet.", "warning");
      return;
    }
    updateEventNode(sourceNode, {
      selector: sourceNode.selector,
      eventType: sourceNode.eventType,
      handlerSource
    });
    return;
  }

  if (sourceNode.kind === "function" && targetNode.kind === "function") {
    const callExpression = targetNode.callPath || targetNode.qualifiedName;
    if (!callExpression) {
      setStatus("That target function cannot be called directly from a generic link yet.", "warning");
      return;
    }
    const callLine = `${callExpression}();`;
    if (sourceNode.bodyText.includes(callLine)) {
      setStatus("That call already exists in the selected function.", "warning");
      return;
    }
    const nextBody = sourceNode.bodyText.trimEnd() ? `${sourceNode.bodyText.trimEnd()}\n${callLine}` : callLine;
    updateFunctionBody(sourceNode, nextBody);
    return;
  }

  setStatus("That visual link is not implemented yet for these node types.", "warning");
}

function enterLinkMode() {
  const node = getSelectedNode();
  if (!node) {
    setStatus("Select a node before entering link mode.", "warning");
    return;
  }
  linkSourceId = node.id;
  renderGraph();
  setStatus(`Link mode active from ${node.id}. Click a target node.`, "warning");
}

function deleteSelectedNode() {
  if (!lastSuccessfulParse || parseError) {
    setStatus("Fix parse errors before deleting from the graph.", "warning");
    return;
  }

  const node = getSelectedNode();
  if (!node) {
    return;
  }

  if (node.kind === "view") {
    setStatus("View nodes are deleted from index.html, not from the graph.", "warning");
    return;
  }

  if (["style"].includes(node.kind)) {
    files["styles.css"] = removeNodeDefinition(files["styles.css"], node);
    saveFiles();
    if (activeFile === "styles.css") {
      syncSourceEditor();
    }
    selectedNodeId = null;
    applyCurrentSource(`Removed ${node.id}.`);
    return;
  }

  if (["event", "binding", "effect"].includes(node.kind)) {
    files["app.js"] = removeNodeDefinition(files["app.js"], node);
    saveFiles();
    if (activeFile === "app.js") {
      syncSourceEditor();
    }
    selectedNodeId = null;
    applyCurrentSource(`Removed ${node.id}.`);
    return;
  }

  if (hasExternalReferences(node)) {
    setStatus("Delete blocked because other code still references this node.", "warning");
    return;
  }

  files["app.js"] = removeNodeDefinition(files["app.js"], node);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  selectedNodeId = null;
  applyCurrentSource(`Removed ${node.id}.`);
}

function hasExternalReferences(node) {
  const js = lastSuccessfulParse.js;
  if (node.renameStrategy && node.renameStrategy.type === "path") {
    return collectPathReferenceRanges(js.ast, node.renameStrategy.path).length > 0;
  }
  if (node.renameStrategy && node.renameStrategy.type === "identifier") {
    return collectIdentifierReferenceRanges(js.ast, node.renameStrategy.name).length > 0;
  }
  return false;
}

function autoLayoutCurrentGraph() {
  if (!lastSuccessfulParse) {
    return;
  }
  const grouped = new Map();
  GRAPH_ORDER.forEach((kind) => grouped.set(kind, []));
  lastSuccessfulParse.nodes.forEach((node) => {
    if (!grouped.has(node.kind)) {
      grouped.set(node.kind, []);
    }
    grouped.get(node.kind).push(node);
  });
  GRAPH_ORDER.forEach((kind, columnIndex) => {
    (grouped.get(kind) || []).forEach((node, rowIndex) => {
      layout[node.id] = {
        x: 48 + columnIndex * 238,
        y: 52 + rowIndex * 148
      };
      node.x = layout[node.id].x;
      node.y = layout[node.id].y;
    });
  });
  saveLayout();
}

function runPrompt() {
  const prompt = elements.promptInput.value.trim();
  if (!prompt) {
    setStatus("Write a prompt first.", "warning");
    return;
  }

  appendPrompt("user", prompt);
  elements.promptInput.value = "";

  let response = "";
  try {
    response = executePrompt(prompt);
  } catch (error) {
    response = `I could not apply that prompt: ${error.message}`;
    setStatus(response, "error");
  }

  appendPrompt("assistant", response);
  renderPromptLog();
  savePromptLog();
}

function executePrompt(prompt) {
  let match;

  match = prompt.match(/^add\s+(?:value|state)\s+([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*=\s*([\s\S]+))?$/i);
  if (match) {
    addValueNodeFromPrompt(match[1], (match[2] || "null").trim());
    return `Added value \`${match[1]}\` to app.js.`;
  }

  match = prompt.match(/^add\s+(?:function|action)\s+([A-Za-z_$][A-Za-z0-9_$]*)$/i);
  if (match) {
    addFunctionNodeFromPrompt(match[1]);
    return `Added function \`${match[1]}\` to app.js.`;
  }

  match = prompt.match(/^add\s+style\s+([\s\S]+)$/i);
  if (match) {
    addStyleNodeFromPrompt(match[1].trim());
    return "Added a style rule to styles.css.";
  }

  match = prompt.match(/^add\s+event\s+([A-Za-z-]+)\s+on\s+(.+?)\s*->\s*([\s\S]+)$/i);
  if (match) {
    addEventNodeFromPrompt(match[2].trim(), match[1].trim(), match[3].trim());
    return `Added ${match[1].trim()} listener on ${match[2].trim()}.`;
  }

  match = prompt.match(/^rename\s+(.+?)\s+to\s+([A-Za-z_$][A-Za-z0-9_$]*)$/i);
  if (match) {
    const node = resolveNode(match[1]);
    if (!node) {
      throw new Error(`I could not find "${match[1]}".`);
    }
    if (!node.renameable) {
      throw new Error("That node cannot be renamed safely from the graph yet.");
    }
    renameSemanticNode(node, match[2]);
    return `Renamed \`${node.id}\` to \`${match[2]}\`.`;
  }

  match = prompt.match(/^delete\s+(.+)$/i);
  if (match) {
    const node = resolveNode(match[1]);
    if (!node) {
      throw new Error(`I could not find "${match[1]}".`);
    }
    selectedNodeId = node.id;
    deleteSelectedNode();
    return `Tried to delete \`${node.id}\`.`;
  }

  match = prompt.match(/^connect\s+(.+?)\s*->\s*(.+)$/i);
  if (match) {
    const sourceNode = resolveNode(match[1]);
    const targetNode = resolveNode(match[2]);
    if (!sourceNode || !targetNode) {
      throw new Error("Both nodes must exist before they can be connected.");
    }
    connectNodes(sourceNode.id, targetNode.id);
    return `Connected \`${sourceNode.id}\` to \`${targetNode.id}\` when that mapping is supported.`;
  }

  match = prompt.match(/^set\s+code\s+of\s+(.+?)\s+to\s+([\s\S]+)$/i);
  if (match) {
    const node = resolveNode(match[1]);
    if (!node || !["function", "binding", "effect"].includes(node.kind)) {
      throw new Error("That command needs a function, binding, or effect node.");
    }
    if (node.kind === "function") {
      updateFunctionBody(node, match[2].trim());
    } else {
      updateStatementNode(node, match[2].trim());
    }
    return `Updated the code for \`${node.id}\`.`;
  }

  match = prompt.match(/^set\s+value\s+of\s+(.+?)\s+to\s+([\s\S]+)$/i);
  if (match) {
    const node = resolveNode(match[1]);
    if (!node || node.kind !== "value") {
      throw new Error("That command only works for value nodes.");
    }
    updateValueNode(node, match[2].trim());
    return `Updated the value expression of \`${node.id}\`.`;
  }

  return "Prompt mode understands: add value, add function, add style, add event ... on ... -> ..., rename, delete, connect, set code of ..., and set value of ....";
}

function addValueNodeFromPrompt(name, value) {
  const validName = sanitizeIdentifier(name);
  if (!validName) {
    throw new Error("Value names must be valid JavaScript identifiers.");
  }
  if (lastSuccessfulParse.nodes.find((node) => node.kind === "value" && node.qualifiedName === validName)) {
    throw new Error(`Value ${validName} already exists.`);
  }
  files["app.js"] = appendToFile(files["app.js"], `const ${validName} = ${value};`);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  applyCurrentSource(`Added value ${validName}.`, (candidate) => candidate.kind === "value" && candidate.qualifiedName === validName);
}

function addFunctionNodeFromPrompt(name) {
  const validName = sanitizeIdentifier(name);
  if (!validName) {
    throw new Error("Function names must be valid JavaScript identifiers.");
  }
  if (lastSuccessfulParse.nodes.find((node) => node.kind === "function" && node.qualifiedName === validName)) {
    throw new Error(`Function ${validName} already exists.`);
  }
  files["app.js"] = appendToFile(files["app.js"], `function ${validName}() {\n  // TODO: implement\n}`);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  applyCurrentSource(`Added function ${validName}.`, (candidate) => candidate.kind === "function" && candidate.qualifiedName === validName);
}

function addStyleNodeFromPrompt(ruleText) {
  const ruleSource = /\{/.test(ruleText) ? ruleText : `${ruleText} {\n  color: #ffffff;\n}`;
  const selector = ruleSource.split("{")[0].trim();
  files["styles.css"] = appendToFile(files["styles.css"], ruleSource);
  saveFiles();
  if (activeFile === "styles.css") {
    syncSourceEditor();
  }
  applyCurrentSource(`Added style ${selector}.`, (candidate) => candidate.kind === "style" && candidate.selector === selector);
}

function addEventNodeFromPrompt(selector, eventType, handlerSource) {
  files["app.js"] = appendToFile(files["app.js"], buildListenerStatement(selector, eventType, handlerSource));
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  applyCurrentSource(`Added ${eventType} listener on ${selector}.`, (candidate) => candidate.kind === "event" && candidate.selector === selector && candidate.eventType === eventType && candidate.handlerSource === handlerSource);
}

function resolveNode(reference) {
  if (!lastSuccessfulParse) {
    return null;
  }

  const needle = reference.trim().toLowerCase();
  const exactMatches = lastSuccessfulParse.nodes.filter((node) => {
    return [
      node.id,
      node.label,
      node.name,
      node.qualifiedName,
      node.selector,
      node.kind === "event" ? `${node.eventType} @ ${node.selector}` : ""
    ].filter(Boolean).some((candidate) => candidate.toLowerCase() === needle);
  });
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }
  if (exactMatches.length > 1) {
    return exactMatches[0];
  }

  return lastSuccessfulParse.nodes.find((node) => {
    return [
      node.id,
      node.label,
      node.name,
      node.qualifiedName,
      node.selector
    ].filter(Boolean).some((candidate) => candidate.toLowerCase().includes(needle));
  }) || null;
}

function showPromptHelp() {
  appendPrompt("assistant", [
    "Prompt examples:",
    "add value selectedTask = null",
    "add function clearCompleted",
    "add style .task-list li.done { opacity: 0.5; }",
    "add event click on #task-list -> toggleTask",
    "rename addTask to createTask",
    "delete saveCache",
    "connect click @ #task-list -> toggleTask",
    "set code of renderTasks to ...",
    "set value of filter to \"done\""
  ].join("\n"));
  renderPromptLog();
  savePromptLog();
  setStatus("Prompt help added to the log.", "ok");
}

function appendPrompt(role, text) {
  promptLog.push({ role, text });
  promptLog = promptLog.slice(-24);
}

function renderPromptLog() {
  elements.promptLog.innerHTML = promptLog.map((entry) => `
    <div class="prompt-message ${entry.role}">
      <strong>${entry.role === "user" ? "You" : "Bicameral"}</strong><br>
      ${escapeHtml(entry.text).replace(/\n/g, "<br>")}
    </div>
  `).join("");
  elements.promptLog.scrollTop = elements.promptLog.scrollHeight;
}

function resetWorkspace() {
  files = { ...DEFAULT_FILES };
  layout = {};
  promptLog = [
    {
      role: "assistant",
      text: "Workspace reset. The left pane is back to the default HTML, CSS, and JS sample, and the graph has been re-derived from those files."
    }
  ];
  saveFiles();
  saveLayout();
  savePromptLog();
  parseError = "";
  lastSuccessfulParse = parseSources(files);
  selectedNodeId = lastSuccessfulParse.nodes[0] ? lastSuccessfulParse.nodes[0].id : null;
  syncSourceEditor();
  renderAll("Reset Bicameral to the default code sample.");
}

function nextAvailableName(kind, base) {
  let candidate = sanitizeIdentifier(base);
  let counter = 2;
  while (lastSuccessfulParse.nodes.find((node) => node.kind === kind && node.qualifiedName === candidate)) {
    candidate = `${sanitizeIdentifier(base)}${counter}`;
    counter += 1;
  }
  return candidate;
}

function firstCallableFunction() {
  const functionNode = lastSuccessfulParse.nodes.find((node) => node.kind === "function" && node.callPath);
  return functionNode ? functionNode.callPath : null;
}

function firstHtmlSelector() {
  const viewNode = lastSuccessfulParse.nodes.find((node) => node.kind === "view");
  return viewNode ? viewNode.selector : null;
}

function dedupeEdges(edges) {
  const seen = new Set();
  return edges.filter((edge) => {
    const key = `${edge.from}|${edge.to}|${edge.label}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeReplacementRanges(ranges) {
  const seen = new Set();
  return ranges.filter((range) => {
    const key = `${range.start}:${range.end}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function applyReplacements(source, replacements) {
  const sorted = dedupeReplacementRanges(replacements).sort((a, b) => b.start - a.start);
  let nextSource = source;
  sorted.forEach((replacement) => {
    nextSource = replaceRange(nextSource, replacement.start, replacement.end, replacement.text);
  });
  return nextSource;
}

function replaceRange(source, start, end, replacement) {
  return source.slice(0, start) + replacement + source.slice(end);
}

function removeRangeWithWhitespace(source, start, end) {
  let nextStart = start;
  let nextEnd = end;
  while (nextStart > 0 && source[nextStart - 1] === " ") {
    nextStart -= 1;
  }
  while (nextEnd < source.length && /\s/.test(source[nextEnd])) {
    nextEnd += 1;
    if (source[nextEnd - 1] === "\n") {
      break;
    }
  }
  return source.slice(0, nextStart) + source.slice(nextEnd);
}

function removeNodeDefinition(source, node) {
  if (!node.collection) {
    return removeRangeWithWhitespace(source, node.sourceRange[0], node.sourceRange[1]);
  }

  const { type, index, ranges, statementRange } = node.collection;
  if (!Array.isArray(ranges) || index < 0) {
    return removeRangeWithWhitespace(source, node.sourceRange[0], node.sourceRange[1]);
  }

  if (type === "variable-declarators" && ranges.length === 1 && statementRange) {
    return removeRangeWithWhitespace(source, statementRange[0], statementRange[1]);
  }

  if (ranges.length === 1) {
    return source.slice(0, ranges[0][0]) + source.slice(ranges[0][1]);
  }

  let start = ranges[index][0];
  let end = ranges[index][1];

  if (index < ranges.length - 1) {
    end = ranges[index + 1][0];
  } else {
    start = ranges[index - 1][1];
  }

  return source.slice(0, start) + source.slice(end);
}

function formatFunctionBody(source, node, nextBody) {
  if (node.bodyStyle === "expression") {
    return nextBody.trim() || "undefined";
  }

  const closingIndent = lineIndentAt(source, node.bodyRange[1]);
  const innerIndent = `${closingIndent}  `;
  const trimmed = nextBody.replace(/^\n+|\n+$/g, "");
  if (!trimmed.trim()) {
    return `\n${closingIndent}`;
  }
  return `\n${trimmed.split("\n").map((line) => `${innerIndent}${line.trimEnd()}`).join("\n")}\n${closingIndent}`;
}

function formatCssBody(source, node, nextBody) {
  const openBraceIndex = node.bodyRange[0] - 1;
  const ruleIndent = lineIndentAt(source, openBraceIndex);
  const innerIndent = `${ruleIndent}  `;
  const trimmed = String(nextBody).replace(/^\n+|\n+$/g, "").trim();
  if (!trimmed) {
    return `\n${ruleIndent}`;
  }
  return `\n${trimmed.split("\n").map((line) => `${innerIndent}${line.trimEnd()}`).join("\n")}\n${ruleIndent}`;
}

function formatStatementReplacement(source, node, nextStatement) {
  const indent = lineIndentAt(source, node.sourceRange[0]);
  const trimmed = String(nextStatement).replace(/^\n+|\n+$/g, "");
  return trimmed.split("\n").map((line, index) => index === 0 ? `${indent}${line.trimStart()}` : `${indent}${line.trimStart()}`).join("\n");
}

function lineIndentAt(source, index) {
  const lineStart = source.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
  const match = source.slice(lineStart).match(/^\s*/);
  return match ? match[0] : "";
}

function sanitizeIdentifier(value) {
  const cleaned = String(value).trim().replace(/[^A-Za-z0-9_$]+/g, "");
  if (!cleaned) {
    return "";
  }
  return cleaned.match(/^[A-Za-z_$]/) ? cleaned : `n${cleaned}`;
}

function replaceLeafName(path, nextLeaf) {
  const parts = String(path).split(".");
  parts[parts.length - 1] = nextLeaf;
  return parts.join(".");
}

function uniqueNodeId(baseId, nodes) {
  let candidate = baseId;
  let counter = 2;
  while (nodes.find((node) => node.id === candidate)) {
    candidate = `${baseId}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "node";
}

function lineNumberFromIndex(source, index) {
  return source.slice(0, index).split("\n").length;
}

function extractHtmlSnippet(source, id) {
  const lines = source.split("\n");
  const needle = `id="${id}"`;
  const altNeedle = `id='${id}'`;
  const index = lines.findIndex((line) => line.includes(needle) || line.includes(altNeedle));
  if (index === -1) {
    return { line: 0, text: `<element id="${id}">` };
  }
  return {
    line: index + 1,
    text: lines.slice(index, Math.min(lines.length, index + 3)).join("\n")
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

boot();
