export function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSimState(config) {
  return {
    config,
    rng: mulberry32(config.seed),
    time: 0,
    blocks: [],
    head: null,
    tipByHeight: new Map(),
    txBlockId: null,
    confirmations: 0,
    finalizedHeight: -1,
    checkpoints: [],
    metrics: { safeTime: null, risk: "—", liveness: "OK" },
    nextBlockId: 1,
    pendingForks: [],
    authorityIndex: 0,
    livenessStalled: false,
    txIncluded: false,
    txInclusionTime: null,
  };
}

function blockIntervalSeconds(mode, rng) {
  if (mode === "poa") return 2.0;
  const base = mode === "pos" ? 2.5 : 3.0;
  return base + (rng() - 0.5) * 1.2;
}

function latencyForkChance(latency) {
  if (latency === "low") return 0.05;
  if (latency === "med") return 0.12;
  return 0.22;
}

function adversaryShare(config) {
  return Number(config.adversary) / 100;
}

function centralizationSkew(config) {
  return config.centralization === "top" ? 0.65 : 0.25;
}

function pickBranchTarget(state, newHeight) {
  if (state.pendingForks.length === 0) return state.head;
  const fork = state.pendingForks[0];
  if (fork.height < newHeight) return fork.block;
  return state.head;
}

function addBlock(state, parent, height, flags) {
  const id = state.nextBlockId++;
  const block = {
    id,
    parent,
    height,
    time: state.time,
    fork: flags.fork || false,
    finalized: false,
    includesTx: flags.includesTx || false,
    mode: state.config.mode,
    authority: flags.authority || null,
    honest: !flags.adversary,
  };
  state.blocks.push(block);
  state.tipByHeight.set(height, block);
  return block;
}

function updateHead(state, candidate) {
  if (!state.head || candidate.height > state.head.height) {
    state.head = candidate;
  } else if (candidate.height === state.head.height && candidate.time < state.head.time) {
    state.head = candidate;
  }
}

function includeTx(state, block) {
  if (!state.txIncluded && state.time >= 5) {
    block.includesTx = true;
    state.txIncluded = true;
    state.txBlockId = block.id;
    state.txInclusionTime = state.time;
  }
}

function updateConfirmations(state) {
  if (!state.txBlockId) {
    state.confirmations = 0;
    return;
  }
  const txBlock = state.blocks.find((b) => b.id === state.txBlockId);
  if (!txBlock) return;
  if (state.head) {
    state.confirmations = Math.max(0, state.head.height - txBlock.height + 1);
  }
}

function tryFinalize(state) {
  if (state.config.mode !== "pos") return;
  const epoch = 5;
  if (state.head && state.head.height % epoch === 0) {
    const adv = adversaryShare(state.config);
    const latency = state.config.latency;
    const quorum = latency === "high" ? 0.67 : 0.6;
    const honest = 1 - adv;
    if (honest >= quorum) {
      const finalizeHeight = state.head.height - 2;
      state.finalizedHeight = Math.max(state.finalizedHeight, finalizeHeight);
    } else {
      state.livenessStalled = true;
      state.metrics.liveness = "Stalled";
    }
  }
}

function maybeFork(state) {
  const chance = latencyForkChance(state.config.latency);
  if (state.rng() < chance) {
    const forkHeight = state.head ? state.head.height - 1 : 0;
    const forkBlock = state.head && state.head.parent ? state.head.parent : state.head;
    if (forkBlock) {
      state.pendingForks.push({ block: forkBlock, height: forkHeight });
    }
  }
}

function shouldAdversaryWin(state) {
  const adv = adversaryShare(state.config);
  const skew = centralizationSkew(state.config);
  return state.rng() < adv + skew * 0.1;
}

function stepPow(state) {
  if (!state.head) {
    state.head = addBlock(state, null, 0, { includesTx: false });
    return;
  }
  maybeFork(state);
  const newHeight = state.head.height + 1;
  const useFork = state.pendingForks.length > 0 && state.rng() < 0.4;
  let parent = state.head;
  if (useFork) {
    parent = pickBranchTarget(state, newHeight);
  }
  const block = addBlock(state, parent, newHeight, { adversary: shouldAdversaryWin(state) });
  if (state.rng() < 0.8) includeTx(state, block);
  updateHead(state, block);
}

function stepPos(state) {
  if (!state.head) {
    state.head = addBlock(state, null, 0, { includesTx: false });
    return;
  }
  if (state.config.latency === "high" && state.rng() < 0.1) {
    state.livenessStalled = true;
    state.metrics.liveness = "Stalled";
    return;
  }
  maybeFork(state);
  const newHeight = state.head.height + 1;
  const parent = state.pendingForks.length > 0 && state.rng() < 0.2 ? pickBranchTarget(state, newHeight) : state.head;
  const block = addBlock(state, parent, newHeight, { adversary: shouldAdversaryWin(state) });
  if (state.rng() < 0.85) includeTx(state, block);
  updateHead(state, block);
  tryFinalize(state);
}

function stepPoa(state) {
  if (!state.head) {
    state.head = addBlock(state, null, 0, { includesTx: false, authority: 0 });
    return;
  }
  const authorities = state.config.centralization === "top" ? 3 : 5;
  const authority = state.authorityIndex % authorities;
  state.authorityIndex += 1;
  const newHeight = state.head.height + 1;
  const block = addBlock(state, state.head, newHeight, { authority });
  includeTx(state, block);
  updateHead(state, block);
  state.finalizedHeight = newHeight;
}

export function stepSimulation(state) {
  const interval = blockIntervalSeconds(state.config.mode, state.rng);
  state.time += interval;

  if (state.config.mode === "pow") stepPow(state);
  if (state.config.mode === "pos") stepPos(state);
  if (state.config.mode === "poa") stepPoa(state);

  updateConfirmations(state);

  if (state.config.mode === "pow") {
    if (state.confirmations >= 6 && state.metrics.safeTime === null) {
      state.metrics.safeTime = state.time;
    }
  } else if (state.config.mode === "pos") {
    if (state.finalizedHeight >= 0 && state.metrics.safeTime === null) {
      state.metrics.safeTime = state.time;
    }
  } else {
    if (state.txIncluded && state.metrics.safeTime === null) {
      state.metrics.safeTime = state.time;
    }
  }

  return interval;
}

export function computeRisk(state) {
  const adv = adversaryShare(state.config);
  if (state.config.mode === "poa") {
    return adv >= 0.4 ? "High" : adv >= 0.2 ? "Med" : "Low";
  }
  const latency = state.config.latency;
  const risk = adv + (latency === "high" ? 0.2 : latency === "med" ? 0.1 : 0.05);
  if (risk > 0.45) return "High";
  if (risk > 0.25) return "Med";
  return "Low";
}

export function attemptReorg(state) {
  const adv = adversaryShare(state.config);
  const successChance = state.config.mode === "poa" ? adv * 1.2 : adv * 1.1;
  const success = state.rng() < successChance;
  if (success && state.head && state.head.parent) {
    state.head = state.head.parent;
  }
  return success;
}

export function attemptCensorship(state) {
  const adv = adversaryShare(state.config);
  const skew = centralizationSkew(state.config);
  const success = state.rng() < adv + skew * 0.2;
  if (success) {
    state.txIncluded = false;
    state.txBlockId = null;
    state.confirmations = 0;
  }
  return success;
}
