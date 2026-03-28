const STORAGE_KEY = "bicameral.ide.model.v2";
const PROMPT_LOG_KEY = "bicameral.ide.prompt.v1";
const KIND_ORDER = ["state", "event", "action", "effect", "binding"];
const EDGE_LABELS = {
  "event:action": "triggers",
  "action:state": "writes",
  "state:binding": "feeds",
  "action:effect": "runs",
  "binding:action": "delegates",
  "state:action": "reads",
  "action:binding": "renders"
};
const KIND_COLORS = {
  state: "#5fd0a5",
  event: "#ffca62",
  action: "#ff7d6b",
  effect: "#79a8ff",
  binding: "#cf9bff"
};

const DEFAULT_MODEL = normalizeModel({
  meta: {
    name: "Bicameral Starter",
    description: "A minimal semantic program that round-trips between JSON, block code, prompt commands, and the graph."
  },
  nodes: [
    {
      id: "state.tasks",
      kind: "state",
      title: "tasks",
      description: "Array of todo items with completion state.",
      x: 72,
      y: 76,
      value: "[]"
    },
    {
      id: "state.draftText",
      kind: "state",
      title: "draftText",
      description: "Current input value before a task is committed.",
      x: 72,
      y: 232,
      value: "\"\""
    },
    {
      id: "event.submitTask",
      kind: "event",
      title: "submitTask",
      description: "Triggered when the task form submits.",
      x: 330,
      y: 76,
      source: "form#taskForm submit"
    },
    {
      id: "action.addTask",
      kind: "action",
      title: "addTask",
      description: "Creates a task from draftText and clears the input.",
      x: 330,
      y: 232,
      code: "const label = state.draftText.trim();\nif (!label) return;\nstate.tasks = [{ id: makeId(), label, done: false }, ...state.tasks];\nstate.draftText = \"\";"
    },
    {
      id: "action.toggleTask",
      kind: "action",
      title: "toggleTask",
      description: "Flips a task's done flag.",
      x: 330,
      y: 388,
      code: "state.tasks = state.tasks.map((task) =>\n  task.id === payload.id ? { ...task, done: !task.done } : task\n);"
    },
    {
      id: "effect.saveCache",
      kind: "effect",
      title: "saveCache",
      description: "Persists tasks to localStorage.",
      x: 600,
      y: 154,
      code: "localStorage.setItem(\"bicameral.tasks\", JSON.stringify(state.tasks));"
    },
    {
      id: "binding.taskList",
      kind: "binding",
      title: "taskList",
      description: "Projects tasks into a rendered list.",
      x: 600,
      y: 340,
      code: "refs.taskList.innerHTML = state.tasks.map(renderTaskCard).join(\"\");"
    }
  ],
  edges: [
    { id: "edge-1", from: "event.submitTask", to: "action.addTask", label: "triggers" },
    { id: "edge-2", from: "action.addTask", to: "state.tasks", label: "writes" },
    { id: "edge-3", from: "action.addTask", to: "state.draftText", label: "writes" },
    { id: "edge-4", from: "action.addTask", to: "effect.saveCache", label: "runs" },
    { id: "edge-5", from: "state.tasks", to: "binding.taskList", label: "feeds" },
    { id: "edge-6", from: "binding.taskList", to: "action.toggleTask", label: "delegates" },
    { id: "edge-7", from: "action.toggleTask", to: "state.tasks", label: "writes" },
    { id: "edge-8", from: "action.toggleTask", to: "effect.saveCache", label: "runs" }
  ]
});

