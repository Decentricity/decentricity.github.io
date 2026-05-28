"use strict";

const slides = [
  {
    id: "stack",
    title: "Opening Thesis: Blockchain Is a Commitment Machine",
    time: "0:00-0:45",
    thesis: "A first-principles story from digital scarcity to degen DeFi.",
    keyLine: "If students understand history, state, incentives, and ordering, the rest of blockchain becomes one connected story.",
    stack: [
      ["copy", "Digital files duplicate perfectly."],
      ["timestamp", "Shared systems need an ordering rule."],
      ["consensus", "The network converges on accepted history."],
      ["code", "Rules become executable state transitions."],
      ["markets", "Incentives become protocol infrastructure."],
      ["adversaries", "Visibility and ordering become valuable."]
    ]
  },
  {
    id: "double",
    title: "First Principles + History",
    time: "0:45-2:00",
    thesis: "The first problem is not cryptography. It is history.",
    keyLine: "Blockchain begins as a way to make digital history hard to fake."
  },
  {
    id: "bitcoin",
    title: "Timestamping + Consensus",
    time: "2:00-3:40",
    thesis: "Bitcoin makes history expensive to rewrite.",
    keyLine: "Consensus is a social contract with math teeth."
  },
  {
    id: "ethereum",
    title: "Programmable State",
    time: "3:40-5:00",
    thesis: "Ethereum makes the ledger execute.",
    keyLine: "Boring interfaces are coordination superpowers."
  },
  {
    id: "uniswap",
    title: "DeFi From First Principles",
    time: "5:00-6:30",
    thesis: "Uniswap is a market maker made of math.",
    keyLine: "If the protocol defines the payoff rule, the protocol defines the market behavior."
  },
  {
    id: "mev",
    title: "Degen DeFi + MEV",
    time: "6:30-8:45",
    thesis: "The wild layer is an adversarial laboratory.",
    keyLine: "The user trades not only against price, but against visibility, latency, and ordering power."
  },
  {
    id: "scanner",
    title: "Closing Synthesis",
    time: "8:45-10:00",
    thesis: "For any protocol, ask what state is tracked, who changes it, who validates it, and who profits from ordering or breaking it.",
    keyLine: "Blockchain is coordination technology for adversarial environments."
  }
];

const protocols = [
  {
    name: "Bitcoin",
    answers: [
      "UTXOs and accepted block history.",
      "Users broadcast transactions; miners propose blocks.",
      "Nodes check signatures, hashes, rules, and cumulative work.",
      "Miners, attackers with hash power, and anyone advantaged by finality timing."
    ]
  },
  {
    name: "Ethereum",
    answers: [
      "Account balances, contract storage, logs, and code-defined variables.",
      "Users, contracts, validators, sequencers, and governance systems.",
      "Execution clients, consensus clients, cryptographic checks, and economic penalties.",
      "Validators, searchers, apps, users, governance actors, and attackers."
    ]
  },
  {
    name: "Uniswap",
    answers: [
      "Pool reserves, positions, prices, fees, and liquidity ranges.",
      "Traders, liquidity providers, arbitrageurs, and governance.",
      "Smart contract rules and every node executing the same state transition.",
      "LPs, traders, arbitrageurs, searchers, and protocols routing order flow."
    ]
  },
  {
    name: "Yield Farm",
    answers: [
      "Deposits, reward emissions, governance balances, and liquidity positions.",
      "Depositors, reward controllers, governance, forks, and automated strategies.",
      "Contracts, token rules, oracle assumptions, and governance permissions.",
      "Farmers, insiders, liquidators, attackers, treasury, and fork teams."
    ]
  },
  {
    name: "MEV Bot",
    answers: [
      "Visible pending trades, prices, gas bids, and ordering opportunities.",
      "Searchers submit bundles; builders and validators shape inclusion.",
      "Protocol validity checks plus block-building and relay pipelines.",
      "Searchers, validators, builders, private order-flow venues, and sometimes users."
    ]
  }
];

