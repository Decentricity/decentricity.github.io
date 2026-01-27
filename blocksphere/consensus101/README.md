# Consensus Crash Lab (Consensus101)

Interactive consensus visualization and simulation for PoW/PoS/dPoS/PoA/PoET.

## Run locally

Open `index.html` in a browser or serve the folder via any static web server.

## URL

https://decentricity.github.io/blocksphere/consensus101/

## Suggested Flow (walk through every feature)

Use this as a guided tour that touches every control, visual, and model.

1) Orientation + controls
- Top bar: switch Mode tabs (PoW/PoS/dPoS/PoA/PoET) and use Seed → Reroll to regenerate the network deterministically.
- Main view: the ring of nodes is the network, the chain blocks appear to the left as time advances.
- Legend: explains pulse colors (block gossip, TX★ gossip, adversary pulse, withheld block glow, finalized block).
- Metrics (3 only): Time to safe, Reorg risk, Liveness.
- Security readout (small line under Metrics): shows model-specific thresholds (details below).
- Drag left/right on the canvas to rotate the scene (horizontal only).
- Debug: append `?debug` to the URL to show the error/log panel.

2) Baseline run (no adversary, low latency)
- Click Run. Watch the TX★ status and confirmations update.
- Observe gossip pulses spreading and the chain blocks advancing.
- Note the explainer text updating with the current mode and conditions.

3) Mode-by-mode explanations (switch each mode and Run)

PoW (Proof of Work)
- Producers are miners; non-producers are relayers.
- Security readout: “Majority threshold = >50% of miners” and “Top-1 miner share”.
- TX★ is considered safe after 6 confirmations.
- Forks/reorgs arise from latency and differing local tips (not pure RNG).

PoS (Proof of Stake)
- Producers are validators with visible gold stake stacks.
- Slashing can reduce stake; if stake drops low enough, the validator loses its seat (node fades, tokens disappear).
- Finality emerges from stake-weighted checkpoints.
- Security readout: Byzantine tolerance f = floor((P-1)/3) and Quorum = ceil(2P/3), plus Top-1 share.

dPoS (Delegated PoS)
- A delegate set produces blocks in a round-robin schedule.
- Delegates show stake stacks; losing stake can remove a seat (fade + tokens vanish).
- Security readout: same BFT-style f/quorum + Top-1 share.

PoA (Proof of Authority)
- Authorities take turns; finality is immediate.
- Security readout: BFT-style f/quorum + Top-1 share.
- Centralization and small producer sets make censorship/reorg easier.

PoET (Proof of Elapsed Time)
- Producers win by randomized timers; gossip decides which block becomes the tip.
- Security readout: BFT-style f/quorum + Top-1 share.
- Latency can still cause forks under high delay.

4) Condition knobs (use each and observe visible changes)
- Network latency: Low/Medium/High increases gossip delay, fork likelihood, and reorg risk.
- Centralization: Decentralized vs Top-heavy skews producer weights so top 1–2 producers control more share (reflected in Top-1 share in the security readout).
- Node count: Total nodes (6–60) and Producers (1–15, capped by total). More nodes increases gossip paths; fewer producers increases risk and attack success.

5) Adversary controls (use both sliders)
- Producers adversary %: marks a subset of producers as adversarial (red) and drives attack effectiveness.
- Non-producers adversary %: marks relayers as adversarial (red) to show broader malicious presence.
- Adversary pulses: red pulses highlight adversarial nodes during active attacks.

6) Attacks (Break it)
- Reorg Attempt:
  - Adversarial producers withhold blocks, then release in a burst (withheld blocks glow red).
  - Success likelihood increases with small producer set, top-heavy control, and high latency.
  - Attack result text explains why it succeeded or failed and suggests mitigation.
- Censorship Attempt:
  - Adversarial producers ignore TX★ gossip pulses to delay inclusion.
  - More effective with small producer sets + top-heavy skew (especially dPoS/PoA).
  - Attack result text calls out the conditions and mitigation.

7) Visual cues checklist (verify each is visible at least once)
- Block gossip pulses (gold/orange) and TX★ gossip pulses (green).
- Adversary pulses (red) during attacks.
- Withheld block glow (red) during reorg attempts.
- Finalized block highlight (teal) for BFT-style modes.
- Token stacks only in PoS/dPoS; vanish when seats are lost.
- Role labels under special nodes (MINER/VALIDATOR/DELEGATE/AUTHORITY/POET NODE; adversary variants show “ADV …”).

8) URL parameters (optional)
- `?mode=pow|pos|dpos|poa|poet`
- `&seed=123456`
- `&latency=low|med|high`
- `&advp=20&advn=10` (producer/non-producer adversary %)
- `&nodes=24&producers=6`
- `&central=decentralized|top`
- `?debug` to show the debug panel
