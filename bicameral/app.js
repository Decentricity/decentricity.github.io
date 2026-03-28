const FILES_STORAGE_KEY = "bicameral.ide.files.v4";
const LAYOUT_STORAGE_KEY = "bicameral.ide.layout.v4";
const PROMPT_LOG_KEY = "bicameral.ide.prompt.v3";
const FILE_ORDER = ["index.html", "styles.css", "app.js"];
const GRAPH_ORDER = ["view", "state", "event", "action", "effect", "binding"];
const KIND_COLORS = {
  view: "#94b7ff",
  state: "#5fd0a5",
  event: "#ffca62",
  action: "#ff7d6b",
  effect: "#79a8ff",
  binding: "#cf9bff"
};

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
  "app.js": `const refs = {
  taskForm: document.querySelector("#task-form"),
  taskInput: document.querySelector("#task-input"),
  taskList: document.querySelector("#task-list"),
  taskStatus: document.querySelector("#task-status")
};

const state = {
  tasks: [],
  filter: "all"
};

const bindings = {
  renderTasks() {
    const visibleTasks = state.tasks.filter((task) => state.filter === "all" || !task.done);
    refs.taskList.innerHTML = visibleTasks.map((task) => \`
      <li class="task-row \${task.done ? "done" : ""}" data-task-id="\${task.id}">
        <button class="task-toggle" type="button">\${task.done ? "Undo" : "Done"}</button>
        <span>\${task.label}</span>
      </li>
    \`).join("");
    refs.taskStatus.textContent = \`\${state.tasks.length} tasks in memory\`;
  }
};

const effects = {
  saveCache() {
    localStorage.setItem("bicameral.tasks", JSON.stringify(state.tasks));
  },
  loadCache() {
    state.tasks = JSON.parse(localStorage.getItem("bicameral.tasks") || "[]");
  }
};

const actions = {
  bootstrap() {
    effects.loadCache();
    bindings.renderTasks();
  },
  addTask(event) {
    event.preventDefault();
    const label = refs.taskInput.value.trim();
    if (!label) return;
    state.tasks = [{ id: makeId(), label, done: false }, ...state.tasks];
    refs.taskInput.value = "";
    bindings.renderTasks();
    effects.saveCache();
  },
  toggleTask(taskId) {
    state.tasks = state.tasks.map((task) =>
      task.id === taskId ? { ...task, done: !task.done } : task
    );
    bindings.renderTasks();
    effects.saveCache();
  }
};

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
}

document.addEventListener("DOMContentLoaded", actions.bootstrap);
refs.taskForm.addEventListener("submit", actions.addTask);
refs.taskList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-task-id]");
  if (!row) return;
  actions.toggleTask(row.dataset.taskId);
});`
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

  const initial = parseSources(files);
  lastSuccessfulParse = initial;
  selectedNodeId = initial.nodes[0] ? initial.nodes[0].id : null;
  renderPromptLog();
  syncSourceEditor();
  renderAll("Booted Bicameral in code-first mode.");
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
    // Ignore invalid prompt log state.
  }

  return [
    {
      role: "assistant",
      text: "Code is now the source of truth. Edit the HTML, CSS, or JS on the left, or patch the parsed graph on the right."
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

function applyCurrentSource(statusMessage) {
  renderPreview();

  try {
    const parsed = parseSources(files);
    lastSuccessfulParse = parsed;
    parseError = "";
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
  const js = parseJavaScriptSource(sourceFiles["app.js"], html);
  const nodes = applyLayout([...html.nodes, ...js.nodes]);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = dedupeEdges([...js.edges].filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)));

  return {
    html,
    js,
    nodes,
    edges
  };
}

function parseHtmlSource(source) {
  const doc = new DOMParser().parseFromString(source, "text/html");
  const nodes = [];
  const selectorToId = new Map();

  [...doc.querySelectorAll("[id]")].forEach((element, index) => {
    const selector = `#${element.id}`;
    const id = uniqueNodeId(`view.${slugify(element.id)}`, nodes);
    const snippet = extractHtmlSnippet(source, element.id);
    const line = snippet.line;
    nodes.push({
      id,
      kind: "view",
      label: selector,
      name: selector,
      selector,
      tagName: element.tagName.toLowerCase(),
      file: "index.html",
      line,
      snippet: snippet.text,
      readOnly: true
    });
    selectorToId.set(selector, id);
  });

  return { source, nodes, selectorToId };
}

function parseJavaScriptSource(source, htmlInfo) {
  const ast = acorn.parse(source, {
    ecmaVersion: "latest",
    sourceType: "script",
    locations: true
  });

  const refsMap = new Map();
  const containers = {};
  const nodes = [];
  const edges = [];
  const semanticMaps = {
    state: new Map(),
    action: new Map(),
    effect: new Map(),
    binding: new Map()
  };

  for (const statement of ast.body) {
    if (statement.type !== "VariableDeclaration") {
      continue;
    }

    for (const declaration of statement.declarations) {
      if (declaration.id.type !== "Identifier" || !declaration.init || declaration.init.type !== "ObjectExpression") {
        continue;
      }

      const containerName = declaration.id.name;
      if (containerName === "refs") {
        declaration.init.properties.forEach((prop) => {
          const key = objectPropertyName(prop);
          const selector = extractSelectorFromExpression(prop.value, source, refsMap);
          if (key && selector) {
            refsMap.set(key, selector);
          }
        });
      }

      if (!["state", "actions", "effects", "bindings"].includes(containerName)) {
        continue;
      }

      containers[containerName] = {
        declaration,
        object: declaration.init,
        properties: declaration.init.properties.slice()
      };

      if (containerName === "state") {
        declaration.init.properties.forEach((prop) => {
          const name = objectPropertyName(prop);
          if (!name) {
            return;
          }
          const id = `state.${name}`;
          const node = {
            id,
            kind: "state",
            label: name,
            name,
            file: "app.js",
            line: prop.loc.start.line,
            container: "state",
            sourceRange: [prop.start, prop.end],
            nameRange: [prop.key.start, prop.key.end],
            valueRange: [prop.value.start, prop.value.end],
            bodyText: source.slice(prop.value.start, prop.value.end),
            snippet: source.slice(prop.start, prop.end)
          };
          nodes.push(node);
          semanticMaps.state.set(name, id);
        });
      } else {
        const kind = containerName === "actions" ? "action" : containerName === "effects" ? "effect" : "binding";
        declaration.init.properties.forEach((prop) => {
          const name = objectPropertyName(prop);
          const fn = propertyFunctionValue(prop);
          if (!name || !fn) {
            return;
          }

          const bodyRange = functionBodyRange(fn);
          const id = `${kind}.${name}`;
          const node = {
            id,
            kind,
            label: name,
            name,
            file: "app.js",
            line: prop.loc.start.line,
            container: containerName,
            sourceRange: [prop.start, prop.end],
            nameRange: [prop.key.start, prop.key.end],
            bodyRange,
            bodyText: source.slice(bodyRange[0], bodyRange[1]).replace(/^\n+|\n+$/g, ""),
            snippet: source.slice(prop.start, prop.end),
            functionNode: fn
          };
          nodes.push(node);
          semanticMaps[kind].set(name, id);
        });
      }
    }
  }

  const eventCounts = new Map();
  acorn.walk.ancestor(ast, {
    CallExpression(node, ancestors) {
      if (!isEventListenerCall(node)) {
        return;
      }

      const statement = [...ancestors].reverse().find((entry) => entry.type === "ExpressionStatement");
      if (!statement) {
        return;
      }

      const selector = extractSelectorFromExpression(node.callee.object, source, refsMap) || source.slice(node.callee.object.start, node.callee.object.end);
      const eventType = literalOrSource(node.arguments[0], source);
      const handlerSource = literalOrSource(node.arguments[1], source);
      const baseId = `event.${slugify(selector)}.${slugify(eventType)}.${slugify(handlerSource)}`;
      const count = eventCounts.get(baseId) || 0;
      eventCounts.set(baseId, count + 1);
      const eventId = count ? `${baseId}-${count + 1}` : baseId;
      const resolvedTarget = resolveHandlerTarget(node.arguments[1], source, semanticMaps);

      nodes.push({
        id: eventId,
        kind: "event",
        label: `${eventType} @ ${selector}`,
        name: `${eventType} @ ${selector}`,
        selector,
        eventType,
        handlerSource,
        handlerTargetId: resolvedTarget.targetId,
        file: "app.js",
        line: statement.loc.start.line,
        sourceRange: [statement.start, statement.end],
        snippet: source.slice(statement.start, statement.end)
      });

      const viewNodeId = htmlInfo.selectorToId.get(selector);
      if (viewNodeId) {
        edges.push({ from: viewNodeId, to: eventId, label: "dispatches" });
      }
      if (resolvedTarget.targetId) {
        edges.push({ from: eventId, to: resolvedTarget.targetId, label: "triggers" });
      }
    }
  });

  nodes
    .filter((node) => ["action", "effect", "binding"].includes(node.kind))
    .forEach((node) => {
      const analysis = analyzeFunctionNode(node.functionNode, source, refsMap, semanticMaps, htmlInfo);
      analysis.stateReads.forEach((name) => {
        const stateId = semanticMaps.state.get(name);
        if (stateId) {
          edges.push({ from: stateId, to: node.id, label: node.kind === "binding" ? "renders" : "reads" });
        }
      });
      analysis.stateWrites.forEach((name) => {
        const stateId = semanticMaps.state.get(name);
        if (stateId) {
          edges.push({ from: node.id, to: stateId, label: "writes" });
        }
      });
      analysis.calls.effects.forEach((name) => {
        const effectId = semanticMaps.effect.get(name);
        if (effectId) {
          edges.push({ from: node.id, to: effectId, label: "calls" });
        }
      });
      analysis.calls.bindings.forEach((name) => {
        const bindingId = semanticMaps.binding.get(name);
        if (bindingId) {
          edges.push({ from: node.id, to: bindingId, label: "calls" });
        }
      });
      analysis.viewWrites.forEach((selector) => {
        const viewNodeId = htmlInfo.selectorToId.get(selector);
        if (viewNodeId) {
          edges.push({ from: node.id, to: viewNodeId, label: "updates" });
        }
      });
    });

  return {
    source,
    ast,
    refsMap,
    containers,
    nodes,
    edges,
    semanticMaps
  };
}

function analyzeFunctionNode(fn, source, refsMap, semanticMaps, htmlInfo) {
  const analysis = {
    stateReads: new Set(),
    stateWrites: new Set(),
    calls: {
      effects: new Set(),
      bindings: new Set()
    },
    viewWrites: new Set()
  };

  if (!fn || !fn.body || fn.body.type !== "BlockStatement") {
    return analysis;
  }

  acorn.walk.ancestor(fn.body, {
    MemberExpression(node, ancestors) {
      const parent = ancestors[ancestors.length - 2];
      if (!node.computed && node.object.type === "Identifier" && node.object.name === "state" && node.property.type === "Identifier") {
        if (parent && parent.type === "AssignmentExpression" && parent.left === node) {
          analysis.stateWrites.add(node.property.name);
        } else if (parent && parent.type === "UpdateExpression" && parent.argument === node) {
          analysis.stateWrites.add(node.property.name);
        } else {
          analysis.stateReads.add(node.property.name);
        }
      }

      const refWrite = extractRefWrite(node, parent);
      if (refWrite && refsMap.has(refWrite)) {
        const selector = refsMap.get(refWrite);
        if (htmlInfo.selectorToId.has(selector)) {
          analysis.viewWrites.add(selector);
        }
      }
    },
    CallExpression(node) {
      const callee = node.callee;
      if (
        callee.type === "MemberExpression" &&
        !callee.computed &&
        callee.object.type === "Identifier" &&
        callee.property.type === "Identifier"
      ) {
        if (callee.object.name === "effects") {
          analysis.calls.effects.add(callee.property.name);
        }
        if (callee.object.name === "bindings") {
          analysis.calls.bindings.add(callee.property.name);
        }
      }
    }
  });

  return analysis;
}

function extractRefWrite(memberNode, parent) {
  if (!parent || parent.type !== "AssignmentExpression" || parent.left !== memberNode) {
    return null;
  }

  if (
    memberNode.object &&
    memberNode.object.type === "MemberExpression" &&
    !memberNode.object.computed &&
    memberNode.object.object.type === "Identifier" &&
    memberNode.object.object.name === "refs" &&
    memberNode.object.property.type === "Identifier"
  ) {
    return memberNode.object.property.name;
  }

  return null;
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

function propertyFunctionValue(prop) {
  if (!prop || !prop.value) {
    return null;
  }
  if (prop.value.type === "FunctionExpression" || prop.value.type === "ArrowFunctionExpression") {
    return prop.value;
  }
  return null;
}

function functionBodyRange(fn) {
  if (!fn.body) {
    return [fn.start, fn.end];
  }
  if (fn.body.type === "BlockStatement") {
    return [fn.body.start + 1, fn.body.end - 1];
  }
  return [fn.body.start, fn.body.end];
}

function isEventListenerCall(node) {
  return (
    node &&
    node.callee &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "addEventListener" &&
    node.arguments.length >= 2
  );
}

function extractSelectorFromExpression(expression, source, refsMap) {
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
    if (expression.callee.property.name === "querySelector" && expression.arguments[0].type === "Literal") {
      return String(expression.arguments[0].value);
    }
    if (expression.callee.property.name === "getElementById" && expression.arguments[0].type === "Literal") {
      return `#${expression.arguments[0].value}`;
    }
  }

  if (
    expression.type === "MemberExpression" &&
    !expression.computed &&
    expression.object.type === "Identifier" &&
    expression.object.name === "refs" &&
    expression.property.type === "Identifier" &&
    refsMap.has(expression.property.name)
  ) {
    return refsMap.get(expression.property.name);
  }

  return null;
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

function resolveHandlerTarget(expression, source, semanticMaps) {
  if (!expression) {
    return { targetId: null, source: "" };
  }

  if (
    expression.type === "MemberExpression" &&
    !expression.computed &&
    expression.object.type === "Identifier" &&
    expression.property.type === "Identifier"
  ) {
    if (expression.object.name === "actions" && semanticMaps.action.has(expression.property.name)) {
      return { targetId: semanticMaps.action.get(expression.property.name), source: source.slice(expression.start, expression.end) };
    }
    if (expression.object.name === "effects" && semanticMaps.effect.has(expression.property.name)) {
      return { targetId: semanticMaps.effect.get(expression.property.name), source: source.slice(expression.start, expression.end) };
    }
    if (expression.object.name === "bindings" && semanticMaps.binding.has(expression.property.name)) {
      return { targetId: semanticMaps.binding.get(expression.property.name), source: source.slice(expression.start, expression.end) };
    }
  }

  if (expression.type === "ArrowFunctionExpression" || expression.type === "FunctionExpression") {
    const inlineCalls = {
      targetId: null
    };
    acorn.walk.simple(expression.body, {
      CallExpression(node) {
        if (inlineCalls.targetId) {
          return;
        }
        if (
          node.callee.type === "MemberExpression" &&
          !node.callee.computed &&
          node.callee.object.type === "Identifier" &&
          node.callee.property.type === "Identifier" &&
          node.callee.object.name === "actions" &&
          semanticMaps.action.has(node.callee.property.name)
        ) {
          inlineCalls.targetId = semanticMaps.action.get(node.callee.property.name);
        }
      }
    });
    return { targetId: inlineCalls.targetId, source: source.slice(expression.start, expression.end) };
  }

  return { targetId: null, source: source.slice(expression.start, expression.end) };
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
      <span class="graph-node-kind">${node.kind}</span>
      <h3>${escapeHtml(node.label)}</h3>
      <p>${escapeHtml(node.kind === "event" ? `${node.eventType} on ${node.selector}` : node.file)}</p>
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
  if (node.kind === "state") {
    return {
      nameLabel: "State name",
      nameValue: node.name,
      nameDisabled: false,
      primaryLabel: "Container",
      primaryValue: "state",
      primaryDisabled: true,
      secondaryLabel: "File",
      secondaryValue: node.file,
      secondaryDisabled: true,
      bodyLabel: "Value expression",
      bodyValue: node.bodyText,
      bodyDisabled: false,
      hint: "Editing this field patches the actual property inside the state object."
    };
  }

  if (["action", "effect", "binding"].includes(node.kind)) {
    return {
      nameLabel: `${capitalize(node.kind)} name`,
      nameValue: node.name,
      nameDisabled: false,
      primaryLabel: "Container",
      primaryValue: node.container,
      primaryDisabled: true,
      secondaryLabel: "File",
      secondaryValue: node.file,
      secondaryDisabled: true,
      bodyLabel: "Function body",
      bodyValue: node.bodyText,
      bodyDisabled: false,
      hint: "This body editor patches the real JS source in app.js."
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
      secondaryLabel: "Event type",
      secondaryValue: node.eventType,
      secondaryDisabled: false,
      bodyLabel: "Handler expression",
      bodyValue: node.handlerSource,
      bodyDisabled: false,
      hint: "Editing selector, event type, or handler rewrites the actual addEventListener statement."
    };
  }

  return {
    nameLabel: "Selector",
    nameValue: node.selector,
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
    elements.secondaryMetaText.textContent = "Live preview and selected source slice.";
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

  if (node.kind === "event") {
    updateEventNode(node, {
      selector: elements.nodePrimaryField.value.trim(),
      eventType: elements.nodeSecondaryField.value.trim(),
      handlerSource: elements.nodeBodyField.value.trim()
    });
    return;
  }

  if (elements.nodeNameField.value.trim() && elements.nodeNameField.value.trim() !== node.name) {
    renameSemanticNode(node, elements.nodeNameField.value.trim());
    return;
  }

  if (node.kind === "state") {
    updateStateValue(node, elements.nodeBodyField.value);
    return;
  }

  updateFunctionBody(node, elements.nodeBodyField.value);
}

function renameSemanticNode(node, requestedName) {
  const nextName = sanitizeIdentifier(requestedName);
  if (!nextName) {
    setStatus("Names must be valid JavaScript identifiers.", "warning");
    return;
  }
  if (lastSuccessfulParse.nodes.find((entry) => entry.id !== node.id && entry.kind === node.kind && entry.name === nextName)) {
    setStatus(`A ${node.kind} named ${nextName} already exists.`, "warning");
    return;
  }

  const js = lastSuccessfulParse.js;
  const objectName = node.kind === "state" ? "state" : `${node.container}`;
  const replacementRanges = [
    { start: node.nameRange[0], end: node.nameRange[1], text: nextName }
  ];

  if (node.kind === "state") {
    collectMemberReferenceRanges(js.ast, "state", node.name).forEach((range) => replacementRanges.push({ ...range, text: nextName }));
  } else if (["action", "effect", "binding"].includes(node.kind)) {
    const objectRef = node.kind === "action" ? "actions" : node.kind === "effect" ? "effects" : "bindings";
    collectMemberReferenceRanges(js.ast, objectRef, node.name).forEach((range) => replacementRanges.push({ ...range, text: nextName }));
  }

  const nextSource = applyReplacements(files["app.js"], replacementRanges);
  files["app.js"] = nextSource;
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  selectedNodeId = `${node.kind}.${nextName}`;
  applyCurrentSource(`Renamed ${node.id} to ${nextName}.`);
}

function updateStateValue(node, nextValue) {
  files["app.js"] = replaceRange(files["app.js"], node.valueRange[0], node.valueRange[1], nextValue);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  applyCurrentSource(`Updated ${node.id}.`);
  selectedNodeId = node.id;
}

function updateFunctionBody(node, nextBody) {
  const replacement = formatFunctionBody(files["app.js"], node, nextBody);
  files["app.js"] = replaceRange(files["app.js"], node.bodyRange[0], node.bodyRange[1], replacement);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  applyCurrentSource(`Updated ${node.id}.`);
  selectedNodeId = node.id;
}

function updateEventNode(node, patch) {
  const selector = patch.selector || node.selector;
  const eventType = patch.eventType || node.eventType;
  const handlerSource = patch.handlerSource || node.handlerSource;
  const indent = lineIndentAt(files["app.js"], node.sourceRange[0]);
  const statement = `${indent}${buildListenerStatement(selector, eventType, handlerSource)}`;
  files["app.js"] = replaceRange(files["app.js"], node.sourceRange[0], node.sourceRange[1], statement);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  selectedNodeId = buildEventSelectionId(selector, eventType, handlerSource);
  applyCurrentSource("Updated event listener.");
}

function buildListenerStatement(selector, eventType, handlerSource) {
  return `document.querySelector(${JSON.stringify(selector)}).addEventListener(${JSON.stringify(eventType)}, ${handlerSource});`;
}

function buildEventSelectionId(selector, eventType, handlerSource) {
  return `event.${slugify(selector)}.${slugify(eventType)}.${slugify(handlerSource)}`;
}

function collectMemberReferenceRanges(ast, objectName, propertyName) {
  const ranges = [];
  acorn.walk.ancestor(ast, {
    MemberExpression(node) {
      if (
        !node.computed &&
        node.object.type === "Identifier" &&
        node.object.name === objectName &&
        node.property.type === "Identifier" &&
        node.property.name === propertyName
      ) {
        ranges.push({ start: node.property.start, end: node.property.end });
      }
    }
  });
  return dedupeReplacementRanges(ranges);
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
  if (kind === "state") {
    addStateNode();
    return;
  }
  if (["action", "effect", "binding"].includes(kind)) {
    addFunctionNode(kind);
  }
}

function addStateNode() {
  const baseName = nextAvailableName("state", "stateValue");
  let workingSource = files["app.js"];
  let parseInfo = lastSuccessfulParse.js;
  ({ source: workingSource, parseInfo } = ensureContainer(workingSource, parseInfo, "state"));
  const container = parseInfo.containers.state;
  const propertySource = `${baseName}: null`;
  files["app.js"] = insertObjectEntry(workingSource, container, propertySource);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  selectedNodeId = `state.${baseName}`;
  applyCurrentSource(`Added state.${baseName}.`);
}

function addFunctionNode(kind) {
  const containerName = kind === "action" ? "actions" : kind === "effect" ? "effects" : "bindings";
  const baseName = nextAvailableName(kind, `${kind}Node`);
  let workingSource = files["app.js"];
  let parseInfo = lastSuccessfulParse.js;
  ({ source: workingSource, parseInfo } = ensureContainer(workingSource, parseInfo, containerName));
  const container = parseInfo.containers[containerName];
  const methodSource = buildMethodSource(baseName, defaultMethodBody(kind));
  files["app.js"] = insertObjectEntry(workingSource, container, methodSource, true);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  selectedNodeId = `${kind}.${baseName}`;
  applyCurrentSource(`Added ${kind}.${baseName}.`);
}

function addEventListenerNode() {
  const selector = firstHtmlSelector() || "#task-form";
  const handler = firstActionHandler() || "actions.bootstrap";
  const statement = `\n${buildListenerStatement(selector, "click", handler)}\n`;
  files["app.js"] = files["app.js"].trimEnd() + statement;
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  selectedNodeId = buildEventSelectionId(selector, "click", handler);
  applyCurrentSource(`Added click listener on ${selector}.`);
}

function ensureContainer(source, parseInfo, containerName) {
  if (parseInfo.containers[containerName]) {
    return { source, parseInfo };
  }

  const skeleton = containerName === "state"
    ? `\nconst state = {\n};\n`
    : `\nconst ${containerName} = {\n};\n`;
  const nextSource = `${source.trimEnd()}\n\n${skeleton}`;
  return {
    source: nextSource,
    parseInfo: parseJavaScriptSource(nextSource, parseHtmlSource(files["index.html"]))
  };
}

function insertObjectEntry(source, container, entrySource, isMethod) {
  const insertPos = container.object.end - 1;
  const closingIndent = lineIndentAt(source, container.object.end - 1);
  const propertyIndent = `${closingIndent}  `;
  const hasEntries = container.properties.length > 0;
  const prefix = hasEntries ? ",\n" : "\n";
  const text = isMethod
    ? `${prefix}${indentMultiline(entrySource, propertyIndent)}\n${closingIndent}`
    : `${prefix}${propertyIndent}${entrySource}\n${closingIndent}`;
  return source.slice(0, insertPos) + text + source.slice(insertPos);
}

function buildMethodSource(name, body) {
  const lines = body.trim().split("\n");
  return `${sanitizeIdentifier(name)}() {\n${lines.map((line) => `  ${line}`).join("\n")}\n}`;
}

function defaultMethodBody(kind) {
  if (kind === "binding") {
    return `refs.output.textContent = String(state.example);`;
  }
  if (kind === "effect") {
    return `console.log("effect: replace me");`;
  }
  return `// TODO: implement ${kind}\n`;
}

function connectNodes(sourceId, targetId) {
  const sourceNode = lastSuccessfulParse.nodes.find((node) => node.id === sourceId);
  const targetNode = lastSuccessfulParse.nodes.find((node) => node.id === targetId);
  if (!sourceNode || !targetNode) {
    return;
  }

  if (sourceNode.kind === "event" && ["action", "effect", "binding"].includes(targetNode.kind)) {
    updateEventNode(sourceNode, {
      selector: sourceNode.selector,
      eventType: sourceNode.eventType,
      handlerSource: `${targetNode.kind === "action" ? "actions" : targetNode.kind === "effect" ? "effects" : "bindings"}.${targetNode.name}`
    });
    return;
  }

  if (sourceNode.kind === "action" && ["effect", "binding"].includes(targetNode.kind)) {
    const objectRef = targetNode.kind === "effect" ? "effects" : "bindings";
    const callLine = `${objectRef}.${targetNode.name}();`;
    if (sourceNode.bodyText.includes(callLine)) {
      setStatus("That call already exists in the selected action.", "warning");
      return;
    }
    const nextBody = `${sourceNode.bodyText.trimEnd()}\n${callLine}`;
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

  if (node.kind === "event") {
    files["app.js"] = removeRangeWithWhitespace(files["app.js"], node.sourceRange[0], node.sourceRange[1]);
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

  files["app.js"] = removeNodeDefinition(files["app.js"], lastSuccessfulParse.js, node);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  selectedNodeId = null;
  applyCurrentSource(`Removed ${node.id}.`);
}

function hasExternalReferences(node) {
  const js = lastSuccessfulParse.js;
  if (node.kind === "state") {
    return collectMemberReferenceRanges(js.ast, "state", node.name).length > 0;
  }
  if (["action", "effect", "binding"].includes(node.kind)) {
    const objectRef = node.kind === "action" ? "actions" : node.kind === "effect" ? "effects" : "bindings";
    return collectMemberReferenceRanges(js.ast, objectRef, node.name).length > 0;
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

  match = prompt.match(/^add\s+state\s+([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*=\s*([\s\S]+))?$/i);
  if (match) {
    addStateNodeFromPrompt(match[1], (match[2] || "null").trim());
    return `Added state \`${match[1]}\` to app.js.`;
  }

  match = prompt.match(/^add\s+(action|effect|binding)\s+([A-Za-z_$][A-Za-z0-9_$]*)$/i);
  if (match) {
    addFunctionNodeFromPrompt(match[1].toLowerCase(), match[2]);
    return `Added ${match[1].toLowerCase()} \`${match[2]}\` to app.js.`;
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
    if (node.kind === "event" || node.kind === "view") {
      throw new Error("Rename currently supports state, action, effect, and binding nodes.");
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
    if (!node || !["action", "effect", "binding"].includes(node.kind)) {
      throw new Error("I could only find code-editable action, effect, or binding nodes for that command.");
    }
    updateFunctionBody(node, match[2].trim());
    return `Updated the code body of \`${node.id}\`.`;
  }

  match = prompt.match(/^set\s+value\s+of\s+(.+?)\s+to\s+([\s\S]+)$/i);
  if (match) {
    const node = resolveNode(match[1]);
    if (!node || node.kind !== "state") {
      throw new Error("That command only works for state nodes.");
    }
    updateStateValue(node, match[2].trim());
    return `Updated the value expression of \`${node.id}\`.`;
  }

  return "Prompt mode understands: add state, add action/effect/binding, add event ... on ... -> ..., rename, delete, connect, set code of ..., and set value of ....";
}

function addStateNodeFromPrompt(name, value) {
  const validName = sanitizeIdentifier(name);
  if (!validName) {
    throw new Error("State names must be valid JavaScript identifiers.");
  }
  if (lastSuccessfulParse.nodes.find((node) => node.kind === "state" && node.name === validName)) {
    throw new Error(`State ${validName} already exists.`);
  }
  let workingSource = files["app.js"];
  let parseInfo = lastSuccessfulParse.js;
  ({ source: workingSource, parseInfo } = ensureContainer(workingSource, parseInfo, "state"));
  files["app.js"] = insertObjectEntry(workingSource, parseInfo.containers.state, `${validName}: ${value}`);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  selectedNodeId = `state.${validName}`;
  applyCurrentSource(`Added state.${validName}.`);
}

function addFunctionNodeFromPrompt(kind, name) {
  const validName = sanitizeIdentifier(name);
  if (!validName) {
    throw new Error(`${capitalize(kind)} names must be valid JavaScript identifiers.`);
  }
  if (lastSuccessfulParse.nodes.find((node) => node.kind === kind && node.name === validName)) {
    throw new Error(`${capitalize(kind)} ${validName} already exists.`);
  }
  const containerName = kind === "action" ? "actions" : kind === "effect" ? "effects" : "bindings";
  let workingSource = files["app.js"];
  let parseInfo = lastSuccessfulParse.js;
  ({ source: workingSource, parseInfo } = ensureContainer(workingSource, parseInfo, containerName));
  files["app.js"] = insertObjectEntry(workingSource, parseInfo.containers[containerName], buildMethodSource(validName, defaultMethodBody(kind)), true);
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  selectedNodeId = `${kind}.${validName}`;
  applyCurrentSource(`Added ${kind}.${validName}.`);
}

function addEventNodeFromPrompt(selector, eventType, handlerSource) {
  files["app.js"] = `${files["app.js"].trimEnd()}\n${buildListenerStatement(selector, eventType, handlerSource)}\n`;
  saveFiles();
  if (activeFile === "app.js") {
    syncSourceEditor();
  }
  selectedNodeId = buildEventSelectionId(selector, eventType, handlerSource);
  applyCurrentSource(`Added ${eventType} listener on ${selector}.`);
}

function resolveNode(reference) {
  if (!lastSuccessfulParse) {
    return null;
  }

  const needle = reference.trim().toLowerCase();
  return lastSuccessfulParse.nodes.find((node) => {
    return node.id.toLowerCase() === needle ||
      node.label.toLowerCase() === needle ||
      (node.name && node.name.toLowerCase() === needle) ||
      (node.selector && node.selector.toLowerCase() === needle) ||
      (node.kind === "event" && `${node.eventType} @ ${node.selector}`.toLowerCase() === needle);
  }) || null;
}

function showPromptHelp() {
  appendPrompt("assistant", [
    "Prompt examples:",
    "add state selectedTask = null",
    "add action clearCompleted",
    "add effect saveTheme",
    "add binding renderFooter",
    "add event click on #task-list -> actions.toggleTask",
    "rename addTask to createTask",
    "delete saveCache",
    "connect click @ #task-list -> toggleTask",
    "set code of addTask to ...",
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
      text: "Workspace reset. The left pane is back to the default HTML, CSS, and JS demo, and the graph has been re-derived from those files."
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
  const parse = lastSuccessfulParse;
  let candidate = sanitizeIdentifier(base);
  let counter = 2;
  while (parse.nodes.find((node) => node.kind === kind && node.name === candidate)) {
    candidate = `${sanitizeIdentifier(base)}${counter}`;
    counter += 1;
  }
  return candidate;
}

function firstActionHandler() {
  const actionNode = lastSuccessfulParse.nodes.find((node) => node.kind === "action");
  return actionNode ? `actions.${actionNode.name}` : null;
}

function firstHtmlSelector() {
  const viewNode = lastSuccessfulParse.nodes.find((node) => node.kind === "view");
  return viewNode ? viewNode.selector : null;
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

function removeNodeDefinition(source, jsInfo, node) {
  if (!["state", "action", "effect", "binding"].includes(node.kind)) {
    return removeRangeWithWhitespace(source, node.sourceRange[0], node.sourceRange[1]);
  }

  const containerName = node.kind === "state" ? "state" : node.kind === "action" ? "actions" : node.kind === "effect" ? "effects" : "bindings";
  const container = jsInfo.containers[containerName];
  if (!container) {
    return removeRangeWithWhitespace(source, node.sourceRange[0], node.sourceRange[1]);
  }

  const index = container.properties.findIndex((prop) => prop.start === node.sourceRange[0] && prop.end === node.sourceRange[1]);
  if (index === -1) {
    return removeRangeWithWhitespace(source, node.sourceRange[0], node.sourceRange[1]);
  }

  const properties = container.properties;
  let start = node.sourceRange[0];
  let end = node.sourceRange[1];

  if (properties.length === 1) {
    return source.slice(0, start) + source.slice(end);
  }

  if (index < properties.length - 1) {
    end = properties[index + 1].start;
  } else {
    start = properties[index - 1].end;
  }

  return source.slice(0, start) + source.slice(end);
}

function formatFunctionBody(source, node, nextBody) {
  const closingIndent = lineIndentAt(source, node.bodyRange[1]);
  const innerIndent = `${closingIndent}  `;
  const trimmed = nextBody.replace(/^\n+|\n+$/g, "");
  if (!trimmed.trim()) {
    return `\n${closingIndent}`;
  }
  return `\n${trimmed.split("\n").map((line) => `${innerIndent}${line.trimEnd()}`).join("\n")}\n${closingIndent}`;
}

function lineIndentAt(source, index) {
  const lineStart = source.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
  const match = source.slice(lineStart).match(/^\s*/);
  return match ? match[0] : "";
}

function indentMultiline(text, indent) {
  return text.split("\n").map((line, index) => index === 0 ? `${indent}${line}` : `${indent}${line}`).join("\n");
}

function sanitizeIdentifier(value) {
  const cleaned = String(value).trim().replace(/[^A-Za-z0-9_$]+/g, "");
  if (!cleaned) {
    return "";
  }
  return cleaned.match(/^[A-Za-z_$]/) ? cleaned : `n${cleaned}`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "node";
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