const app = {
  slideIndex: 0,
  sceneState: slides.map((slide) => initialState(slide.id)),
  timerSeconds: 0,
  timerInterval: null
};

const els = {
  app: document.getElementById("app"),
  sceneKicker: document.getElementById("sceneKicker"),
  sceneTitle: document.getElementById("sceneTitle"),
  sceneTime: document.getElementById("sceneTime"),
  sceneThesis: document.getElementById("sceneThesis"),
  gameBoard: document.getElementById("gameBoard"),
  progressFill: document.getElementById("progressFill"),
  progressDots: document.getElementById("progressDots"),
  timerReadout: document.getElementById("timerReadout"),
  timerToggle: document.getElementById("timerToggle"),
  timerReset: document.getElementById("timerReset"),
  lineModal: document.getElementById("lineModal"),
  modalText: document.getElementById("modalText")
};

document.getElementById("prevSlide").addEventListener("click", () => setSlide(app.slideIndex - 1));
document.getElementById("nextSlide").addEventListener("click", () => setSlide(app.slideIndex + 1));
document.getElementById("stepScene").addEventListener("click", stepScene);
document.getElementById("resetScene").addEventListener("click", resetScene);
document.getElementById("keyLine").addEventListener("click", showKeyLine);
document.getElementById("closeModal").addEventListener("click", closeModal);
els.timerToggle.addEventListener("click", toggleTimer);
els.timerReset.addEventListener("click", resetTimer);
els.gameBoard.addEventListener("click", handleBoardClick);
els.progressDots.addEventListener("click", handleDotClick);
els.lineModal.addEventListener("click", (event) => {
  if (event.target === els.lineModal) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.lineModal.hidden) closeModal();
  if (!els.lineModal.hidden) return;
  if (event.key === "ArrowRight") setSlide(app.slideIndex + 1);
  if (event.key === "ArrowLeft") setSlide(app.slideIndex - 1);
  if (event.key.toLowerCase() === "r") resetScene();
  if (event.key.toLowerCase() === "k") showKeyLine();
  if (event.key === " ") {
    event.preventDefault();
    stepScene();
  }
});

function initialState(id) {
  if (id === "stack") return { placed: [] };
  if (id === "double") return { sends: [], history: false };
  if (id === "bitcoin") return { tampered: false, honestWork: 3, attackerWork: 0, forkChoice: false };
  if (id === "ethereum") return { alice: 10, bob: 0, connected: ["ERC-20"], risk: false, event: "Contract waiting for a transaction." };
  if (id === "uniswap") return { eth: 10, usdc: 20000, externalPrice: 2000, fees: 0, shock: false, event: "Pool price matches the outside market." };
  if (id === "mev") return { phase: 0, activeMechanism: "" };
  if (id === "scanner") return { selected: 0, revealed: 0 };
  return {};
}

function setSlide(index) {
  app.slideIndex = Math.max(0, Math.min(slides.length - 1, index));
  history.replaceState(null, "", `#slide-${app.slideIndex + 1}`);
  render();
}

function resetScene() {
  const slide = slides[app.slideIndex];
  app.sceneState[app.slideIndex] = initialState(slide.id);
  render();
}