const elements = {
  modelEditor: document.querySelector("#modelEditor"),
  blockEditor: document.querySelector("#blockEditor"),
  runtimeView: document.querySelector("#runtimeView"),
  modelLineNumbers: document.querySelector("#modelLineNumbers"),
  blockLineNumbers: document.querySelector("#blockLineNumbers"),
  graphCanvas: document.querySelector("#graphCanvas"),
  graphSvg: document.querySelector("#graphSvg"),
  promptLog: document.querySelector("#promptLog"),
  promptInput: document.querySelector("#promptInput"),
  inspectorHeading: document.querySelector("#inspectorHeading"),
  inspectorKindPill: document.querySelector("#inspectorKindPill"),
  inspectorEmpty: document.querySelector("#inspectorEmpty"),
  inspectorContent: document.querySelector("#inspectorContent"),
  nodeIdField: document.querySelector("#nodeIdField"),
  nodeTitleField: document.querySelector("#nodeTitleField"),
  nodeDescriptionField: document.querySelector("#nodeDescriptionField"),
  nodeXField: document.querySelector("#nodeXField"),
  nodeYField: document.querySelector("#nodeYField"),
  nodeBodyHint: document.querySelector("#nodeBodyHint"),
  edgeList: document.querySelector("#edgeList"),
  applyJsonButton: document.querySelector("#applyJsonButton"),
  formatJsonButton: document.querySelector("#formatJsonButton"),
  copyRuntimeButton: document.querySelector("#copyRuntimeButton"),
  resetWorkspaceButton: document.querySelector("#resetWorkspaceButton"),
  runPromptButton: document.querySelector("#runPromptButton"),
  helpPromptButton: document.querySelector("#helpPromptButton"),
  linkModeButton: document.querySelector("#linkModeButton"),
  autoLayoutButton: document.querySelector("#autoLayoutButton"),
  deleteNodeButton: document.querySelector("#deleteNodeButton"),
  clearEdgesButton: document.querySelector("#clearEdgesButton"),
  jsonStatusText: document.querySelector("#jsonStatusText"),
  blockMetaText: document.querySelector("#blockMetaText"),
  statusText: document.querySelector("#statusText"),
  selectionText: document.querySelector("#selectionText"),
  storageText: document.querySelector("#storageText"),
  syncPill: document.querySelector("#syncPill"),
  lowerTabs: [...document.querySelectorAll("[data-lower-tab]")],
  lowerPanes: [...document.querySelectorAll("[data-lower-pane]")],
  addKindButtons: [...document.querySelectorAll("[data-add-kind]")],
  exampleChips: [...document.querySelectorAll("[data-prompt]")]
};

let model = loadModel();
let promptLog = loadPromptLog();
let selectedNodeId = model.nodes[0] ? model.nodes[0].id : null;
let activeLowerTab = "block";
let linkSourceId = null;
let dragging = null;
let jsonParseTimer = null;
let syncingModelEditor = false;
let syncingBlockEditor = false;
let lastJsonError = "";

function boot() {
  syncModelEditor();
  renderPromptLog();
  renderAll("Booted Bicameral.");
  bindEvents();
}

function bindEvents() {
  elements.modelEditor.addEventListener("input", onModelEditorInput);
  elements.modelEditor.addEventListener("scroll", () => syncGutterScroll(elements.modelEditor, elements.modelLineNumbers));
  elements.blockEditor.addEventListener("input", onBlockEditorInput);
  elements.blockEditor.addEventListener("scroll", () => syncGutterScroll(elements.blockEditor, elements.blockLineNumbers));

  elements.applyJsonButton.addEventListener("click", applyModelEditorNow);
  elements.formatJsonButton.addEventListener("click", formatModelEditor);
  elements.copyRuntimeButton.addEventListener("click", copyRuntime);
  elements.resetWorkspaceButton.addEventListener("click", resetWorkspace);
  elements.runPromptButton.addEventListener("click", runPrompt);
  elements.helpPromptButton.addEventListener("click", showPromptHelp);
  elements.linkModeButton.addEventListener("click", enterLinkMode);
  elements.autoLayoutButton.addEventListener("click", () => {
    autoLayout();
    finalizeModelMutation("Auto layout applied.");
  });
  elements.deleteNodeButton.addEventListener("click", deleteSelectedNode);
  elements.clearEdgesButton.addEventListener("click", clearSelectedNodeEdges);

  elements.nodeTitleField.addEventListener("input", () => mutateSelectedNode((node) => {
    node.title = elements.nodeTitleField.value;
  }, "Updated node title."));
  elements.nodeDescriptionField.addEventListener("input", () => mutateSelectedNode((node) => {
    node.description = elements.nodeDescriptionField.value;
  }, "Updated node description."));
  elements.nodeXField.addEventListener("input", () => mutateSelectedNode((node) => {
    node.x = Number(elements.nodeXField.value) || 0;
  }, "Moved node."));
  elements.nodeYField.addEventListener("input", () => mutateSelectedNode((node) => {
    node.y = Number(elements.nodeYField.value) || 0;
  }, "Moved node."));

  elements.lowerTabs.forEach((button) => {
    button.addEventListener("click", () => setLowerTab(button.dataset.lowerTab));
  });

  elements.addKindButtons.forEach((button) => {
    button.addEventListener("click", () => addNode(button.dataset.addKind));
  });

  elements.exampleChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      elements.promptInput.value = chip.dataset.prompt;
      elements.promptInput.focus();
    });
  });

  elements.edgeList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-edge]");
    if (!button) {
      return;
    }

    const edgeId = button.dataset.removeEdge;
    model.edges = model.edges.filter((edge) => edge.id !== edgeId);
    finalizeModelMutation("Removed edge.");
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && document.activeElement === elements.promptInput) {
      event.preventDefault();
      runPrompt();
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "s") {
      event.preventDefault();
      formatModelEditor();
    }
  });
}

