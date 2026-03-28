const graph = {
  nodes: [
    {
      id: "state-habits",
      type: "state",
      name: "habits",
      description: "Array of tracked habits with streak counts and completion flags.",
      x: 72,
      y: 118,
      reads: ["localStorage snapshot", "fetch sync payload"],
      writes: ["habit list UI", "summary counters", "saveCache()"],
      codeLines: [2, 17, 20, 32, 41, 45, 48, 49],
      patch: [
        "+ state.habits = state.habits.map(updateStreakState);",
        "+ bindings.renderHabitList(state.habits);"
      ],
      summary: "State nodes define durable app data. In Bicameral, both the human and the model can reason over this block without losing the real source beneath it."
    },
    {
      id: "event-load",
      type: "event",
      name: "app load",
      description: "Boot event that restores cached data and primes the first render.",
      x: 298,
      y: 56,
      reads: ["DOMContentLoaded"],
      writes: ["actions.bootstrap()"],
      codeLines: [58],
      patch: [
        "+ document.addEventListener(\"DOMContentLoaded\", actions.bootstrap);"
      ],
      summary: "Event nodes represent trusted entry points. Bicameral can expose them visually because the underlying change is still just structured listener wiring."
    },
    {
      id: "action-bootstrap",
      type: "action",
      name: "bootstrap",
      description: "Hydrates state from localStorage, refreshes counters, then renders the list.",
      x: 302,
      y: 188,
      reads: ["state.habits", "state.filter"],
      writes: ["hydrateCache()", "renderHabits()", "renderSummary()"],
      codeLines: [25, 26, 27, 28, 29],
      patch: [
        "+ bootstrap() {",
        "+   effects.hydrateCache();",
        "+   actions.renderHabits();",
        "+   actions.renderSummary();",
        "+ }"
      ],
      summary: "Action nodes are the safest graph-managed unit: named behavior with explicit dependencies and a known code-generation template."
    },
    {
      id: "event-submit",
      type: "event",
      name: "form submit",
      description: "User submits a new habit from the text input.",
      x: 72,
      y: 334,
      reads: ["submit on #habit-form"],
      writes: ["actions.addHabit()"],
      codeLines: [57],
      patch: [
        "+ refs.form.addEventListener(\"submit\", actions.addHabit);"
      ],
      summary: "An event block can attach to a known DOM ref without exposing layout editing. The visual layer only manages behavior wiring."
    },
    {
      id: "action-add",
      type: "action",
      name: "addHabit",
      description: "Creates a normalized record, stores it in state, and triggers re-render plus persistence.",
      x: 302,
      y: 350,
      reads: ["refs.input.value", "state.habits"],
      writes: ["state.habits", "actions.renderHabits()", "effects.saveCache()"],
      codeLines: [30, 31, 32, 33, 34, 35, 36, 37, 38, 39],
      patch: [
        "+ addHabit(event) {",
        "+   event.preventDefault();",
        "+   const label = refs.input.value.trim();",
        "+   state.habits.unshift({ id: crypto.randomUUID(), label, streak: 0, doneToday: false });",
        "+   actions.renderHabits();",
        "+   effects.saveCache();",
        "+ }"
      ],
      summary: "This is Bicameral's sweet spot: the human sees intent as a block, the model sees an editable semantic unit, and both still land on the same code."
    },
    {
      id: "binding-list",
      type: "binding",
      name: "habit list binding",
      description: "Projects `state.habits` into repeated DOM entries in the managed render region.",
      x: 560,
      y: 350,
      reads: ["state.habits", "state.filter"],
      writes: ["refs.list.innerHTML"],
      codeLines: [40, 41, 42],
      patch: [
        "+ refs.list.innerHTML = visibleHabits.map(renderHabitCard).join(\"\");"
      ],
      summary: "Binding nodes turn state into DOM projection. Bicameral keeps them editable only through templated transforms such as list, text, and visibility bindings."
    },
    {
      id: "effect-cache",
      type: "effect",
      name: "saveCache",
      description: "Persists the current habits array into localStorage after managed mutations.",
      x: 560,
      y: 188,
      reads: ["state.habits"],
      writes: ["localStorage.habit-tracker-cache"],
      codeLines: [16, 17, 19, 20],
      patch: [
        "+ localStorage.setItem(\"habit-tracker-cache\", JSON.stringify(state.habits));"
      ],
      summary: "Effect blocks are explicit side effects. The graph makes them visible so both collaborators can inspect what touches storage, network, or time."
    },
    {
      id: "action-toggle",
      type: "action",
      name: "toggleHabit",
      description: "Flips completion state, updates streaks, and keeps persistence in sync.",
      x: 808,
      y: 268,
      reads: ["clicked habit id", "state.habits"],
      writes: ["state.habits", "actions.renderSummary()", "effects.saveCache()"],
      codeLines: [47, 48, 49, 50, 51, 52, 53, 54],
      patch: [
        "+ toggleHabit(id) {",
        "+   state.habits = state.habits.map((habit) => habit.id === id ? { ...habit, doneToday: !habit.doneToday } : habit);",
        "+   actions.renderHabits();",
        "+   actions.renderSummary();",
        "+   effects.saveCache();",
        "+ }"
      ],
      summary: "Deeper business behavior is still represented as named actions, but the graph exposes read/write surfaces rather than every line-level branch."
    }
  ],
  edges: [
    { from: "event-load", to: "action-bootstrap", kind: "trigger" },
    { from: "action-bootstrap", to: "effect-cache", kind: "hydrate" },
    { from: "state-habits", to: "action-bootstrap", kind: "input" },
    { from: "event-submit", to: "action-add", kind: "trigger" },
    { from: "action-add", to: "state-habits", kind: "write" },
    { from: "state-habits", to: "binding-list", kind: "bind" },
    { from: "action-add", to: "binding-list", kind: "render" },
    { from: "action-add", to: "effect-cache", kind: "persist" },
    { from: "binding-list", to: "action-toggle", kind: "delegate" },
    { from: "action-toggle", to: "state-habits", kind: "write" },
    { from: "action-toggle", to: "effect-cache", kind: "persist" }
  ]
};