function stepScene() {
  const slide = slides[app.slideIndex];
  const state = app.sceneState[app.slideIndex];

  if (slide.id === "stack") {
    const next = slide.stack.find(([label]) => !state.placed.includes(label));
    if (next) state.placed.push(next[0]);
    else showKeyLine();
  }

  if (slide.id === "double") {
    if (!state.sends.includes("Bob")) state.sends.push("Bob");
    else if (!state.sends.includes("Carol")) state.sends.push("Carol");
    else if (!state.history) state.history = true;
    else showKeyLine();
  }

  if (slide.id === "bitcoin") {
    if (!state.tampered) {
      state.tampered = true;
      state.attackerWork = 1;
    } else if (state.honestWork < 5) {
      state.honestWork += 1;
    } else if (!state.forkChoice) {
      state.forkChoice = true;
    } else {
      showKeyLine();
    }
  }

  if (slide.id === "ethereum") {
    const order = ["transfer", "Wallet", "DEX", "Lending", "Governance", "risk"];
    const next = order.find((item) => {
      if (item === "transfer") return state.bob === 0;
      if (item === "risk") return !state.risk;
      return !state.connected.includes(item);
    });
    if (next === "transfer") executeTransfer(state);
    else if (next === "risk") state.risk = true;
    else if (next) state.connected.push(next);
    else showKeyLine();
  }

  if (slide.id === "uniswap") {
    if (state.event === "Pool price matches the outside market.") swapPool(state);
    else if (!state.shock) shockMarket(state);
    else if (Math.abs(poolPrice(state) - state.externalPrice) > 12) arbitragePool(state);
    else swapPool(state);
  }

  if (slide.id === "mev") {
    if (state.phase < 3) state.phase += 1;
    else showKeyLine();
  }

  if (slide.id === "scanner") {
    if (state.revealed < 4) state.revealed += 1;
    else if (state.selected < protocols.length - 1) {
      state.selected += 1;
      state.revealed = 0;
    } else {
      showKeyLine();
    }
  }

  render();
}

function handleBoardClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const value = button.dataset.value;
  const slide = slides[app.slideIndex];
  const state = app.sceneState[app.slideIndex];

  if (slide.id === "stack" && action === "place") {
    if (!state.placed.includes(value)) state.placed.push(value);
  }

  if (slide.id === "double") {
    if (action === "send" && !state.sends.includes(value)) state.sends.push(value);
    if (action === "history") state.history = true;
  }

  if (slide.id === "bitcoin") {
    if (action === "tamper") {
      state.tampered = true;
      state.attackerWork = Math.max(state.attackerWork, 1);
    }
    if (action === "mine") state.honestWork = Math.min(5, state.honestWork + 1);
    if (action === "fork") state.forkChoice = true;
  }

  if (slide.id === "ethereum") {
    if (action === "transfer") executeTransfer(state);
    if (action === "connect" && !state.connected.includes(value)) state.connected.push(value);
    if (action === "risk") state.risk = true;
  }

  if (slide.id === "uniswap") {
    if (action === "swap") swapPool(state);
    if (action === "shock") shockMarket(state);
    if (action === "arb") arbitragePool(state);
  }

  if (slide.id === "mev") {
    if (action === "phase") state.phase = Math.max(state.phase, Number(value));
    if (action === "mechanism") state.activeMechanism = state.activeMechanism === value ? "" : value;
  }

  if (slide.id === "scanner") {
    if (action === "protocol") {
      state.selected = Number(value);
      state.revealed = 0;
    }
    if (action === "reveal") state.revealed = Math.min(4, state.revealed + 1);
  }

  render();
}

function render() {
  const slide = slides[app.slideIndex];
  els.sceneKicker.textContent = `Slide ${app.slideIndex + 1} / ${slides.length}`;
  els.sceneTitle.textContent = slide.title;
  els.sceneTime.textContent = slide.time;
  els.sceneThesis.textContent = slide.thesis;
  els.progressFill.style.width = `${((app.slideIndex + 1) / slides.length) * 100}%`;
  els.gameBoard.className = `game-board game-${slide.id}`;
  renderDots();

  const state = app.sceneState[app.slideIndex];
  if (slide.id === "stack") els.gameBoard.innerHTML = renderStack(slide, state);
  if (slide.id === "double") els.gameBoard.innerHTML = renderDouble(state);
  if (slide.id === "bitcoin") els.gameBoard.innerHTML = renderBitcoin(state);
  if (slide.id === "ethereum") els.gameBoard.innerHTML = renderEthereum(state);
  if (slide.id === "uniswap") els.gameBoard.innerHTML = renderUniswap(state);
  if (slide.id === "mev") els.gameBoard.innerHTML = renderMev(state);
  if (slide.id === "scanner") els.gameBoard.innerHTML = renderScanner(state);
}

