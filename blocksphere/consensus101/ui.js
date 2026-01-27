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
import { initDebugPanel } from "./debug.js";

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
const advProdSlider = document.getElementById("advProd");
const advProdValue = document.getElementById("advProdValue");
const advNonSlider = document.getElementById("advNon");
const advNonValue = document.getElementById("advNonValue");

const container = document.getElementById("threeRoot");
const viz = createViz(container);

let config = {
  mode: "pow",
  seed: Date.now() & 0xffffffff,
  latency: "low",
  adversaryProducers: 0,
  adversaryNonProducers: 0,
  centralization: "decentralized",
};

let state = createSimState(config);
let running = false;
let lastHeadCounts = new Map();
let lastAttackMessage = "";
let attackPulse = { type: null, until: 0 };

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
  viz.initNodes(state.nodes, config.mode);
  viz.updateTokenStacks(state.nodes, config.mode === "pos" || config.mode === "dpos");
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
  attackPulse = { type: null, until: 0 };
  running = false;
  explainer.textContent = buildExplainerText();
  syncAdversaryUI();
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
  } else if (config.mode === "pos" || config.mode === "dpos") {
    txStatus.textContent = state.finalizedHeight >= 0 ? "Finalized" : "Unfinalized";
  } else if (config.mode === "poa") {
    txStatus.textContent = "Final";
  } else {
    txStatus.textContent = confs >= 3 ? "Safe" : "Unstable";
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
  const advText = `${config.adversaryProducers}% adversary producers + ${config.adversaryNonProducers}% adversary non-producers`;
  const splitText = nodesSplit.textContent && nodesSplit.textContent !== "—" ? nodesSplit.textContent : "no visible split yet";
  const propText = propMedian.textContent && propMedian.textContent !== "—" ? propMedian.textContent : "propagation still warming up";
  const attackText = lastAttackMessage ? ` ${lastAttackMessage}` : "";

  if (config.mode === "pow") {
    return `PoW is active, so miners race to extend the longest chain. With ${latencyText}, blocks gossip as pulses; delays cause temporary forks and node disagreement (${splitText}). Reorgs can happen if a longer branch arrives. TX★ is unsafe until it reaches 6 confirmations. Propagation median: ${propText}.${attackText}`;
  }
  if (config.mode === "pos") {
    return `PoS is active, so validators stake tokens to earn slots. Gold coin stacks show stake; losing tokens can remove a validator seat. With ${centralText} and ${advText}, gossip delays affect who sees the checkpoint in time, which impacts finality. Current split: ${splitText}. Propagation median: ${propText}.${attackText}`;
  }
  if (config.mode === "dpos") {
    return `dPoS is active, so a small delegate set produces blocks in a fixed schedule. Delegates hold visible token stacks; if a delegate loses stake, they fade and lose their seat. Current split: ${splitText}. Propagation median: ${propText}.${attackText}`;
  }
  if (config.mode === "poa") {
    return `PoA is active, so authorities take turns (round-robin) and finality is immediate. With ${centralText} and ${latencyText}, gossip is still visible but forks are rare. If enough authorities are compromised, censorship or a 1-block rewrite can occur. Current split: ${splitText}. Propagation median: ${propText}.${attackText}`;
  }
  return `PoET is active, so nodes win leadership by verifiable random timers (shorter waits win). With ${latencyText}, timers fire at different times and gossip determines who sees the winning block first. This reduces energy use but still allows forks under high latency. Current split: ${splitText}. Propagation median: ${propText}.${attackText}`;
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
  viz.updateTokenStacks(state.nodes, config.mode === "pos" || config.mode === "dpos");

  events.forEach((evt) => {
    const labelMap = {
      finalized: "FINALIZED",
      poa_final: "FINAL",
      tx_included: "TX★ IN",
      slash: "SLASH",
      seat_lost: "SEAT LOST",
      reorg_attempt: "REORG ATTEMPT",
      reorg_release: "REORG RELEASE",
      censor_attempt: "CENSOR",
      withheld: "WITHHELD",
      broadcast: "BROADCAST",
    };
    const text = labelMap[evt.type];
    if (!text) return;
    if (evt.nodeId !== undefined) {
      const nodeMesh = viz.nodeMeshes.get(evt.nodeId);
      if (nodeMesh) {
        viz.addEventLabel(text, {
          x: nodeMesh.position.x,
          y: nodeMesh.position.y + 1.2,
          z: nodeMesh.position.z,
        });
      } else {
        viz.addEventLabel(text, { x: -2, y: 3.5, z: -3 });
      }
    } else {
      viz.addEventLabel(text, { x: -2, y: 3.5, z: -3 });
    }
  });

  events.filter((e) => e.type === "withheld").forEach((e) => {
    viz.markWithheld(e.blockId);
  });

  events.filter((e) => e.type === "seat_lost").forEach((e) => {
    viz.fadeNode(e.nodeId);
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
    resetSim();
  });
}