function loadModel() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return clone(DEFAULT_MODEL);
    }
    return normalizeModel(JSON.parse(saved));
  } catch (error) {
    return clone(DEFAULT_MODEL);
  }
}

function loadPromptLog() {
  try {
    const saved = localStorage.getItem(PROMPT_LOG_KEY);
    if (!saved) {
      return [
        {
          role: "assistant",
          text: "Bicameral is ready. Edit model.json, drag the graph, change a selected block, or use prompt commands to mutate the same program."
        }
      ];
    }
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveModel() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
}

function savePromptLog() {
  localStorage.setItem(PROMPT_LOG_KEY, JSON.stringify(promptLog.slice(-24)));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeModel(input) {
  const next = {
    meta: {
      name: stringOr(input?.meta?.name, "Bicameral Workspace"),
      description: stringOr(input?.meta?.description, "")
    },
    nodes: [],
    edges: []
  };

  const seenIds = new Set();
  const rawNodes = Array.isArray(input?.nodes) ? input.nodes : [];
  rawNodes.forEach((node, index) => {
    const normalized = normalizeNode(node, index);
    let candidate = normalized.id;
    let counter = 2;
    while (seenIds.has(candidate)) {
      candidate = `${normalized.id}-${counter}`;
      counter += 1;
    }
    normalized.id = candidate;
    seenIds.add(candidate);
    next.nodes.push(normalized);
  });

  const rawEdges = Array.isArray(input?.edges) ? input.edges : [];
  rawEdges.forEach((edge, index) => {
    const normalized = normalizeEdge(edge, index, next.nodes);
    if (normalized) {
      next.edges.push(normalized);
    }
  });

  return next;
}

function normalizeNode(node, index) {
  const kind = KIND_ORDER.includes(node?.kind) ? node.kind : "action";
  const baseTitle = stringOr(node?.title, `node${index + 1}`);
  const normalized = {
    id: stringOr(node?.id, `${kind}.${slugify(baseTitle)}`),
    kind,
    title: baseTitle,
    description: stringOr(node?.description, ""),
    x: finiteNumber(node?.x, defaultPosition(kind, index).x),
    y: finiteNumber(node?.y, defaultPosition(kind, index).y)
  };

  if (kind === "state") {
    normalized.value = stringOr(node?.value, "null");
  } else if (kind === "event") {
    normalized.source = stringOr(node?.source, "button#todo click");
  } else {
    normalized.code = stringOr(node?.code, kind === "binding" ? "refs.output.textContent = String(state.example);" : "// add logic");
  }

  return normalized;
}

function normalizeEdge(edge, index, nodes) {
  const from = stringOr(edge?.from, "");
  const to = stringOr(edge?.to, "");
  if (!nodes.find((node) => node.id === from) || !nodes.find((node) => node.id === to)) {
    return null;
  }

  return {
    id: stringOr(edge?.id, `edge-${index + 1}`),
    from,
    to,
    label: stringOr(edge?.label, defaultEdgeLabel(from, to, nodes))
  };
}

function stringOr(value, fallback) {
  return typeof value === "string" ? value : fallback;
}

function finiteNumber(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "node";
}

function defaultPosition(kind, index) {
  const column = KIND_ORDER.indexOf(kind);
  return {
    x: 70 + column * 250,
    y: 70 + (index % 4) * 152
  };
}

function selectedNode() {
  return model.nodes.find((node) => node.id === selectedNodeId) || null;
}

function setStatus(message, tone) {
  elements.statusText.textContent = message;
  elements.syncPill.textContent = tone === "error" ? "Error" : tone === "warning" ? "Needs review" : "Synced";
  elements.syncPill.style.borderColor = tone === "error" ? "rgba(255, 125, 107, 0.42)" : tone === "warning" ? "rgba(255, 202, 98, 0.4)" : "rgba(95, 208, 165, 0.38)";
  elements.syncPill.style.color = tone === "error" ? "#ffb2a9" : tone === "warning" ? "#ffda91" : "#baf0da";
}

function renderAll(statusMessage) {
  renderGraph();
  renderRuntime();
  renderInspector();
  renderBlockEditor();
  renderSelectionStatus();
  if (statusMessage) {
    setStatus(statusMessage, lastJsonError ? "warning" : "ok");
  }
  saveModel();
}

function renderSelectionStatus() {
  const node = selectedNode();
  elements.selectionText.textContent = node ? `Selected: ${node.id}` : "No node selected";
  elements.storageText.textContent = `Autosaved ${model.nodes.length} nodes / ${model.edges.length} edges`;
}

function syncModelEditor() {
  syncingModelEditor = true;
  elements.modelEditor.value = JSON.stringify(model, null, 2);
  updateLineNumbers(elements.modelEditor, elements.modelLineNumbers);
  syncGutterScroll(elements.modelEditor, elements.modelLineNumbers);
  syncingModelEditor = false;
  elements.jsonStatusText.textContent = lastJsonError || "Source of truth";
}

function onModelEditorInput() {
  updateLineNumbers(elements.modelEditor, elements.modelLineNumbers);
  syncGutterScroll(elements.modelEditor, elements.modelLineNumbers);
  if (syncingModelEditor) {
    return;
  }

  elements.jsonStatusText.textContent = "Parsing JSON...";
  clearTimeout(jsonParseTimer);
  jsonParseTimer = setTimeout(() => {
    try {
      const next = normalizeModel(JSON.parse(elements.modelEditor.value));
      model = next;
      lastJsonError = "";
      elements.jsonStatusText.textContent = "Live JSON parsed";
      renderAll("Applied JSON changes.");
    } catch (error) {
      lastJsonError = error.message;
      elements.jsonStatusText.textContent = `JSON error: ${error.message}`;
      setStatus("JSON parse error. The graph is still using the last valid model.", "error");
    }
  }, 280);
}

function applyModelEditorNow() {
  try {
    model = normalizeModel(JSON.parse(elements.modelEditor.value));
    lastJsonError = "";
    syncModelEditor();
    renderAll("Applied model.json.");
  } catch (error) {
    lastJsonError = error.message;
    elements.jsonStatusText.textContent = `JSON error: ${error.message}`;
    setStatus("Could not apply model.json.", "error");
  }
}

function formatModelEditor() {
  applyModelEditorNow();
  syncModelEditor();
  setStatus("Formatted model.json.", "ok");
}

function renderRuntime() {
  elements.runtimeView.textContent = buildRuntimeSource(model);
}

function buildRuntimeSource(currentModel) {
  const states = currentModel.nodes.filter((node) => node.kind === "state");
  const events = currentModel.nodes.filter((node) => node.kind === "event");
  const actions = currentModel.nodes.filter((node) => node.kind === "action");
  const effects = currentModel.nodes.filter((node) => node.kind === "effect");
  const bindings = currentModel.nodes.filter((node) => node.kind === "binding");

  const lines = [];
  lines.push("// Generated by Bicameral");
  lines.push(`// ${currentModel.meta.name}`);
  if (currentModel.meta.description) {
    lines.push(`// ${currentModel.meta.description}`);
  }
  lines.push("");
  lines.push("const state = {");
  states.forEach((node) => {
    lines.push(`  ${safeProperty(node.title)}: ${node.value},`);
  });
  lines.push("};");
  lines.push("");
  lines.push("const events = {");
  events.forEach((node) => {
    lines.push(`  ${safeProperty(node.title)}: ${JSON.stringify(node.source)},`);
  });
  lines.push("};");
  lines.push("");
  lines.push("const effects = {");
  if (!effects.length) {
    lines.push("  // none yet");
  }
  effects.forEach((node) => {
    lines.push(`  ${safeProperty(node.title)}(ctx) {`);
    lines.push(...indentBlock(node.code));
    lines.push("  },");
  });
  lines.push("};");
  lines.push("");
  lines.push("const bindings = {");
  if (!bindings.length) {
    lines.push("  // none yet");
  }
  bindings.forEach((node) => {
    lines.push(`  ${safeProperty(node.title)}(ctx) {`);
    lines.push(...indentBlock(node.code));
    lines.push("  },");
  });
  lines.push("};");
  lines.push("");
  lines.push("const actions = {");
  if (!actions.length) {
    lines.push("  // none yet");
  }
  actions.forEach((node) => {
    lines.push(`  ${safeProperty(node.title)}(ctx, payload = {}) {`);
    lines.push(...indentBlock(node.code));
    lines.push("  },");
  });
  lines.push("};");
  lines.push("");
  lines.push("const semanticGraph = [");
  currentModel.edges.forEach((edge) => {
    lines.push(`  { from: ${JSON.stringify(edge.from)}, to: ${JSON.stringify(edge.to)}, label: ${JSON.stringify(edge.label)} },`);
  });
  lines.push("];");
  return lines.join("\n");
}

function safeProperty(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function indentBlock(code) {
  const lines = (code || "").split("\n");
  if (!lines.length) {
    return ["    // empty"];
  }
  return lines.map((line) => `    ${line}`);
}

function renderGraph() {
  const activeNode = selectedNode();
  elements.graphCanvas.innerHTML = "";
  elements.graphSvg.innerHTML = "";

  model.edges.forEach((edge) => {
    const from = model.nodes.find((node) => node.id === edge.from);
    const to = model.nodes.find((node) => node.id === edge.to);
    if (!from || !to) {
      return;
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `graph-edge ${activeNode && (edge.from === activeNode.id || edge.to === activeNode.id) ? "active" : ""}`);
    path.setAttribute("stroke", KIND_COLORS[from.kind]);
    path.setAttribute("d", edgePath(from, to));
    elements.graphSvg.appendChild(path);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const labelPoint = edgeLabelPoint(from, to);
    label.setAttribute("class", "graph-edge-label");
    label.setAttribute("x", labelPoint.x);
    label.setAttribute("y", labelPoint.y);
    label.textContent = edge.label;
    elements.graphSvg.appendChild(label);
  });

  model.nodes.forEach((node) => {
    const card = document.createElement("article");
    card.className = `graph-node ${node.kind}${node.id === selectedNodeId ? " selected" : ""}${node.id === linkSourceId ? " link-source" : ""}`;
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
    card.dataset.nodeId = node.id;
    card.innerHTML = `
      <span class="graph-node-kind">${node.kind}</span>
      <h3>${escapeHtml(node.title)}</h3>
      <p>${escapeHtml(node.description || bodyPreview(node))}</p>
    `;
    card.addEventListener("click", () => onGraphNodeClick(node.id));
    card.addEventListener("pointerdown", (event) => startDragging(event, node.id));
    elements.graphCanvas.appendChild(card);
  });
}

function bodyPreview(node) {
  if (node.kind === "state") {
    return `value: ${node.value}`;
  }
  if (node.kind === "event") {
    return `source: ${node.source}`;
  }
  return node.code.split("\n")[0] || "No code yet.";
}

function edgePath(from, to) {
  const startX = from.x + 196;
  const startY = from.y + 54;
  const endX = to.x;
  const endY = to.y + 54;
  const curve = Math.max(74, Math.abs(endX - startX) * 0.42);
  return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
}

function edgeLabelPoint(from, to) {
  return {
    x: (from.x + to.x + 196) / 2,
    y: (from.y + to.y) / 2 + 32
  };
}

function onGraphNodeClick(nodeId) {
  if (linkSourceId && linkSourceId !== nodeId) {
    createEdge(linkSourceId, nodeId);
    linkSourceId = null;
    finalizeModelMutation("Created semantic edge.");
    return;
  }

  selectedNodeId = nodeId;
  renderAll("Selected graph node.");
}

function startDragging(event, nodeId) {
  if (event.button !== 0) {
    return;
  }

  const node = model.nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    return;
  }

  selectedNodeId = nodeId;
  dragging = {
    nodeId,
    pointerX: event.clientX,
    pointerY: event.clientY,
    originX: node.x,
    originY: node.y
  };

  const move = (moveEvent) => {
    if (!dragging || dragging.nodeId !== nodeId) {
      return;
    }
    const dx = moveEvent.clientX - dragging.pointerX;
    const dy = moveEvent.clientY - dragging.pointerY;
    node.x = Math.max(12, dragging.originX + dx);
    node.y = Math.max(12, dragging.originY + dy);
    renderGraph();
    renderInspector();
    renderSelectionStatus();
  };

  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    dragging = null;
    syncModelEditor();
    setStatus("Moved graph node.", "ok");
    saveModel();
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function renderInspector() {
  const node = selectedNode();
  if (!node) {
    elements.inspectorHeading.textContent = "No node selected";
    elements.inspectorKindPill.textContent = "Select a node";
    elements.inspectorEmpty.classList.remove("hidden");
    elements.inspectorContent.classList.add("hidden");
    return;
  }

  elements.inspectorHeading.textContent = node.title;
  elements.inspectorKindPill.textContent = node.kind;
  elements.inspectorEmpty.classList.add("hidden");
  elements.inspectorContent.classList.remove("hidden");

  elements.nodeIdField.value = node.id;
  elements.nodeTitleField.value = node.title;
  elements.nodeDescriptionField.value = node.description;
  elements.nodeXField.value = String(node.x);
  elements.nodeYField.value = String(node.y);
  elements.nodeBodyHint.textContent = node.kind === "state"
    ? "Selected block editor writes the state's value expression."
    : node.kind === "event"
      ? "Selected block editor writes the event source."
      : "Selected block editor writes executable body code for this node.";

  const edges = model.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
  elements.edgeList.innerHTML = edges.length
    ? edges.map((edge) => {
      const direction = edge.from === node.id ? `to ${edge.to}` : `from ${edge.from}`;
      return `
        <li class="edge-item">
          <div>
            <div>${escapeHtml(edge.label)}</div>
            <div class="edge-copy">${escapeHtml(direction)}</div>
          </div>
          <button class="action-button subtle danger" data-remove-edge="${edge.id}" type="button">Remove</button>
        </li>
      `;
    }).join("")
    : '<li class="edge-item"><div class="edge-copy">No edges attached to this node yet.</div></li>';
}

function renderBlockEditor() {
  const node = selectedNode();
  syncingBlockEditor = true;
  if (!node) {
    elements.blockEditor.value = "";
    elements.blockEditor.disabled = true;
    elements.blockMetaText.textContent = "Select a node to edit its code.";
  } else {
    elements.blockEditor.disabled = false;
    elements.blockEditor.value = node.kind === "state" ? node.value : node.kind === "event" ? node.source : node.code;
    elements.blockMetaText.textContent = node.kind === "state"
      ? `${node.id}.value`
      : node.kind === "event"
        ? `${node.id}.source`
        : `${node.id}.code`;
  }
  updateLineNumbers(elements.blockEditor, elements.blockLineNumbers);
  syncGutterScroll(elements.blockEditor, elements.blockLineNumbers);
  syncingBlockEditor = false;
}

function onBlockEditorInput() {
  updateLineNumbers(elements.blockEditor, elements.blockLineNumbers);
  syncGutterScroll(elements.blockEditor, elements.blockLineNumbers);
  if (syncingBlockEditor) {
    return;
  }
  const node = selectedNode();
  if (!node) {
    return;
  }

  const nextValue = elements.blockEditor.value;
  if (node.kind === "state") {
    node.value = nextValue;
  } else if (node.kind === "event") {
    node.source = nextValue;
  } else {
    node.code = nextValue;
  }
  syncModelEditor();
  renderRuntime();
  renderGraph();
  saveModel();
  setStatus("Updated selected block code.", "ok");
}

function updateLineNumbers(textarea, gutter) {
  const lineCount = Math.max(1, textarea.value.split("\n").length);
  gutter.textContent = Array.from({ length: lineCount }, (_, index) => index + 1).join("\n");
}

function syncGutterScroll(textarea, gutter) {
  gutter.scrollTop = textarea.scrollTop;
}

function setLowerTab(tabId) {
  activeLowerTab = tabId;
  elements.lowerTabs.forEach((button) => button.classList.toggle("active", button.dataset.lowerTab === tabId));
  elements.lowerPanes.forEach((pane) => pane.classList.toggle("active", pane.dataset.lowerPane === tabId));
}

function addNode(kind) {
  const name = nextNodeName(kind);
  const position = nextNodePosition(kind);
  const node = normalizeNode({
    id: ensureUniqueId(`${kind}.${slugify(name)}`),
    kind,
    title: name,
    description: `New ${kind} node`,
    x: position.x,
    y: position.y,
    value: kind === "state" ? "null" : undefined,
    source: kind === "event" ? "button#new click" : undefined,
    code: kind === "binding" ? "refs.output.textContent = String(state.example);" : "// add logic"
  }, model.nodes.length);

  model.nodes.push(node);
  selectedNodeId = node.id;
  finalizeModelMutation(`Added ${kind} node.`);
}

function nextNodeName(kind) {
  const count = model.nodes.filter((node) => node.kind === kind).length + 1;
  const prefixes = {
    state: "state",
    event: "event",
    action: "action",
    effect: "effect",
    binding: "binding"
  };
  return `${prefixes[kind]}${count}`;
}

function nextNodePosition(kind) {
  const nodesOfKind = model.nodes.filter((node) => node.kind === kind);
  const column = KIND_ORDER.indexOf(kind);
  return {
    x: 70 + column * 250,
    y: 70 + nodesOfKind.length * 152
  };
}

function enterLinkMode() {
  const node = selectedNode();
  if (!node) {
    setStatus("Select a node before entering link mode.", "warning");
    return;
  }

  linkSourceId = node.id;
  renderGraph();
  setStatus(`Link mode is active. Click a target node to connect from ${node.title}.`, "warning");
}

function createEdge(fromId, toId, label) {
  if (model.edges.find((edge) => edge.from === fromId && edge.to === toId)) {
    setStatus("That edge already exists.", "warning");
    return;
  }

  model.edges.push({
    id: `edge-${Date.now()}`,
    from: fromId,
    to: toId,
    label: label || defaultEdgeLabel(fromId, toId, model.nodes)
  });
}

function deleteSelectedNode() {
  const node = selectedNode();
  if (!node) {
    setStatus("Select a node to delete.", "warning");
    return;
  }

  model.nodes = model.nodes.filter((entry) => entry.id !== node.id);
  model.edges = model.edges.filter((edge) => edge.from !== node.id && edge.to !== node.id);
  selectedNodeId = model.nodes[0] ? model.nodes[0].id : null;
  finalizeModelMutation(`Deleted ${node.id}.`);
}

function clearSelectedNodeEdges() {
  const node = selectedNode();
  if (!node) {
    setStatus("Select a node first.", "warning");
    return;
  }

  model.edges = model.edges.filter((edge) => edge.from !== node.id && edge.to !== node.id);
  finalizeModelMutation("Removed all edges from the selected node.");
}

function autoLayout() {
  KIND_ORDER.forEach((kind, columnIndex) => {
    const nodes = model.nodes.filter((node) => node.kind === kind);
    nodes.forEach((node, rowIndex) => {
      node.x = 70 + columnIndex * 250;
      node.y = 70 + rowIndex * 152;
    });
  });
}

function mutateSelectedNode(mutator, statusMessage) {
  const node = selectedNode();
  if (!node) {
    return;
  }
  mutator(node);
  finalizeModelMutation(statusMessage);
}

function finalizeModelMutation(statusMessage) {
  linkSourceId = null;
  model = normalizeModel(model);
  if (!model.nodes.find((node) => node.id === selectedNodeId)) {
    selectedNodeId = model.nodes[0] ? model.nodes[0].id : null;
  }
  syncModelEditor();
  renderAll(statusMessage);
}

function defaultEdgeLabel(fromId, toId, nodes) {
  const from = nodes.find((node) => node.id === fromId);
  const to = nodes.find((node) => node.id === toId);
  if (!from || !to) {
    return "relates";
  }
  return EDGE_LABELS[`${from.kind}:${to.kind}`] || "relates";
}

function copyRuntime() {
  const runtime = buildRuntimeSource(model);
  navigator.clipboard.writeText(runtime)
    .then(() => setStatus("Copied runtime.js to the clipboard.", "ok"))
    .catch(() => setStatus("Could not copy runtime.js.", "error"));
}

function resetWorkspace() {
  model = clone(DEFAULT_MODEL);
  promptLog = [
    {
      role: "assistant",
      text: "Workspace reset. You are back on the Bicameral starter graph."
    }
  ];
  selectedNodeId = model.nodes[0] ? model.nodes[0].id : null;
  lastJsonError = "";
  syncModelEditor();
  renderPromptLog();
  renderAll("Reset Bicameral workspace.");
  savePromptLog();
}

function runPrompt() {
  const raw = elements.promptInput.value.trim();
  if (!raw) {
    setStatus("Write a prompt first.", "warning");
    return;
  }

  appendPromptMessage("user", raw);
  elements.promptInput.value = "";

  let reply = "";
  try {
    reply = executePrompt(raw);
    appendPromptMessage("assistant", reply);
  } catch (error) {
    reply = `I could not apply that prompt: ${error.message}`;
    appendPromptMessage("assistant", reply);
    setStatus(reply, "error");
    return;
  }

  renderPromptLog();
  savePromptLog();
}

function showPromptHelp() {
  const help = [
    "Supported commands:",
    "add state filter = \"all\"",
    "add action clearCompleted",
    "add effect persistTheme",
    "rename addTask to createTask",
    "delete saveCache",
    "connect submitTask -> addTask",
    "disconnect submitTask -> addTask",
    "move addTask to 420,260",
    "set code of addTask to",
    "set description of taskList to Render visible tasks"
  ].join("\n");
  appendPromptMessage("assistant", help);
  renderPromptLog();
  savePromptLog();
  setStatus("Prompt help added to the log.", "ok");
}

function appendPromptMessage(role, text) {
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

function executePrompt(raw) {
  const prompt = raw.trim();
  let match;

  match = prompt.match(/^add\s+(state|event|action|effect|binding)\s+([A-Za-z0-9_.-]+)(?:\s*=\s*([\s\S]+))?$/i);
  if (match) {
    const kind = match[1].toLowerCase();
    const title = match[2];
    const extra = (match[3] || "").trim();
    const position = nextNodePosition(kind);
    const node = normalizeNode({
      id: ensureUniqueId(`${kind}.${slugify(title)}`),
      kind,
      title,
      description: `Added from prompt: ${title}`,
      x: position.x,
      y: position.y,
      value: kind === "state" ? (extra || "null") : undefined,
      source: kind === "event" ? (extra || "button#new click") : undefined,
      code: kind !== "state" && kind !== "event" ? (extra || "// add logic") : undefined
    }, model.nodes.length);
    model.nodes.push(node);
    selectedNodeId = node.id;
    finalizeModelMutation(`Added ${kind} ${title}.`);
    return `Added ${kind} \`${node.id}\` and synced the graph, JSON, and runtime.`;
  }

  match = prompt.match(/^rename\s+(.+?)\s+to\s+(.+)$/i);
  if (match) {
    const node = resolveNode(match[1]);
    const nextTitle = match[2].trim();
    if (!node) {
      throw new Error(`I could not find "${match[1]}".`);
    }
    node.title = nextTitle;
    finalizeModelMutation(`Renamed ${node.id}.`);
    return `Renamed \`${node.id}\` to "${nextTitle}".`;
  }

  match = prompt.match(/^delete\s+(.+)$/i);
  if (match) {
    const node = resolveNode(match[1]);
    if (!node) {
      throw new Error(`I could not find "${match[1]}".`);
    }
    const id = node.id;
    model.nodes = model.nodes.filter((entry) => entry.id !== id);
    model.edges = model.edges.filter((edge) => edge.from !== id && edge.to !== id);
    selectedNodeId = model.nodes[0] ? model.nodes[0].id : null;
    finalizeModelMutation(`Deleted ${id}.`);
    return `Deleted \`${id}\` and removed its edges.`;
  }

  match = prompt.match(/^connect\s+(.+?)\s*->\s*(.+?)(?:\s+as\s+(.+))?$/i);
  if (match) {
    const from = resolveNode(match[1]);
    const to = resolveNode(match[2]);
    if (!from || !to) {
      throw new Error("Both nodes must exist before they can be connected.");
    }
    createEdge(from.id, to.id, match[3] ? match[3].trim() : undefined);
    selectedNodeId = from.id;
    finalizeModelMutation(`Connected ${from.id} to ${to.id}.`);
    return `Connected \`${from.id}\` to \`${to.id}\`.`;
  }

  match = prompt.match(/^disconnect\s+(.+?)\s*->\s*(.+)$/i);
  if (match) {
    const from = resolveNode(match[1]);
    const to = resolveNode(match[2]);
    if (!from || !to) {
      throw new Error("Both nodes must exist before they can be disconnected.");
    }
    const before = model.edges.length;
    model.edges = model.edges.filter((edge) => !(edge.from === from.id && edge.to === to.id));
    if (model.edges.length === before) {
      throw new Error("That edge does not exist.");
    }
    finalizeModelMutation(`Disconnected ${from.id} from ${to.id}.`);
    return `Removed the edge from \`${from.id}\` to \`${to.id}\`.`;
  }

  match = prompt.match(/^move\s+(.+?)\s+to\s+(-?\d+)\s*,\s*(-?\d+)$/i);
  if (match) {
    const node = resolveNode(match[1]);
    if (!node) {
      throw new Error(`I could not find "${match[1]}".`);
    }
    node.x = Number(match[2]);
    node.y = Number(match[3]);
    selectedNodeId = node.id;
    finalizeModelMutation(`Moved ${node.id}.`);
    return `Moved \`${node.id}\` to (${node.x}, ${node.y}).`;
  }

  match = prompt.match(/^set\s+(value|source|code|description)\s+of\s+(.+?)\s+to\s+([\s\S]+)$/i);
  if (match) {
    const field = match[1].toLowerCase();
    const node = resolveNode(match[2]);
    const value = match[3].trim();
    if (!node) {
      throw new Error(`I could not find "${match[2]}".`);
    }
    if (field === "value" && node.kind !== "state") {
      throw new Error("Only state nodes have a value field.");
    }
    if (field === "source" && node.kind !== "event") {
      throw new Error("Only event nodes have a source field.");
    }
    if (field === "code" && (node.kind === "state" || node.kind === "event")) {
      throw new Error("State and event nodes do not store body code.");
    }
    node[field] = value;
    selectedNodeId = node.id;
    finalizeModelMutation(`Updated ${field} on ${node.id}.`);
    return `Updated \`${field}\` on \`${node.id}\`.`;
  }

  return "I did not understand that prompt yet. Use commands like add, rename, delete, connect, disconnect, move, or set.";
}

function resolveNode(reference) {
  const needle = reference.trim().toLowerCase();
  return model.nodes.find((node) =>
    node.id.toLowerCase() === needle ||
    node.title.toLowerCase() === needle ||
    node.id.split(".").pop().toLowerCase() === needle
  ) || null;
}

function ensureUniqueId(baseId) {
  let candidate = baseId;
  let counter = 2;
  while (model.nodes.find((node) => node.id === candidate)) {
    candidate = `${baseId}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

boot();