function renderDots() {
  els.progressDots.innerHTML = slides.map((slide, index) => {
    const classes = ["dot"];
    if (index === app.slideIndex) classes.push("active");
    if (index < app.slideIndex) classes.push("done");
    return `<button type="button" class="${classes.join(" ")}" data-slide="${index}" aria-label="Go to slide ${index + 1}">${index + 1}. ${escapeHtml(shortTitle(slide.title))}</button>`;
  }).join("");
}

function handleDotClick(event) {
  const button = event.target.closest("[data-slide]");
  if (!button) return;
  setSlide(Number(button.dataset.slide));
}

function renderStack(slide, state) {
  const allPlaced = state.placed.length === slide.stack.length;
  const tokens = slide.stack.map(([label, text]) => {
    const placed = state.placed.includes(label);
    return `<button type="button" class="token-button ${placed ? "placed" : ""}" data-action="place" data-value="${escapeHtml(label)}" ${placed ? "disabled" : ""}>
      <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(text)}</small></span>
      <span class="badge ${placed ? "ok" : ""}">${placed ? "set" : "ready"}</span>
    </button>`;
  }).join("");

  const slots = slide.stack.map(([label, text], index) => {
    const placed = state.placed.includes(label);
    return `<div class="stack-slot ${placed ? "filled" : ""}">
      <div class="stack-num">${index + 1}</div>
      <div class="stack-copy">
        <strong>${placed ? escapeHtml(label) : "waiting"}</strong>
        <span>${placed ? escapeHtml(text) : "commitment layer"}</span>
      </div>
    </div>`;
  }).join("");

  return `<div class="stack-scene">
    <div class="surface">
      <p class="surface-title">Puzzle pieces</p>
      <div class="token-bank">${tokens}</div>
    </div>
    <div class="surface">
      <p class="surface-title">Commitment machine</p>
      <div class="commitment-stack">${slots}</div>
      <div class="surface final-reveal">${allPlaced ? "Blockchain is a commitment machine for hostile environments." : "Copyability -> timestamping -> consensus -> code -> markets -> adversaries"}</div>
    </div>
  </div>`;
}

function renderDouble(state) {
  const bobSent = state.sends.includes("Bob");
  const carolSent = state.sends.includes("Carol");
  const winner = state.sends[0] || "";
  const loser = state.sends.find((name) => name !== winner) || "";

  return `<div class="double-scene">
    <div class="double-grid">
      <div class="surface">
        <p class="surface-title">Signed digital coin</p>
        <div class="coin">B</div>
        <div class="mini-actions">
          <button type="button" data-action="send" data-value="Bob" ${bobSent ? "disabled" : ""}>Send to Bob</button>
          <button type="button" data-action="send" data-value="Carol" ${carolSent ? "disabled" : ""}>Send to Carol</button>
        </div>
      </div>
      <div class="surface recipient ${bobSent ? state.history && loser === "Bob" ? "rejected" : "valid" : ""}">
        <p class="surface-title">Bob receives</p>
        <strong>${bobSent ? "looks valid locally" : "no message yet"}</strong>
        <span>${bobSent ? "Signature checks out." : "Waiting for the signed spend."}</span>
      </div>
      <div class="surface recipient ${carolSent ? state.history && loser === "Carol" ? "rejected" : "valid" : ""}">
        <p class="surface-title">Carol receives</p>
        <strong>${carolSent ? "also looks valid locally" : "no message yet"}</strong>
        <span>${carolSent ? "Signature checks out." : "Waiting for the signed spend."}</span>
      </div>
    </div>
    <div class="surface">
      <p class="surface-title">Official ordering rule</p>
      <div class="timeline">
        ${state.sends.length === 0 ? `<div class="timeline-row"><span class="badge">empty</span><strong>No shared history yet</strong><span></span></div>` : ""}
        ${state.sends.map((name, index) => {
          const accepted = state.history && name === winner;
          const rejected = state.history && name !== winner;
          return `<div class="timeline-row">
            <span class="badge ${accepted ? "ok" : rejected ? "bad" : ""}">T${index + 1}</span>
            <strong>${escapeHtml(name)} spend ${state.history ? accepted ? "counts" : "conflicts" : "is pending"}</strong>
            <span class="badge ${accepted ? "ok" : rejected ? "bad" : ""}">${state.history ? accepted ? "first" : "double" : "local"}</span>
          </div>`;
        }).join("")}
      </div>
      <div class="mini-actions" style="margin-top:0.75rem">
        <button type="button" data-action="history" ${state.sends.length < 2 || state.history ? "disabled" : ""}>Create Shared History</button>
      </div>
    </div>
  </div>`;
}

