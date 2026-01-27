import {
  createSimState,
  stepSimulation,
  computeOverlay,
  attemptReorg,
  attemptCensorship,
  releaseAttack,
} from "./sim.js";
import { createViz } from "./viz.js";

const seedValue = document.getElementById("seedValue");
const rerollSeed = document.getElementById("rerollSeed");
const runBtn = document.getElementById("runBtn");
const txStatus = document.getElementById("txStatus");
const confirmations = document.getElementById("confirmations");
const metricSafe = document.getElementById("metricSafe");
const metricRisk = document.getElementById("metricRisk");
const metricLive = document.getElementById("metricLive");
const reorgBtn = document.getElementById("reorgBtn");
const censorBtn = document.getElementById("censorBtn");
const attackResult = document.getElementById("attackResult");
const nodesSplit = document.getElementById("nodesSplit");
const propMedian = document.getElementById("propMedian");
const finalized = document.getElementById("finalized");

const container = document.getElementById("threeRoot");
const viz = createViz(container);

let config = {
  mode: "pow",
  seed: Date.now() & 0xffffffff,
  latency: "low",
  adversary: 0,
  centralization: "decentralized",
};

let state = createSimState(config);
let running = false;
let lastHeadCounts = new Map();

function setSeed(seed) {
  config.seed = seed >>> 0;
  seedValue.textContent = config.seed;
}

function reroll() {
  setSeed(Math.floor(Math.random() * 1e9));
  resetSim();
}

function resetSim() {
  state = createSimState({ ...config });
  viz.initNodes(state.nodes);
  txStatus.textContent = "—";
  confirmations.textContent = "0";
  metricSafe.textContent = "—";
  metricRisk.textContent = "—";
  metricLive.textContent = "OK";
  nodesSplit.textContent = "—";
  propMedian.textContent = "—";
  finalized.textContent = "—";
  attackResult.textContent = "No attack run yet.";
  running = false;
}

function updateUI() {
  confirmations.textContent = state.txIncludedBlock
    ? Math.max(0, (state.blocks.get(state.canonicalHead)?.height || 0) - (state.blocks.get(state.txIncludedBlock)?.height || 0) + 1)
    : "0";

  if (!state.txIncludedBlock) {
    txStatus.textContent = "Pending";
  } else if (config.mode === "pow") {
    txStatus.textContent = confirmations.textContent >= 6 ? "Safe" : "Unsafe";
  } else if (config.mode === "pos") {
    txStatus.textContent = state.finalizedHeight >= 0 ? "Finalized" : "Unfinalized";
  } else {
    txStatus.textContent = "Final";
  }

  if (state.metrics.safeTime !== null) {
    metricSafe.textContent = `${state.metrics.safeTime.toFixed(1)}s`;
  }
  metricRisk.textContent = state.metrics.risk;
  metricLive.textContent = state.metrics.liveness;

  const overlay = computeOverlay(state, lastHeadCounts);
  nodesSplit.textContent = overlay.split;
  propMedian.textContent = overlay.propagation;
  finalized.textContent = overlay.finalized;
}

function tick() {
  if (!running) return;
  if (state.time >= 60) {
    running = false;
    updateUI();
    return;
  }

  const { headCounts, delivered } = stepSimulation(state, 0.2);
  lastHeadCounts = headCounts;

  releaseAttack(state);

  const latest = state.blockOrder[state.blockOrder.length - 1];
  if (latest) {
    viz.addChainBlock(latest);
    state.blockOrder.forEach((b) => viz.updateChainBlock(b));
  }

  delivered.forEach((msg) => {
    const fromNode = viz.nodeMeshes.get(msg.from);
    const toNode = viz.nodeMeshes.get(msg.to);
    if (!fromNode || !toNode) return;
    const color = msg.type === "tx" ? 0x3ddc97 : 0xffc857;
    viz.spawnPacket(fromNode.position, toNode.position, color);
  });

  viz.updateNodeMarkers(state.nodes, headCounts);
  updateUI();

  setTimeout(tick, 200);
}

function runSimulation() {
  resetSim();
  running = true;
  tick();
}

function applyTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tab}`);
  });
}

function applyMode(mode) {
  config.mode = mode;
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  resetSim();
}

function applyKnob(groupId, key) {
  const group = document.getElementById(groupId);
  group.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (!btn) return;
    group.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    config[key] = btn.dataset.value;
    if (key === "adversary") config[key] = Number(config[key]);
    resetSim();
  });
}

function runAttack(type) {
  if (!state.canonicalHead) {
    attackResult.textContent = "Run the simulation first.";
    return;
  }
  if (type === "reorg") {
    attemptReorg(state);
    attackResult.textContent = "Reorg Attempt: adversary withholding blocks, will release soon. Mitigation: wait for finality / confirmations.";
  } else {
    attemptCensorship(state);
    attackResult.textContent = "Censorship Attempt: adversarial producers ignoring TX★. Mitigation: decentralize producers + diversify relay.";
  }
}

function parseParams() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const seed = params.get("seed");
  const latency = params.get("latency");
  const adv = params.get("adv");
  const central = params.get("central");
  if (mode) applyMode(mode);
  if (seed) setSeed(Number(seed));
  if (latency) config.latency = latency;
  if (adv) config.adversary = Number(adv);
  if (central) config.centralization = central;
}

function bindUI() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyTab(btn.dataset.tab));
  });
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyMode(btn.dataset.mode));
  });
  rerollSeed.addEventListener("click", reroll);
  runBtn.addEventListener("click", runSimulation);
  reorgBtn.addEventListener("click", () => runAttack("reorg"));
  censorBtn.addEventListener("click", () => runAttack("censor"));
  applyKnob("latencyKnob", "latency");
  applyKnob("adversaryKnob", "adversary");
  applyKnob("centralKnob", "centralization");

  window.addEventListener("resize", () => {
    viz.resize();
    viz.render();
  });
}

setSeed(config.seed);
parseParams();
resetSim();
bindUI();

let lastTime = performance.now();
function animate(time) {
  const delta = (time - lastTime) / 1000;
  lastTime = time;
  viz.updatePackets(delta);
  viz.render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
