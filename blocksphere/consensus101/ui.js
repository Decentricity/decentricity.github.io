import {
  createSimState,
  stepSimulation,
  computeOverlay,
  computeRisk,
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
const explainer = document.getElementById("explainer");

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
let lastAttackMessage = "";

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
  lastAttackMessage = "";
  running = false;
  explainer.textContent = buildExplainerText();
}

function updateUI() {
  const headBlock = state.blocks.get(state.canonicalHead || 0);
  const txBlock = state.blocks.get(state.txIncludedBlock || -1);
  const confs = headBlock && txBlock ? Math.max(0, headBlock.height - txBlock.height + 1) : 0;

  confirmations.textContent = confs.toString();

  if (!state.txIncludedBlock) {
    txStatus.textContent = "Pending";
  } else if (config.mode === "pow") {
    txStatus.textContent = confs >= 6 ? "Safe" : "Unsafe";
  } else if (config.mode === "pos") {
    txStatus.textContent = state.finalizedHeight >= 0 ? "Finalized" : "Unfinalized";
  } else {
    txStatus.textContent = "Final";
  }

  if (state.metrics.safeTime !== null) {
    metricSafe.textContent = `${state.metrics.safeTime.toFixed(1)}s`;
  }
  metricRisk.textContent = state.metrics.risk || computeRisk(state);
  metricLive.textContent = state.metrics.liveness;

  const overlay = computeOverlay(state, lastHeadCounts);
  nodesSplit.textContent = overlay.split;
  propMedian.textContent = overlay.propagation;
  finalized.textContent = overlay.finalized;

  explainer.textContent = buildExplainerText();
}

function buildExplainerText() {
  const latencyText = config.latency === "low" ? "low latency" : config.latency === "med" ? "medium latency" : "high latency";
  const centralText = config.centralization === "top" ? "top-heavy distribution" : "decentralized distribution";
  const advText = `${config.adversary}% adversary power`;
  const splitText = nodesSplit.textContent && nodesSplit.textContent !== "—" ? nodesSplit.textContent : "no visible split yet";
  const propText = propMedian.textContent && propMedian.textContent !== "—" ? propMedian.textContent : "propagation still warming up";
  const attackText = lastAttackMessage ? ` ${lastAttackMessage}` : "";

  if (config.mode === "pow") {
    return `PoW is active, so miners race to extend the longest chain. With ${latencyText}, blocks gossip as pulses; delays cause temporary forks and node disagreement (${splitText}). Reorgs can happen if a longer branch arrives. TX★ is unsafe until it reaches 6 confirmations. Propagation median: ${propText}.${attackText}`;
  }
  if (config.mode === "pos") {
    return `PoS is active, so validators propose by stake and vote in epochs. With ${centralText} and ${advText}, gossip delays affect who sees the checkpoint in time, which impacts finality. When enough votes propagate, blocks become FINALIZED (locked). Current split: ${splitText}. Propagation median: ${propText}.${attackText}`;
  }
  return `PoA is active, so authorities take turns (round-robin) and finality is immediate. With ${centralText} and ${latencyText}, gossip is still visible but forks are rare. If enough authorities are compromised, censorship or a 1-block rewrite can occur. Current split: ${splitText}. Propagation median: ${propText}.${attackText}`;
}

function tick() {
  if (!running) return;
  if (state.time >= 60) {
    running = false;
    updateUI();
    return;
  }

  const { headCounts, delivered, events = [] } = stepSimulation(state, 0.2);
  lastHeadCounts = headCounts;

  releaseAttack(state);

  const latest = state.blockOrder[state.blockOrder.length - 1];
  if (latest) {
    viz.addChainBlock(latest, config.mode);
    state.blockOrder.forEach((b) => viz.updateChainBlock(b, config.mode));
  }

  delivered.forEach((msg) => {
    const fromNode = viz.nodeMeshes.get(msg.from);
    const toNode = viz.nodeMeshes.get(msg.to);
    if (!fromNode || !toNode) return;
    const color = msg.type === "tx" ? 0x3ddc97 : 0xffc857;
    viz.spawnPacket(fromNode.position, toNode.position, color);
  });

  viz.updateNodeMarkers(state.nodes, headCounts, config.mode);

  events.forEach((evt) => {
    const labelMap = {
      finalized: "FINALIZED",
      poa_final: "FINAL",
      tx_included: "TX★ IN",
      slash: "SLASH",
      reorg_attempt: "REORG ATTEMPT",
      reorg_release: "REORG RELEASE",
      censor_attempt: "CENSOR",
    };
    const text = labelMap[evt.type];
    if (!text) return;
    viz.addEventLabel(text, { x: -2, y: 3.5, z: -3 });
  });

  updateUI();
  setTimeout(tick, 200);
}

function runSimulation() {
  resetSim();
  running = true;
  tick();
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
    lastAttackMessage = " Attack not executed because the simulation is not running.";
    explainer.textContent = buildExplainerText();
    return;
  }
  if (type === "reorg") {
    attemptReorg(state);
    attackResult.textContent = "Reorg Attempt: adversary withholding blocks, will release soon. Mitigation: wait for finality / confirmations.";
    lastAttackMessage = " Reorg attempt active: adversary withholds blocks, then releases them to race the honest chain.";
  } else {
    attemptCensorship(state);
    attackResult.textContent = "Censorship Attempt: adversarial producers ignoring TX★. Mitigation: decentralize producers + diversify relay.";
    lastAttackMessage = " Censorship attempt active: adversarial producers ignore TX★, slowing inclusion through the gossip network.";
  }
  explainer.textContent = buildExplainerText();
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
  viz.updateLabels(delta);
  viz.render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