const palette = {
  state: "#4dd8b2",
  event: "#ffd166",
  action: "#ff7b72",
  effect: "#7aa2ff",
  binding: "#c98bff"
};

const codeSample = [
  "const state = {",
  "  habits: [],",
  "  filter: \"today\",",
  "  stats: { completed: 0, streakLeaders: 0 }",
  "};",
  "",
  "const refs = {",
  "  form: document.querySelector(\"#habit-form\"),",
  "  input: document.querySelector(\"#habit-input\"),",
  "  list: document.querySelector(\"#habit-list\"),",
  "  completedCount: document.querySelector(\"#completed-count\")",
  "};",
  "",
  "/* @graph-managed:start blocks */",
  "const effects = {",
  "  hydrateCache() {",
  "    state.habits = JSON.parse(localStorage.getItem(\"habit-tracker-cache\") || \"[]\");",
  "  },",
  "  saveCache() {",
  "    localStorage.setItem(\"habit-tracker-cache\", JSON.stringify(state.habits));",
  "  }",
  "};",
  "",
  "const actions = {",
  "  bootstrap() {",
  "    effects.hydrateCache();",
  "    actions.renderHabits();",
  "    actions.renderSummary();",
  "  },",
  "  addHabit(event) {",
  "    event.preventDefault();",
  "    const label = refs.input.value.trim();",
  "    if (!label) return;",
  "    state.habits.unshift({ id: crypto.randomUUID(), label, streak: 0, doneToday: false });",
  "    refs.input.value = \"\";",
  "    actions.renderHabits();",
  "    actions.renderSummary();",
  "    effects.saveCache();",
  "  },",
  "  renderHabits() {",
  "    const visibleHabits = state.habits.filter((habit) => state.filter === \"all\" || !habit.doneToday);",
  "    refs.list.innerHTML = visibleHabits.map(renderHabitCard).join(\"\");",
  "  },",
  "  renderSummary() {",
  "    refs.completedCount.textContent = state.habits.filter((habit) => habit.doneToday).length;",
  "  },",
  "  toggleHabit(id) {",
  "    state.habits = state.habits.map((habit) =>",
  "      habit.id === id ? { ...habit, doneToday: !habit.doneToday, streak: habit.doneToday ? habit.streak : habit.streak + 1 } : habit",
  "    );",
  "    actions.renderHabits();",
  "    actions.renderSummary();",
  "    effects.saveCache();",
  "  }",
  "};",
  "",
  "refs.form.addEventListener(\"submit\", actions.addHabit);",
  "document.addEventListener(\"DOMContentLoaded\", actions.bootstrap);",
  "/* @graph-managed:end blocks */"
];

const elements = {
  graphCanvas: document.querySelector("#graphCanvas"),
  inspectorTitle: document.querySelector("#inspectorTitle"),
  inspectorCard: document.querySelector("#inspectorCard"),
  traceList: document.querySelector("#traceList"),
  codeView: document.querySelector("#codeView"),
  patchView: document.querySelector("#patchView"),
  patchSummary: document.querySelector("#patchSummary"),
  nodeCount: document.querySelector("#nodeCount"),
  edgeCount: document.querySelector("#edgeCount"),
  codeFocusLabel: document.querySelector("#codeFocusLabel"),
  cycleFocusButton: document.querySelector("#cycleFocusButton"),
  fitViewButton: document.querySelector("#fitViewButton"),
  previewPatchButton: document.querySelector("#previewPatchButton"),
  managedOnlyButton: document.querySelector("#managedOnlyButton")
};

let activeNodeId = graph.nodes[4].id;
let managedOnlyMode = true;

