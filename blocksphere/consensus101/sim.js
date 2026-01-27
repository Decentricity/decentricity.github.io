export function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function latencyDelay(latency, rng) {
  if (latency === "low") return 0.2 + rng() * 0.6;
  if (latency === "med") return 0.6 + rng() * 1.0;
  return 1.2 + rng() * 1.8;
}

function weightedPick(items, rng) {
  const total = items.reduce((acc, i) => acc + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function makeNodes(config, rng) {
  const count = 16;
  const nodes = [];
  const adversaryShare = Number(config.adversary) / 100;
  const topHeavy = config.centralization === "top";

  const producerCount = config.mode === "poa" ? (topHeavy ? 3 : 5) : 6;
  const adversaryCount = Math.max(1, Math.round(count * adversaryShare));

  for (let i = 0; i < count; i++) {
    const isProducer = i < producerCount;
    const adversary = i < adversaryCount;
    const baseWeight = isProducer ? 1 : 0.2;
    const skew = topHeavy && isProducer ? (i === 0 ? 3.5 : 0.8) : 1;
    nodes.push({
      id: i,
      producer: isProducer,
      adversary,
      weight: baseWeight * skew,
      stake: baseWeight * skew,
      head: null,
      known: new Set(),
      mempool: false,
      txSeen: false,
    });
  }
  return nodes;
}

export function createSimState(config) {
  const rng = mulberry32(config.seed);
  return {
    config,
    rng,
    time: 0,
    blocks: new Map(),
    blockOrder: [],
    messages: [],
    nodes: makeNodes(config, rng),
    nextBlockTime: 0,
    nextBlockId: 1,
    txId: "TXSTAR",
    txAnnounced: false,
    txIncludedBlock: null,
    finalizedHeight: -1,
    canonicalHead: null,
    propagationStats: { lastMedian: null },
    attack: { type: null, active: false, releaseAt: null, withheld: [] },
    metrics: { safeTime: null, risk: "—", liveness: "OK" },
  };
}

function addGenesis(state) {
  if (state.blocks.size > 0) return;
  const genesis = {
    id: 0,
    parent: null,
    height: 0,
    time: 0,
    producer: null,
    includesTx: false,
    finalized: state.config.mode !== "pow",
  };
  state.blocks.set(0, genesis);
  state.blockOrder.push(genesis);
  state.nodes.forEach((n) => {
    n.head = genesis.id;
    n.known.add(genesis.id);
  });
  state.canonicalHead = 0;
}

function blockInterval(state) {
  if (state.config.mode === "poa") return 2;
  if (state.config.mode === "pos") return 2.6 + (state.rng() - 0.5) * 1.2;
  return 3 + (state.rng() - 0.5) * 1.6;
}

function pickProducer(state) {
  const producers = state.nodes.filter((n) => n.producer);
  return weightedPick(
    producers.map((n) => ({ node: n, weight: n.weight })),
    state.rng
  ).node;
}

function gossipBlock(state, blockId, fromNode) {
  state.nodes.forEach((node) => {
    if (node.id === fromNode.id) return;
    const delay = latencyDelay(state.config.latency, state.rng);
    state.messages.push({
      type: "block",
      blockId,
      from: fromNode.id,
      to: node.id,
      deliverAt: state.time + delay,
    });
  });
}

function gossipTx(state, fromNode) {
  state.nodes.forEach((node) => {
    if (node.id === fromNode.id) return;
    const delay = latencyDelay(state.config.latency, state.rng);
    state.messages.push({
      type: "tx",
      txId: state.txId,
      from: fromNode.id,
      to: node.id,
      deliverAt: state.time + delay,
    });
  });
}

function computeHead(node, state) {
  let best = null;
  for (const id of node.known) {
    const block = state.blocks.get(id);
    if (!block) continue;
    if (!best || block.height > best.height || (block.height === best.height && block.time < best.time)) {
      best = block;
    }
  }
  node.head = best ? best.id : null;
}

function processMessage(state, msg) {
  const node = state.nodes[msg.to];
  if (!node) return;
  if (msg.type === "block") {
    if (!node.known.has(msg.blockId)) {
      node.known.add(msg.blockId);
      computeHead(node, state);
      const block = state.blocks.get(msg.blockId);
      if (block) {
        block.receivedTimes = block.receivedTimes || [];
        block.receivedTimes.push(state.time);
        updatePropagation(state, block);
      }
    }
  } else if (msg.type === "tx") {
    node.mempool = true;
    node.txSeen = true;
  }
}

function updatePropagation(state, block) {
  const count = block.receivedTimes.length + 1; // + producer
  const threshold = Math.ceil(state.nodes.length * 0.67);
  if (count >= threshold && !block.propagationRecorded) {
    const times = [...block.receivedTimes, block.time].sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)] - block.time;
    block.propagationRecorded = true;
    state.propagationStats.lastMedian = median;
  }
}

function updateCanonicalHead(state) {
  const headCounts = new Map();
  state.nodes.forEach((n) => {
    if (n.head === null) return;
    headCounts.set(n.head, (headCounts.get(n.head) || 0) + 1);
  });
  let best = null;
  headCounts.forEach((count, headId) => {
    const block = state.blocks.get(headId);
    if (!block) return;
    if (!best || count > best.count || (count === best.count && block.height > best.height)) {
      best = { headId, count, height: block.height };
    }
  });
  state.canonicalHead = best ? best.headId : state.canonicalHead;
  return headCounts;
}

