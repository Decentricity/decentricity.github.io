import { createSimState, stepSimulation, computeRisk, attemptReorg, attemptCensorship } from "./sim.js";
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
  viz.group.clear();
  viz.blocks.clear();
  txStatus.textContent = "—";
  confirmations.textContent = "0";
  metricSafe.textContent = "—";
  metricRisk.textContent = "—";
  metricLive.textContent = "OK";
  attackResult.textContent = "No attack run yet.";
  running = false;
}

function updateUI() {
  confirmations.textContent = state.confirmations.toString();
  if (!state.txIncluded) {
    txStatus.textContent = "Pending";
  } else if (config.mode === "pow") {
    txStatus.textContent = state.confirmations >= 6 ? "Safe" : "Unsafe";
  } else if (config.mode === "pos") {
    txStatus.textContent = state.finalizedHeight >= 0 ? "Finalized" : "Unfinalized";
  } else {
    txStatus.textContent = "Final";
  }

  metricRisk.textContent = computeRisk(state);
  metricLive.textContent = state.metrics.liveness;

  if (state.metrics.safeTime !== null) {
    metricSafe.textContent = `${state.metrics.safeTime.toFixed(1)}s`;
  }
}

function markFinality() {
  if (config.mode === "pos") {
    state.blocks.forEach((b) => {
      if (b.height <= state.finalizedHeight) {
        b.finalized = true;
      }
    });
  }
  if (config.mode === "poa") {
    state.blocks.forEach((b) => {
      if (b.height <= state.finalizedHeight) {
        b.finalized = true;
      }
    });
  }
}

function tick() {
  if (!running) return;
  if (state.time >= 60) {
    running = false;
    updateUI();
    return;
  }
  const interval = stepSimulation(state);
  const latest = state.blocks[state.blocks.length - 1];
  if (latest) {
    viz.addBlock(latest);
    markFinality();
    state.blocks.forEach((b) => viz.updateBlock(b));
    viz.updateMarkers(state);
  }
  updateUI();
  setTimeout(tick, interval * 300);
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
  if (!state.head) {
    attackResult.textContent = "Run the simulation first.";
    return;
  }
  const success = type === "reorg" ? attemptReorg(state) : attemptCensorship(state);
  const mode = config.mode.toUpperCase();
  const successText = success ? "SUCCESS" : "FAIL";
  const assumption = config.mode === "pow"
    ? "Assumes enough hashpower + network delays."
    : config.mode === "pos"
      ? "Assumes >1/3 stake or equivocation under high latency."
      : "Assumes compromised authorities at threshold.";
  const mitigation = config.mode === "pow"
    ? "Mitigation: wait for more confirmations + reduce latency."
    : config.mode === "pos"
      ? "Mitigation: slashing + honest quorum + client diversity."
      : "Mitigation: increase authority set + key security.";

  attackResult.textContent = `${type === "reorg" ? "Reorg" : "Censorship"} Attempt: ${successText}. ${assumption} ${mitigation}`;
  viz.updateMarkers(state);
  updateUI();
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

function animate() {
  requestAnimationFrame(animate);
  viz.render();
}

animate();