function renderGraph() {
  elements.graphCanvas.innerHTML = "";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "graph-svg");

  graph.edges.forEach((edge) => {
    const fromNode = graph.nodes.find((node) => node.id === edge.from);
    const toNode = graph.nodes.find((node) => node.id === edge.to);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `edge ${isEdgeActive(edge) ? "active" : ""}`);
    path.setAttribute("stroke", palette[fromNode.type]);
    path.setAttribute("d", edgePath(fromNode, toNode));
    path.dataset.from = edge.from;
    path.dataset.to = edge.to;
    svg.appendChild(path);
  });

  elements.graphCanvas.appendChild(svg);

  graph.nodes.forEach((node) => {
    const article = document.createElement("article");
    article.className = `graph-node ${node.id === activeNodeId ? "active" : ""} ${managedOnlyMode && node.type === "effect" ? "filtered" : ""}`;
    article.style.left = `${node.x}px`;
    article.style.top = `${node.y}px`;
    article.style.setProperty("--node-color", palette[node.type]);
    article.dataset.nodeId = node.id;
    article.innerHTML = `
      <span class="node-type">${node.type}</span>
      <h3 class="node-name">${node.name}</h3>
      <p class="node-description">${node.description}</p>
    `;
    article.addEventListener("click", () => setActiveNode(node.id));
    elements.graphCanvas.appendChild(article);
  });
}

function renderInspector(node) {
  elements.inspectorTitle.textContent = node.name;
  elements.inspectorCard.innerHTML = `
    <div class="inspector-section">
      <h3>What this block means</h3>
      <p class="empty-state">${node.summary}</p>
    </div>
    <div class="inspector-section">
      <h3>Reads from</h3>
      <ul class="inspector-list">${node.reads.map((item) => `<li>${item}</li>`).join("")}</ul>
    </div>
    <div class="inspector-section">
      <h3>Writes to</h3>
      <ul class="inspector-list">${node.writes.map((item) => `<li>${item}</li>`).join("")}</ul>
    </div>
  `;

  const connectedEdges = graph.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
  elements.traceList.innerHTML = connectedEdges
    .map((edge) => {
      const from = graph.nodes.find((entry) => entry.id === edge.from).name;
      const to = graph.nodes.find((entry) => entry.id === edge.to).name;
      return `<li><strong>${edge.kind}</strong><br>${from} -> ${to}</li>`;
    })
    .join("");
}

function renderCode(node) {
  elements.codeView.innerHTML = codeSample
    .map((line, index) => {
      const lineNumber = index + 1;
      const active = node.codeLines.includes(lineNumber);
      return `<span class="code-line ${active ? "active" : "fade"}"><span class="line-number">${lineNumber}</span>${escapeHtml(line)}</span>`;
    })
    .join("");

  elements.codeFocusLabel.textContent = `Focused on ${node.name}`;
}

function renderPatch(node) {
  elements.patchSummary.textContent =
    `${node.name} is graph-managed, so Bicameral would produce a constrained patch here instead of a whole-file rewrite.`;
  elements.patchView.textContent = node.patch.join("\n");
}

function updateCounts() {
  elements.nodeCount.textContent = String(graph.nodes.length);
  elements.edgeCount.textContent = String(graph.edges.length);
}

function isEdgeActive(edge) {
  return edge.from === activeNodeId || edge.to === activeNodeId;
}

function edgePath(fromNode, toNode) {
  const startX = fromNode.x + 188;
  const startY = fromNode.y + 70;
  const endX = toNode.x;
  const endY = toNode.y + 70;
  const curve = Math.max(80, Math.abs(endX - startX) * 0.42);
  return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
}

function setActiveNode(nodeId) {
  activeNodeId = nodeId;
  const node = graph.nodes.find((entry) => entry.id === nodeId);
  renderGraph();
  renderInspector(node);
  renderCode(node);
  renderPatch(node);
}

function cycleFocus() {
  const currentIndex = graph.nodes.findIndex((node) => node.id === activeNodeId);
  const nextIndex = (currentIndex + 1) % graph.nodes.length;
  setActiveNode(graph.nodes[nextIndex].id);
}

function previewPatchPulse() {
  const node = graph.nodes.find((entry) => entry.id === activeNodeId);
  elements.patchView.animate(
    [
      { transform: "scale(1)", boxShadow: "0 0 0 rgba(122, 162, 255, 0)" },
      { transform: "scale(1.01)", boxShadow: "0 0 0 1px rgba(122, 162, 255, 0.22)" },
      { transform: "scale(1)", boxShadow: "0 0 0 rgba(122, 162, 255, 0)" }
    ],
    { duration: 520, easing: "ease-out" }
  );
  renderPatch(node);
}

function fitView() {
  elements.graphCanvas.scrollTo({ top: 0, left: 0, behavior: "smooth" });
}

function toggleManagedOnly() {
  managedOnlyMode = !managedOnlyMode;
  elements.managedOnlyButton.classList.toggle("active", managedOnlyMode);
  elements.managedOnlyButton.textContent = managedOnlyMode ? "Managed only" : "Show all";
  renderGraph();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

elements.cycleFocusButton.addEventListener("click", cycleFocus);
elements.fitViewButton.addEventListener("click", fitView);
elements.previewPatchButton.addEventListener("click", previewPatchPulse);
elements.managedOnlyButton.addEventListener("click", toggleManagedOnly);

updateCounts();
setActiveNode(activeNodeId);