function renderBitcoin(state) {
  const leaves = ["Alice pays Bob", "LP deposit", "Carol vote", "User swap"];
  const blocks = ["B101", "B102", "B103", "B104"];
  const attackerWidth = Math.min(100, state.attackerWork * 20);
  const honestWidth = Math.min(100, state.honestWork * 20);
  const broken = state.tampered;

  return `<div class="bitcoin-scene">
    <div class="merkle-grid">
      <div class="surface">
        <p class="surface-title">Merkle commitment</p>
        <div class="hash-tree">
          <div class="hash-row">
            ${leaves.map((leaf, index) => `<button type="button" class="hash-node ${broken && index === 1 ? "broken" : ""}" data-action="tamper">
              <strong>L${index + 1}</strong><span>${escapeHtml(index === 1 && broken ? "LP withdraw?" : leaf)}</span>
            </button>`).join("")}
          </div>
          <div class="hash-row">
            <div class="hash-node ${broken ? "broken" : ""}"><strong>H12</strong><span>${broken ? "mismatch" : "ok"}</span></div>
            <div class="hash-node"><strong>H34</strong><span>ok</span></div>
          </div>
          <div class="hash-row">
            <div class="hash-node root ${broken ? "broken" : ""}"><strong>Merkle root</strong><span>${broken ? "commitment breaks" : "one root commits to many records"}</span></div>
          </div>
        </div>
      </div>
      <div class="surface">
        <p class="surface-title">Hash-linked history</p>
        <div class="chain">
          ${blocks.map((block, index) => `<div class="block ${state.forkChoice ? "accepted" : ""} ${broken && index > 0 ? "broken" : ""}">
            <strong>${block}</strong>
            <span>${broken && index > 0 ? "future link changed" : "prev hash locked"}</span>
          </div>`).join("")}
        </div>
      </div>
    </div>
    <div class="work-meters">
      <div class="meter">
        <span>Honest network work</span>
        <div class="meter-bar" style="width:${honestWidth}%"></div>
      </div>
      <div class="meter attacker">
        <span>Rewrite attempt</span>
        <div class="meter-bar" style="width:${attackerWidth}%"></div>
      </div>
    </div>
    <div class="mini-actions">
      <button type="button" data-action="tamper">Tamper Leaf</button>
      <button type="button" data-action="mine">Add Honest Work</button>
      <button type="button" data-action="fork">Apply Fork Choice</button>
    </div>
    <div class="surface final-reveal">${state.forkChoice ? "Nodes converge on the chain with the most cumulative work." : "Cheap to verify, costly to forge, paid to extend accepted history."}</div>
  </div>`;
}