function finalizePos(state) {
  if (state.config.mode !== "pos") return;
  const checkpoint = 5;
  const candidates = [];
  state.blocks.forEach((b) => {
    if (b.height > 0 && b.height % checkpoint === 0) candidates.push(b);
  });
  if (candidates.length === 0) return;
  const latest = candidates[candidates.length - 1];
  let stakeSeen = 0;
  let totalStake = 0;
  state.nodes.forEach((n) => {
    totalStake += n.stake;
    if (n.known.has(latest.id)) stakeSeen += n.stake;
  });
  if (stakeSeen / totalStake >= 0.67) {
    state.finalizedHeight = Math.max(state.finalizedHeight, latest.height - 1);
  }
}

function setFinality(state) {
  if (state.config.mode === "pow") return;
  state.blocks.forEach((b) => {
    if (b.height <= state.finalizedHeight) b.finalized = true;
  });
}

function includeTxInBlock(state, block, producer) {
  if (state.time < 5) return;
  if (producer.adversary) return;
  if (producer.mempool) {
    block.includesTx = true;
    state.txIncludedBlock = block.id;
  }
}

function produceBlock(state) {
  const producer = pickProducer(state);
  const headId = producer.head ?? 0;
  const parent = state.blocks.get(headId);
  const height = parent ? parent.height + 1 : 1;

  const block = {
    id: state.nextBlockId++,
    parent: headId,
    height,
    time: state.time,
    producer: producer.id,
    includesTx: false,
    finalized: false,
    receivedTimes: [],
  };

  includeTxInBlock(state, block, producer);
  state.blocks.set(block.id, block);
  state.blockOrder.push(block);

  producer.known.add(block.id);
  computeHead(producer, state);

  if (state.attack.active && state.attack.type === "reorg" && producer.adversary) {
    state.attack.withheld.push(block.id);
  } else {
    gossipBlock(state, block.id, producer);
  }
}

function maybeAnnounceTx(state) {
  if (state.txAnnounced || state.time < 5) return;
  state.txAnnounced = true;
  const origin = state.nodes[0];
  origin.mempool = true;
  origin.txSeen = true;
  gossipTx(state, origin);
}

export function stepSimulation(state, dt) {
  addGenesis(state);
  state.time += dt;
  maybeAnnounceTx(state);

  if (state.time >= state.nextBlockTime) {
    produceBlock(state);
    state.nextBlockTime = state.time + blockInterval(state);
  }

  const due = state.messages.filter((m) => m.deliverAt <= state.time);
  state.messages = state.messages.filter((m) => m.deliverAt > state.time);
  due.forEach((msg) => processMessage(state, msg));

  const headCounts = updateCanonicalHead(state);
  finalizePos(state);
  setFinality(state);

  const confs = confirmations(state);
  if (state.config.mode === "pow") {
    if (confs >= 6 && state.metrics.safeTime === null) state.metrics.safeTime = state.time;
  } else if (state.config.mode === "pos") {
    if (state.finalizedHeight >= 0 && state.metrics.safeTime === null) state.metrics.safeTime = state.time;
  } else {
    if (state.txIncludedBlock && state.metrics.safeTime === null) state.metrics.safeTime = state.time;
  }

  state.metrics.risk = computeRisk(state);
  if (state.config.mode === "pos" && state.time > 20 && state.finalizedHeight < 0) {
    state.metrics.liveness = "Stalled";
  } else {
    state.metrics.liveness = "OK";
  }

  return { headCounts, delivered: due };
}

export function computeOverlay(state, headCounts) {
  const total = state.nodes.length;
  const sorted = [...headCounts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 2).map(([id, count]) => {
    const pct = Math.round((count / total) * 100);
    return { id, pct };
  });

  const propagation = state.propagationStats.lastMedian;
  const propText = propagation ? `${propagation.toFixed(1)}s` : "—";

  return {
    split: top.map((t, i) => `Head ${i + 1}: ${t.pct}%`).join(" / ") || "—",
    propagation: propText,
    finalized: state.config.mode === "pow" ? "Confs" : state.finalizedHeight >= 0 ? "Yes" : "No",
  };
}

export function computeRisk(state) {
  const adv = Number(state.config.adversary) / 100;
  const latency = state.config.latency;
  let risk = adv + (latency === "high" ? 0.2 : latency === "med" ? 0.1 : 0.05);
  if (state.config.centralization === "top") risk += 0.1;
  if (risk >= 0.45) return "High";
  if (risk >= 0.25) return "Med";
  return "Low";
}

function confirmations(state) {
  if (!state.txIncludedBlock || state.canonicalHead === null) return 0;
  const head = state.blocks.get(state.canonicalHead);
  const txBlock = state.blocks.get(state.txIncludedBlock);
  if (!head || !txBlock) return 0;
  return Math.max(0, head.height - txBlock.height + 1);
}

export function attemptReorg(state) {
  state.attack = { type: "reorg", active: true, releaseAt: state.time + 6, withheld: [] };
}

export function attemptCensorship(state) {
  state.nodes.forEach((n) => {
    if (n.adversary) n.mempool = false;
  });
}

export function releaseAttack(state) {
  if (!state.attack.active) return false;
  if (state.time < state.attack.releaseAt) return false;
  state.attack.active = false;
  const released = state.attack.withheld.slice();
  state.attack.withheld = [];
  const producer = state.nodes.find((n) => n.adversary) || state.nodes[0];
  released.forEach((id) => gossipBlock(state, id, producer));
  return released.length > 0;
}