function syncAdversaryUI() {
  if (advProdSlider && advProdValue) {
    advProdSlider.value = config.adversaryProducers;
    advProdValue.textContent = config.adversaryProducers;
  }
  if (advNonSlider && advNonValue) {
    advNonSlider.value = config.adversaryNonProducers;
    advNonValue.textContent = config.adversaryNonProducers;
  }
}

function bindAdversarySlider(slider, valueEl, key) {
  if (!slider || !valueEl) return;
  slider.addEventListener("input", () => {
    valueEl.textContent = slider.value;
  });
  slider.addEventListener("change", () => {
    config[key] = Number(slider.value);
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
  const adversaryIds = state.nodes.filter((n) => n.adversary).map((n) => n.id);
  if (type === "reorg") {
    attemptReorg(state);
    attackResult.textContent = "Reorg Attempt: adversary withholding blocks, will release soon. Mitigation: wait for finality / confirmations.";
    lastAttackMessage = " Reorg attempt active: adversary nodes pulse red; withheld blocks glow red, then release in a burst to race the honest chain.";
    attackPulse = { type: "reorg", until: state.time + 6 };
  } else {
    attemptCensorship(state);
    attackResult.textContent = "Censorship Attempt: adversarial producers ignoring TX★. Mitigation: decentralize producers + diversify relay.";
    lastAttackMessage = " Censorship attempt active: adversary nodes pulse red and ignore TX★ gossip pulses, delaying inclusion.";
    attackPulse = { type: "censor", until: state.time + 6 };
  }
  explainer.textContent = buildExplainerText();
  viz.setAttackPulse(adversaryIds, attackPulse.type, 0.1);
}

function parseParams() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const seed = params.get("seed");
  const latency = params.get("latency");
  const adv = params.get("adv");
  const advP = params.get("advp");
  const advN = params.get("advn");
  const central = params.get("central");
  if (mode) applyMode(mode);
  if (seed) setSeed(Number(seed));
  if (latency) config.latency = latency;
  if (adv) config.adversaryProducers = Number(adv);
  if (advP) config.adversaryProducers = Number(advP);
  if (advN) config.adversaryNonProducers = Number(advN);
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
  applyKnob("centralKnob", "centralization");
  bindAdversarySlider(advProdSlider, advProdValue, "adversaryProducers");
  bindAdversarySlider(advNonSlider, advNonValue, "adversaryNonProducers");

  window.addEventListener("resize", () => {
    viz.resize();
    viz.render();
  });
}

setSeed(config.seed);
parseParams();
resetSim();
bindUI();
initDebugPanel();
setTimeout(() => {
  viz.resize();
  viz.render();
}, 50);

let lastTime = performance.now();
function animate(time) {
  const delta = (time - lastTime) / 1000;
  lastTime = time;
  viz.updatePackets(delta);
  viz.updateLabels(delta);
  viz.updateWithheld(delta);

  if (attackPulse.type && state.time <= attackPulse.until) {
    const adversaryIds = state.nodes.filter((n) => n.adversary).map((n) => n.id);
    viz.setAttackPulse(adversaryIds, attackPulse.type, delta);
  } else if (attackPulse.type) {
    attackPulse = { type: null, until: 0 };
    viz.setAttackPulse([], null, delta);
  }

  viz.render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