function renderEthereum(state) {
  const apps = ["Wallet", "ERC-20", "DEX", "Lending", "Governance"];
  const appNodes = apps.map((name) => {
    const active = state.connected.includes(name);
    return `<button type="button" class="app-node ${active ? "active" : ""}" data-action="connect" data-value="${name}" ${active ? "disabled" : ""}>
      <strong>${name}</strong>
      <span>${active ? "speaks the interface" : "waiting"}</span>
    </button>`;
  }).join("");

  return `<div class="ethereum-scene">
    <div class="state-machine">
      <div class="state-box">
        <p class="surface-title">State S(t)</p>
        <div class="balances">
          <div class="balance-row"><span>Alice</span><strong>${state.alice} TOKEN</strong></div>
          <div class="balance-row"><span>Bob</span><strong>${state.bob} TOKEN</strong></div>
        </div>
      </div>
      <div class="tx-card">
        <p class="surface-title">Transaction + Contract</p>
        <code>transfer(Bob, 3)</code>
        <p style="margin:0.6rem 0 0;color:var(--muted)">signature -> balance check -> event</p>
        <div class="mini-actions" style="margin-top:0.75rem">
          <button type="button" data-action="transfer" ${state.alice < 3 ? "disabled" : ""}>Execute Transfer</button>
        </div>
      </div>
      <div class="contract-card">
        <p class="surface-title">New State S(t+1)</p>
        <strong>${escapeHtml(state.event)}</strong>
        <span style="color:var(--muted);display:block;margin-top:0.45rem">Every node can verify the same rule.</span>
      </div>
    </div>
    <div class="surface">
      <p class="surface-title">ERC-20 composability map</p>
      <div class="app-map">${appNodes}</div>
    </div>
    <div class="surface final-reveal">
      ${state.risk ? "Composability lowers coordination cost and creates new dependencies and attack surface." : "Standards turn contracts into reusable market infrastructure."}
    </div>
    <div class="mini-actions">
      <button type="button" data-action="risk">Show Attack Surface</button>
    </div>
  </div>`;
}

function renderUniswap(state) {
  const price = poolPrice(state);
  const ethHeight = clamp((state.eth / 14) * 100, 14, 100);
  const usdcHeight = clamp((state.usdc / 24000) * 100, 14, 100);
  const dotX = clamp((state.eth - 7) * 18, 28, 172);
  const dotY = clamp(210 - (price - 1300) / 6, 34, 205);

  return `<div class="uniswap-scene">
    <div class="metric-grid">
      <div class="metric"><strong>${state.eth.toFixed(2)}</strong><span>ETH in pool</span></div>
      <div class="metric"><strong>${Math.round(state.usdc).toLocaleString()}</strong><span>USDC in pool</span></div>
      <div class="metric"><strong>$${Math.round(price).toLocaleString()}</strong><span>on-chain ETH price</span></div>
    </div>
    <div class="pool-grid">
      <div class="surface">
        <p class="surface-title">Liquidity pool</p>
        <div class="tank-wrap">
          <div class="tank"><div class="tank-label">ETH</div><div class="tank-fill" style="height:${ethHeight}%"></div></div>
          <div class="tank usdc"><div class="tank-label">USDC</div><div class="tank-fill" style="height:${usdcHeight}%"></div></div>
        </div>
      </div>
      <div class="curve">
        <svg viewBox="0 0 220 230" role="img" aria-label="Constant product curve">
          <path d="M20 28 C52 36 64 76 84 110 C103 144 137 178 198 206" fill="none" stroke="#44546a" stroke-width="3"/>
          <line x1="22" y1="204" x2="204" y2="204" stroke="#2b3747"/>
          <line x1="28" y1="25" x2="28" y2="210" stroke="#2b3747"/>
          <circle cx="${dotX}" cy="${dotY}" r="8" fill="#3ed7bc"/>
          <text x="42" y="36" fill="#9eafbf" font-size="11">x * y = k</text>
          <text x="132" y="52" fill="#f2bd54" font-size="11">outside $${Math.round(state.externalPrice)}</text>
        </svg>
      </div>
      <div class="surface">
        <p class="surface-title">Roles</p>
        <div class="role-list">
          <div class="surface role ${state.fees > 0 ? "live" : ""}"><strong>LPs</strong><span>earn fees, take inventory risk</span></div>
          <div class="surface role ${state.event.includes("Trader") ? "live" : ""}"><strong>Traders</strong><span>move the pool along the curve</span></div>
          <div class="surface role ${state.event.includes("Arbitrage") ? "live" : ""}"><strong>Arbitrageurs</strong><span>pull price toward outside markets</span></div>
        </div>
      </div>
    </div>
    <div class="mini-actions">
      <button type="button" data-action="swap">Swap ETH -> USDC</button>
      <button type="button" data-action="shock">External Price Shock</button>
      <button type="button" data-action="arb">Arbitrage</button>
    </div>
    <div class="surface final-reveal">${escapeHtml(state.event)} Fees earned: $${Math.round(state.fees).toLocaleString()}.</div>
  </div>`;
}

function renderMev(state) {
  const rows = [];
  if (state.phase >= 2) rows.push(["1", "Bot buy", "front-run visible user swap", "searcher"]);
  if (state.phase >= 1) rows.push([state.phase >= 2 ? "2" : "1", "User swap", state.phase >= 2 ? "receives worse execution" : "pending in transparent mempool", "user"]);
  if (state.phase >= 2) rows.push(["3", "Bot sell", "back-run after price moves", "searcher"]);
  if (rows.length === 0) rows.push(["-", "Mempool waiting", "no visible order flow yet", ""]);

  const mechanisms = [
    ["Yield farming", "Liquidity itself becomes a game."],
    ["Governance tokens", "Ownership can become control, theater, or attack surface."],
    ["Flash loans", "Capital can appear for exactly one transaction."],
    ["Forks & memes", "Code, incentives, and narratives replicate fast."]
  ];
  const active = mechanisms.find(([name]) => name === state.activeMechanism);

  const userOutput = state.phase >= 2 ? "18,740 USDC" : state.phase >= 1 ? "19,820 USDC" : "-";
  const botProfit = state.phase >= 3 ? "$132" : state.phase >= 2 ? "pending" : "-";
  const chart = state.phase >= 2 ? "30,150 70,130 108,88 145,150 190,144" : state.phase >= 1 ? "30,150 80,145 132,128 190,126" : "30,150 88,150 146,150 190,150";

  return `<div class="mev-scene">
    <div class="metric-grid">
      <div class="metric"><strong>${userOutput}</strong><span>user receives</span></div>
      <div class="metric"><strong>${botProfit}</strong><span>searcher profit</span></div>
      <div class="metric"><strong>${state.phase >= 2 ? "valuable" : "neutral"}</strong><span>ordering power</span></div>
    </div>
    <div class="mempool-layout">
      <div class="surface">
        <p class="surface-title">Transparent mempool</p>
        <div class="mempool-list">
          ${rows.map(([order, name, text, type]) => `<div class="mempool-row ${type}">
            <span class="badge">${order}</span>
            <div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(text)}</span></div>
            <span class="badge ${type === "searcher" ? "bad" : type === "user" ? "ok" : ""}">${type || "idle"}</span>
          </div>`).join("")}
        </div>
      </div>
      <div class="mev-chart">
        <svg viewBox="0 0 220 230" role="img" aria-label="Price path">
          <line x1="28" y1="24" x2="28" y2="205" stroke="#2b3747"/>
          <line x1="24" y1="180" x2="204" y2="180" stroke="#2b3747"/>
          <polyline points="${chart}" fill="none" stroke="#ef5f67" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="108" cy="${state.phase >= 2 ? 88 : 128}" r="7" fill="#f2bd54"/>
          <text x="40" y="40" fill="#9eafbf" font-size="11">price impact</text>
        </svg>
      </div>
    </div>
    <div class="mini-actions">
      <button type="button" data-action="phase" data-value="1">User Swap Enters</button>
      <button type="button" data-action="phase" data-value="2">Exploit Ordering</button>
      <button type="button" data-action="phase" data-value="3">Finalize Block</button>
    </div>
    <div class="surface">
      <p class="surface-title">Degen mechanisms</p>
      <div class="mechanism-grid">
        ${mechanisms.map(([name]) => `<button type="button" class="${state.activeMechanism === name ? "active" : ""}" data-action="mechanism" data-value="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("")}
      </div>
      <div class="surface final-reveal" style="margin-top:0.75rem">${active ? escapeHtml(active[1]) : "A degen protocol can be a paper, a market, a social narrative, and an exploit target all at once."}</div>
    </div>
  </div>`;
}

function renderScanner(state) {
  const protocol = protocols[state.selected];
  const questions = [
    "What state is being tracked?",
    "Who can propose changes?",
    "Who validates the change?",
    "Who profits from ordering or breaking it?"
  ];

  return `<div class="scanner-scene">
    <div class="surface">
      <p class="surface-title">Protocol scanner</p>
      <div class="protocol-grid">
        ${protocols.map((item, index) => `<button type="button" class="${index === state.selected ? "active" : ""}" data-action="protocol" data-value="${index}">${escapeHtml(item.name)}</button>`).join("")}
      </div>
    </div>
    <div class="answer-grid">
      ${questions.map((question, index) => {
        const revealed = index < state.revealed;
        return `<div class="answer-slot ${revealed ? "revealed" : ""}">
          <span class="badge">${index + 1}</span>
          <strong>${escapeHtml(question)}</strong>
          <span>${revealed ? escapeHtml(protocol.answers[index]) : "Scan pending."}</span>
        </div>`;
      }).join("")}
    </div>
    <div class="mini-actions">
      <button type="button" data-action="reveal">Reveal Answer</button>
    </div>
    <div class="surface">
      <p class="surface-title">One story, many systems</p>
      <div class="synthesis-chain">
        ${["digital copyability", "tamper-evident history", "costly consensus", "programmable state", "mechanism markets", "adversarial ordering"].map((item, index) => `<span class="pill ${state.revealed > index - 2 ? "live" : ""}">${escapeHtml(item)}</span>`).join("")}
      </div>
    </div>
  </div>`;
}

function executeTransfer(state) {
  if (state.alice < 3) return;
  state.alice -= 3;
  state.bob += 3;
  state.event = "Transfer event emitted: Alice -> Bob, 3 TOKEN.";
}

function swapPool(state) {
  const amountIn = 1;
  const amountInWithFee = amountIn * 0.997;
  const output = (state.usdc * amountInWithFee) / (state.eth + amountInWithFee);
  state.eth += amountIn;
  state.usdc -= output;
  state.fees += amountIn * poolPrice(state) * 0.003;
  state.event = `Trader moved the pool and received ${Math.round(output).toLocaleString()} USDC.`;
}

function shockMarket(state) {
  state.externalPrice = state.externalPrice === 2000 ? 2300 : 1850;
  state.shock = true;
  state.event = `Outside market moved to $${state.externalPrice.toLocaleString()} per ETH.`;
}

function arbitragePool(state) {
  const k = state.eth * state.usdc;
  const targetEth = Math.sqrt(k / state.externalPrice);
  const targetUsdc = Math.sqrt(k * state.externalPrice);
  state.eth = targetEth;
  state.usdc = targetUsdc;
  state.fees += 16;
  state.event = "Arbitrage pulled the on-chain price toward the outside market.";
}

function poolPrice(state) {
  return state.usdc / state.eth;
}

function toggleTimer() {
  if (app.timerInterval) {
    clearInterval(app.timerInterval);
    app.timerInterval = null;
    els.timerToggle.textContent = "Start";
    return;
  }
  app.timerInterval = setInterval(() => {
    app.timerSeconds += 1;
    updateTimer();
  }, 1000);
  els.timerToggle.textContent = "Pause";
}

function resetTimer() {
  app.timerSeconds = 0;
  updateTimer();
}

function updateTimer() {
  const minutes = String(Math.floor(app.timerSeconds / 60)).padStart(2, "0");
  const seconds = String(app.timerSeconds % 60).padStart(2, "0");
  els.timerReadout.textContent = `${minutes}:${seconds}`;
}

function showKeyLine() {
  const slide = slides[app.slideIndex];
  els.modalText.textContent = slide.keyLine;
  els.lineModal.hidden = false;
}

function closeModal() {
  els.lineModal.hidden = true;
}

function shortTitle(title) {
  return title.split(":")[0].replace("Opening Thesis", "Opening").replace("First Principles + History", "History");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const hashMatch = window.location.hash.match(/slide-(\d+)/);
if (hashMatch) {
  app.slideIndex = clamp(Number(hashMatch[1]) - 1, 0, slides.length - 1);
}

render();
updateTimer();
