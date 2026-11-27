# AI-DigiScore Enterprise Decision Harness

A prototype of an enterprise-grade harness through which people work with AI agents, with enterprise-wide traceability of decision graphs across multiple projects, scoring of agent interactions and of composed decisions, and a visible, auditable record of every step.

This repository folder is the public brief and (once built) the Phase 1 prototype. It will be served at [https://decentricity.github.io/aidigiscore/](https://decentricity.github.io/aidigiscore/).

**Phase 1 is a static, UI-heavy front end.** It runs entirely in the browser on GitHub Pages, with no server. The backend, the scoring engine, the decision checker, the audit log, agent runs and the two domain scenarios are all **simulated** from seeded JSON fixtures. A later phase can replace the mock API with a real backend without changing the views.

The work is a collaboration between [Pandu Sastrowardoyo](https://decentricity.github.io/) (Co-Founder, Blocksphere), Danny (Jean-Daniel Gauthier) and Patrick Hopper (AI-DigiScore). The harness builds on concepts from Patrick Hopper's published patent application US 2026/0350437 A1. AI-DigiScore and Patrick Hopper are credited for those concepts. Anything marked **[proposal]** in this document is a design suggestion for the prototype, not a claim about an existing product.

---

## 1. What we are building

Everyone in an enterprise should work with AI agents *through this harness*, not around it. The harness is the interaction layer, the record of what was decided, and the place where those decisions can be inspected.

Four requirements, agreed together:

1. **A single interaction layer.** People and agents act through the harness. Agents do not get their own side channel onto tools, data or approvals.
2. **Enterprise-wide decision graphs.** Decisions are first-class, versioned objects. They span multiple projects. A decision in one project can cite a decision in another as a premise. The graph is queryable and visible.
3. **Scoring of interactions and of composition.** Each agent interaction is scored with respect to the decision it serves. A decision composed from other decisions has its own score, derived from its children by an explicit, versioned rule. Agent scores accumulate from how often their proposed steps are accepted, rejected, or later invalidated.
4. **Visible and auditable.** Every interaction, score, checker verdict, approval and override is in a hash-chained audit log. Accepted decisions carry a certificate. Anyone can re-run the checker on a stored certificate and get the same verdict. A board view lists flagged and failing decisions.

Danny's framing of this is: **"Lean, but for business decision-making"** — where Lean means the [Lean 4 theorem prover](https://lean-lang.org/), not Lean manufacturing.

---

## 2. Lean, but for business decision-making

In Lean 4, a statement is accepted only if a small trusted kernel checks a proof of it. Automation and AI can *propose* proof steps; only the kernel *accepts* them. The harness applies the same discipline to business decisions.

Public references for the analogy (checked 27 Nov 2026):

- L. de Moura and S. Ullrich, "The Lean 4 Theorem Prover and Programming Language", CADE-28, 2021.
- The mathlib Community, "The Lean Mathematical Library", CPP 2020.
- K. Yang et al., "LeanDojo: Theorem Proving with Retrieval-Augmented Language Models", NeurIPS 2023.
- Y. Wu et al., "Autoformalization with Large Language Models", NeurIPS 2022 (Isabelle/HOL, not Lean; cited for the limits of autoformalization).

### 2.1 The mapping

| Lean concept | Harness equivalent |
|---|---|
| **Proposition with typed hypotheses** | A **decision** is a proposition: a statement plus an explicit list of typed premises (Evidence, Constraint, Policy, Approval, PriorDecision). |
| **Proof built from lemmas** | A **composite decision** is a proof. It cites earlier decisions, including decisions in other projects, by verified versioned ID, the way a Lean proof cites a lemma by name. |
| **Small trusted kernel** | A **minimal, deterministic decision checker**. All "intelligence" stays outside it. AI and people propose; the checker accepts or rejects. The checker should stay small enough to audit line by line, and its version is written into every certificate. **[proposal]** |
| **Definitions and theorems** | **Decision templates** (`VendorFarmApproval`, `FormularyAddition`, and so on) declare required premise types, required sub-decisions and the conclusion form. The checker validates a decision against its template like a type signature. **[proposal]** |
| **Axioms** | **Policies**: rules accepted without proof inside the system, owned and versioned by named authorities. The axiom set should stay explicit and small. Every certificate lists the axioms a decision relies on, the way Lean can report a theorem's axiom dependencies. **[proposal]** |
| **Mathlib** | An **enterprise library** of reusable, reviewed, versioned decisions and templates that later decisions build on. Promotion into the library requires review. **[proposal]** |
| **Tactics and proof search** | **AI agents** propose steps: gather evidence, draft options, suggest which prior decisions apply. The checker verifies them. A human approves where policy requires it. Agents are scored on how often their proposed steps are accepted and survive later revalidation. **[proposal]** |
| **Proofs stop checking when a premise changes** | When evidence, policy or a cited decision changes, every dependent decision is re-checked and fails until it is repaired. The earlier point-in-time snapshot (T0) is preserved. Propagation walks the cross-project graph. |
| **Proof term / certificate** | An **auditable certificate** per accepted decision: statement, premise digests, cited decisions, axioms used, checker version, approvals. Stored in the hash-chained log. Any party can re-run the checker on it and get the same verdict. **[proposal]** |

The trust boundary is: **AI proposes, the checker verifies, a human approves where policy requires it.**

### 2.2 Scoring versus proving

Lean's verdict is binary: a proof checks, or it does not. Decision scores are graded. The harness uses both, in two layers. **[proposal]**

1. **Hard layer (proved).** Mandatory constraints must be *checked*, not scored. Required premises are present and current. Cited decisions are valid at the cited version and have not been invalidated. Policy axioms are satisfied. The approver had authority. The order of steps was correct. A failure means the decision does not check, and no score can compensate. Averaging scores cannot clear a mandatory failure. A high score cannot supply missing permission.
2. **Soft layer (scored).** Premises that cannot be proved — evidence quality, forecast assumptions, an agent's reasoning quality — carry graded confidence scores. The composite score is computed by an explicit, versioned rule (weakest-link, or a weighted rule with a ceiling). That rule is itself part of the certificate, so the *computation* is checkable even when the inputs are judgements.

**Honest limits.**

- Most business judgement (strategy, negotiation, taste, ethics trade-offs) cannot be formalised. A "proof" there would only re-state an assumption.
- Formalisation has a real cost. Writing typed templates and policies takes skilled effort, and keeping them current is ongoing work.
- A checked decision is only as good as its premises and axioms. A wrong policy encoded as an axiom is enforced perfectly.
- LLM translation of informal statements into formal ones is still error-prone. Autoformalization research has reported that only about a quarter of competition problems translated perfectly. Any AI-drafted formal statement must be reviewed by a human.

**Where something Lean-like is realistic:** policy and compliance rules with crisp conditions; dependency structure and version validity; authority and permission checks; arithmetic consistency of budgets and allocations; the score computation itself.

**Where it is not:** whether evidence is *true*, whether an option is *wise*, open-ended analysis, and anything that depends on tacit knowledge. There the harness records and scores, and people decide.

---

## 3. Concepts inherited from AI-DigiScore

The prototype reuses the following published ideas from AI-DigiScore (Patrick Hopper, US 2026/0350437 A1). This is a high-level summary of published material. The Phase 1 implementations are **simulations** of these ideas, written in front-end JavaScript against fixtures.

- **Decision score formula.** Output trust is computed as `T = min(C, max(0, B − P + H))`, where `B` is base structural trust, `P` is an aggregate penalty, `H` is a human-review adjustment, and `C` is the ceiling. The published application describes this formula as illustrative.
- **AI-only cap.** AI-only output cannot exceed a ceiling of 7.0 / 10 unless a recorded human approval is present. Below a revalidation threshold (the materials use 6.0), a decision is held for revalidation. The scale is configurable in the prototype so a tenant can be shown with either default.
- **Point-in-time hashed decision records.** A snapshot ("Snapshot Lock") binds a decision to the source versions, model or agent versions, policy versions, trust value, ceiling state and a cryptographic digest at a moment in time. Trust is not portable across revisions.
- **Invalidation when sources change.** A change to a glossary, source set, module path, model version or context anchor invalidates the snapshot. Dependents are marked for revalidation. The earlier T0 snapshot stays intact; the new state is T1.
- **Hash-chained audit log.** Every interaction, score, disposition, approval and override is an append-only record linked to the previous record's hash. A verification pass walks the chain and reports a break. A later phase may optionally anchor a tip hash to a public ledger; Phase 1 does not.
- **Board dashboard.** Flagged and failing decisions, and hashed overrides above the ceiling, are visible on a board view.

Agent scoring in the published application uses planning depth, goal persistence and coherence similarity, with decay and normalisation, plus an orchestration penalty when too many agents drift. For Phase 1 we also score **an interaction's contribution to a specific decision** (used, contradicted, later invalidated) and **a composite decision from its children**. Those two rules are **[proposal]** extensions, because a published composite rule for "parent score from child decisions" is not specified beyond a penalty and the rule that mandatory failures cannot be averaged away.

---

## 4. Architecture

### 4.1 Target components

These are the components of the harness as we intend to build it. In Phase 1, the items marked *simulated* are front-end stand-ins behind a stable mock API. Items marked *later phase* are specified here so the API and UI leave room for them, but they are not built in Phase 1.

| Component | Role | Phase 1 |
|---|---|---|
| **MCP gateway** | The only path agents take to tools and data. Records each call (agent ID, tool, input/output digest, linked decision ID, timestamp) and enforces allow or hold per policy. | Later phase. Phase 1 simulates the gateway: scripted agent runs emit the same events the real gateway would. |
| **Agent identity and permissions registry** | Users, agents, owners, roles, projects and tool scopes. Agents cannot edit policy, approvals or receipts. No model grants itself release authority. | Simulated from fixtures. The UI and mock API enforce the rules in the browser. |
| **Versioned cross-project decision graph store** | Nodes: Project, Decision (versioned), Evidence/Source, AgentInteraction, Review, Approval, Snapshot, Certificate. Edges: depends-on, composed-of, supports, contradicts, produced-by, supersedes. | Simulated in-memory store, hydrated from JSON fixtures. A real store is a later phase. |
| **Decision templates** | Versioned type signatures for a decision kind. | Fixture data, checked by the simulated checker. |
| **Scoring engine** | Four scores: interaction, decision, composite, agent. | Simulated in front-end JS. |
| **Decision checker** | Small deterministic kernel. ACCEPT or REJECT with reasons. Emits a certificate on accept. | Simulated in front-end JS. Export of a decision to Lean 4 is a later phase. |
| **Invalidation and propagation engine** | On a source or decision change, walk dependency edges across projects, mark REVALIDATE, preserve T0, re-run the checker. | Simulated in front-end JS, driven by the scenario player and by mock API writes. |
| **Hash-chained audit log** | Append-only chain with verification. | Simulated in the browser with the Web Crypto API (SHA-256). |
| **UIs** | Graph explorer, agent console, agent scoreboard, board of flagged and failing decisions, decision detail with proof/certificate, audit view with verification, timeline replay. | Phase 1 focus: all of these, rich, and running on mock data. |

**Intended flow** (the mock backend follows this same sequence, in the browser):

1. A person or a (simulated) agent acts through the harness.
2. The gateway checks identity, permissions and the applicable decision template.
3. An interaction event is written to the event bus and the audit log.
4. The graph store links the event to its decision node.
5. The scoring engine updates interaction, decision, composite and agent scores.
6. The checker verifies each new or changed decision against its template, axioms and citations, and writes a certificate or a rejection to the audit log.
7. On a source or decision change, the invalidation engine walks cross-project edges, sets dispositions, and re-runs the checker on affected decisions.
8. The UI reads the graph, scores, certificates and audit log through the mock API.

### 4.2 Phase 1 constraints

Phase 1 must satisfy all of the following:

- **Static front end, no server.** The app is a static site. It is built to be served under `/aidigiscore/` on GitHub Pages (`https://decentricity.github.io/aidigiscore/`).
- **In-browser mock backend only.** Seeded JSON fixtures, a simulated event bus, simulated agent runs, and a scripted scenario player. There is no live model call, no remote API, and no database.
- **Every view runs on mock data.** That includes the decision graph, the scoreboards, the audit log and the agent console.
- **Two sample tenants**, because they are the two likely first clients: a fictional agribusiness and a fictional health network. A tenant switcher in the UI loads one or the other. See [§6](#6-mock-data-two-sample-tenants).
- **Scoring engine and decision checker** are front-end JavaScript modules. They are real, deterministic functions — not hard-coded verdicts — but they run only on fixture and scenario state in the browser.
- **Audit log** is a simulated hash chain built with `crypto.subtle.digest("SHA-256", …)` in Web Crypto. Verification is a real walk of that chain. A demo control can tamper with a record and show that verification fails.
- **API surface** is a TypeScript interface (`HarnessAPI`). Phase 1 ships a `MockHarnessClient`. A later real client should implement the same interface.
- **Real MCP gateway, persistent data store and Lean 4 export are out of Phase 1.** They belong in later phases.

---

## 5. Phase 1 user interface

The UI should feel like a working operations console, not a slide deck. All views are driven by the mock API and update live as the scenario player (or a manual mock-API action) advances state.

**Global chrome.** Tenant switcher (Meridian Harvest Co. / Lakeshore Health Network). Scenario player controls: load, play, pause, step, reset, jump to a named step. A compact chain-status indicator (verified / broken). When the medical tenant is selected, a persistent banner: *This is a decision-governance demonstration with synthetic data only. It is not clinical advice, is not a medical device, and must not be used for patient care. No real patient data is included.*

1. **Cross-project decision graph explorer.** A visual graph of projects, decisions, sources, agents and the edges between them. Nodes are coloured by disposition (accepted, rejected, stale / revalidate, held, superseded). Cross-project edges are visually distinct. Clicking a node opens decision detail. Filters: project, disposition, agent, template. A coverage view should make missing required premises obvious.
2. **Agent console.** The place people talk to agents *through the harness*. A chat-style thread per agent, plus a tool-call inspector. Every message and every (simulated) tool call is an `AgentInteraction` bound to a decision ID, written to the graph and the audit log, and scored. Agents cannot be spoken to outside this console in the prototype. Replies and tool calls are scripted (scenario cues and fixture response trees), not live model output. Show allow/hold decisions as if a gateway had made them.
3. **Agent scoreboard.** One row per agent: current score, accepted / rejected / later-invalidated proposal counts, recent drift flag, permitted tools. Click through to that agent's interactions.
4. **Board of flagged and failing decisions.** The board dashboard: rejected, stale, held-for-approval, and overrides above the AI-only ceiling. Each row shows project, decision, reason, since-when, and the responsible agent or human. This is the view an executive or compliance officer would open first.
5. **Decision detail, with proof and certificate.** Statement, typed premises, cited decisions (with versions), template, policy axioms, score breakdown (B, P, H, C, T, and the composite rule), checker verdict and reasons, certificate (or rejection), approvals and overrides, T0/T1 snapshots. A "re-run checker" action must reproduce the stored verdict.
6. **Audit view, with verification.** The hash-chained log, filterable by project, decision, agent and event type. A Verify button walks the chain and reports the first break. A "demonstrate tamper" control (clearly labelled as a demo) mutates one stored record and shows verification failing, then a reset restores the chain.
7. **Timeline replay.** A scrubber over the scenario (and over the audit log timestamps). Dragging or stepping restates the graph, scores, board and certificates at that point in time, so a reviewer can watch invalidation and repair happen.

The six views should be reachable from a left-hand or top navigation, and should stay in sync with the same in-memory store. Do not ship placeholder cards that say "coming soon" for any of the views above.

---

## 6. Mock data: two sample tenants

Phase 1 ships two fictional tenants. They are the two likely first clients, generalised and fictional. **Do not use real company names, real farm or hospital names, or real patient data.** All people, agents, vendors, products, plots, lots and incidents below are invented for the demo. Codex should generate fixtures that match these entities and IDs so the UI is populated on first load.

Each tenant has several projects, cross-project dependencies, named humans and agents with roles and permissions, decision templates, hard-constraint policies, sample interactions with scores, composite decisions, and at least one scripted change → invalidation → repair scenario, plus a negative stale-input rejection.

The original "Project A / Project B" proof (a parent decision depends on an onboarding decision; a source change in A breaks B until it is repaired) is implemented **once per tenant**, with domain-appropriate names.

### 6.1 Agriculture — Meridian Harvest Co.

A fictional agribusiness group that sources fresh produce and ingredients from independent farms and packers. Everything here is invented.

**Tenant id:** `tenant-meridian-harvest`  
**Slug:** `agriculture`

#### People

| id | Name | Title | Roles |
|---|---|---|---|
| `per-maya-chen` | Maya Chen | Procurement Lead | `author`, `project-owner` on onboarding and sourcing |
| `per-luis-ortega` | Luis Ortega | Compliance Officer | `reviewer` on watchlist and policy checks |
| `per-priya-shah` | Priya Shah | Sustainability Director | `approver` on sustainability releases |
| `per-tomo-saito` | Tomokazu Saito | Quality Manager | `reviewer` on quality and lot certification |
| `per-elena-vasquez` | Elena Vasquez | General Counsel | `admin` |

#### Agents

| id | Name | Brief | Allowed tools | Owner |
|---|---|---|---|---|
| `agt-rowan` | Rowan | Research and sourcing | `search_records`, `cite_source`, `draft_option` | Maya Chen |
| `agt-bramble` | Bramble | Compliance | `check_watchlist`, `check_policy`, `propose_repair` | Luis Ortega |
| `agt-cedar` | Cedar | Drafting | `draft_contract`, `draft_certificate`, `draft_statement` | Maya Chen |

Agents may propose steps and draft statements. They must not edit policy, approvals or receipts. Release authority stays with humans.

#### Projects

| id | Name | Purpose |
|---|---|---|
| `prj-ag-onboarding` | Supplier and farm onboarding | Admit a farm or packer as an approved supplier. |
| `prj-ag-sourcing` | Sourcing and procurement plan | Allocate seasonal volume to approved suppliers. |
| `prj-ag-certification` | Crop and quality certification | Certify a harvested lot for a quality channel. |
| `prj-ag-sustainability` | Sustainability and deforestation compliance | Release a farm plot against the company's forest-origin due-diligence policy (a fictional internal policy, not a named external regime). |

#### Cross-project dependencies

- `dec-ag-approve-redstone` (onboarding) is composed of the watchlist, quality and contract sub-decisions, and **cites** `dec-ag-plot-clearance` (sustainability).
- `dec-ag-allocate-redstone` (sourcing) **depends on** `dec-ag-approve-redstone` and `dec-ag-plot-clearance`.
- `dec-ag-certify-lot-441` (certification) **depends on** the quality sub-decision and on `dec-ag-allocate-redstone`.

#### Templates and hard policies

Templates (version `tmpl-v1`): `VendorFarmApproval`, `VolumeAllocation`, `LotQualityCertification`, `ForestOriginRelease`.

Hard constraints (policy axioms, must *check*, not merely score):

- `ax-premises-present`: every required premise on the template is present and current.
- `ax-citations-valid`: every cited decision is accepted at the cited version and has not been invalidated.
- `ax-ai-ceiling`: AI-only trust cannot exceed 7.0 without a recorded human approval.
- `ax-no-average-mandatory`: a mandatory child failure cannot be averaged away.
- `ax-approver-authority`: the approver holds the role required by the template.
- `ax-sustainability-before-volume`: a `VolumeAllocation` above 500 tonnes requires a current `ForestOriginRelease` on the relevant plot.
- `ax-watchlist-current`: a `VendorFarmApproval` requires a watchlist source whose `validUntil` is still in the future.

#### Sample decisions and sources (initial accepted state, T0)

Fictional supplier: **Redstone Orchards** (`org-redstone-orchards`), plot **Block C** (`plot-redstone-c`), lot **LOT-441** (Honeycrisp apples, Q3).

| id | Project | Statement | Composition / citations | Illustrative T | Verdict |
|---|---|---|---|---|---|
| `dec-ag-watchlist-redstone` | onboarding | Watchlist check for Redstone Orchards is clear. | Premise: `src-ag-watchlist-2026-q2` | 8.4 (human approval by Luis) | ACCEPT |
| `dec-ag-quality-redstone` | onboarding | Quality evidence for Redstone Orchards is accepted. | Premise: `src-ag-quality-audit-redstone` | 8.1 (Tomo reviews) | ACCEPT |
| `dec-ag-contract-redstone` | onboarding | Contract terms with Redstone Orchards are accepted. | Premise: `src-ag-contract-redstone-v3` | 7.6 | ACCEPT |
| `dec-ag-plot-clearance` | sustainability | Plot Block C is released under Forest Origin Due Diligence Policy v2. | Premises: `src-ag-plot-imagery-plt17`, `src-ag-forest-policy-v2` | 8.0 (Priya approves) | ACCEPT |
| `dec-ag-approve-redstone` | onboarding | Approve Redstone Orchards as a supplier. | Composite of watchlist + quality + contract; cites plot clearance | 7.6 (weakest-link of children) | ACCEPT |
| `dec-ag-allocate-redstone` | sourcing | Allocate 1,200 tonnes of Q3 apples to Redstone Orchards. | Depends on approve-redstone and plot-clearance | 7.6 | ACCEPT |
| `dec-ag-certify-lot-441` | certification | Certify LOT-441 for the premium channel. | Depends on quality-redstone and allocate-redstone | 7.9 | ACCEPT |

Suggested sample interactions (bind each to a decision, with an interaction score and a used / supporting / contradicting flag):

- Rowan cites the quality audit and drafts the approval statement (`int-ag-001`, used, score 8.2).
- Bramble runs `check_watchlist` on `src-ag-watchlist-2026-q2` (`int-ag-002`, used, score 8.7).
- Cedar drafts contract terms (`int-ag-003`, used, score 7.5).
- Rowan drafts the 1,200-tonne allocation (`int-ag-004`, used, score 8.0).

#### Scripted scenario: `ag-watchlist-invalidation-repair`

This is the agriculture A/B scenario.

1. **Passing state (T0).** All decisions above are accepted. Certificates are in the log. The graph is green.
2. **Change.** A new watchlist release arrives: `src-ag-watchlist-2026-q3` supersedes `src-ag-watchlist-2026-q2`. The invalidation engine marks `dec-ag-watchlist-redstone` stale, re-scores `dec-ag-approve-redstone` (composite fails the hard citation check), and the checker **rejects** `dec-ag-allocate-redstone` in the sourcing project. `dec-ag-certify-lot-441` is flagged as a downstream dependent. T0 snapshots remain intact and visible. The board lights up. This happens within one revalidation cycle.
3. **Repair.** Bramble proposes a repair: a new watchlist sub-decision citing `src-ag-watchlist-2026-q3`. The checker re-verifies the onboarding composite and, once Luis approves, issues a new certificate (T1). Sourcing and certification are re-checked and accepted if their other premises still hold. The override or approval is hashed into the audit log.
4. **Negative control.** An agent (Rowan or Bramble) proposes a new composite allocation that still cites the stale watchlist decision, or omits the mandatory `ForestOriginRelease`. The checker rejects it with a precise reason (`stale-citation` or `missing-premise`). This rejection is visible in the console, the decision detail, the board and the audit log.

A harmless-change control should also exist: an unrelated source (for example a typographical revision of a farm postal address that is not a cited premise) must **not** hold or invalidate the graph.

---

### 6.2 Medical — Lakeshore Health Network

A fictional hospital and health-network tenant. **Synthetic data only. No real patient data, no real medical-record numbers, no real clinician or institution identities.** Incident records use synthetic ticket IDs and do not name patients.

**This is a decision-governance demonstration. It is not clinical advice, is not a medical device, and must not be used for patient care.** The UI must show that banner whenever this tenant is selected. Fixture files must include the same disclaimer on the tenant record.

**Tenant id:** `tenant-lakeshore-health`  
**Slug:** `medical`

Fictional products and vendors used below (all invented): the drug **Nexoral 10 mg** from **Aetheris Pharma**; the **HelixPulse** pulse oximeter from **Northwind Devices**; a fictional safety bulletin series from the **National Medicines Bulletin** (a made-up source, not a real regulator).

#### People

| id | Name | Title | Roles |
|---|---|---|---|
| `per-amara-okonkwo` | Dr. Amara Okonkwo | Chief Medical Officer | `approver` on pathways and incident closures |
| `per-julian-park` | Dr. Julian Park | Pharmacy & Therapeutics Chair | `author`, `reviewer` on formulary and pathways |
| `per-nora-lindqvist` | Nora Lindqvist | Patient Safety Officer | `author` on incident reviews |
| `per-rafael-mendes` | Rafael Mendes | Biomedical Engineering Lead | `reviewer` on device qualification |
| `per-hannah-brooks` | Hannah Brooks | Compliance and Privacy Officer | `admin` |

#### Agents

| id | Name | Brief | Allowed tools | Owner |
|---|---|---|---|---|
| `agt-galen` | Galen | Protocol and literature research | `search_records`, `cite_source`, `draft_option`, `draft_statement` | Dr. Julian Park |
| `agt-apothecary` | Apothecary | Formulary and supply | `search_supply`, `cite_monograph`, `propose_repair` | Dr. Julian Park |
| `agt-sentinel` | Sentinel | Safety and compliance | `check_bulletin`, `check_policy`, `propose_repair` | Nora Lindqvist / Hannah Brooks |
| `agt-scribe` | Scribe | Drafting | `draft_certificate`, `draft_statement` | Hannah Brooks |

Same restriction: agents propose, they do not approve, and they do not close incidents.

#### Projects

| id | Name | Purpose |
|---|---|---|
| `prj-med-formulary` | Formulary and drug procurement | Add a drug to the adult formulary and record its supply path. |
| `prj-med-pathway` | Clinical protocol and treatment-pathway approval | Approve a protocol that may depend on formulary availability. |
| `prj-med-device` | Medical device vendor qualification | Qualify a device and its vendor for use in the network. |
| `prj-med-safety` | Patient-safety incident review | Close a *synthetic* incident with corrective actions. No patient identifiers. |

#### Cross-project dependencies

- `dec-med-pathway-cap-v3` (pathway) **depends on** `dec-med-formulary-nexoral` (the pathway names Nexoral 10 mg as a first-line agent, so the formulary decision is a premise).
- `dec-med-incident-syn2047` (safety) **depends on** `dec-med-qualify-helixpulse` (the synthetic incident is a device alarm-configuration near-miss).
- A recommended corrective action on the incident may **propose** a device-settings addendum; it must not silently amend `dec-med-pathway-cap-v3`. If a pathway change is required, that is a new versioned decision.

#### Templates and hard policies

Templates (version `tmpl-v1`): `FormularyAddition`, `TreatmentPathwayApproval`, `DeviceVendorQualification`, `IncidentReviewClosure`.

Hard constraints:

- `ax-premises-present`, `ax-citations-valid`, `ax-ai-ceiling`, `ax-no-average-mandatory`, `ax-approver-authority` (same meanings as in agriculture).
- `ax-dual-signoff-pathway`: a `TreatmentPathwayApproval` requires recorded approval from both the P&T Chair and the CMO.
- `ax-bulletin-current`: a `FormularyAddition` and a `DeviceVendorQualification` require a safety-bulletin source whose `validUntil` is still in the future.
- `ax-device-qualified-for-incident`: an `IncidentReviewClosure` whose subject is a device requires a current accepted `DeviceVendorQualification` for that device.
- `ax-no-phi-in-record`: fixture and runtime records in this tenant must not contain patient names, medical-record numbers or other direct identifiers. (The mock API should refuse a write that looks like a patient name or MRN; a simple pattern check is enough for the demo.)

#### Sample decisions and sources (initial accepted state, T0)

| id | Project | Statement | Composition / citations | Illustrative T | Verdict |
|---|---|---|---|---|---|
| `dec-med-nexoral-monograph` | formulary | The Nexoral 10 mg monograph is accepted for adult use. | Premise: `src-med-nexoral-monograph-v1` | 8.2 (Julian reviews) | ACCEPT |
| `dec-med-nexoral-supply` | formulary | Supply of Nexoral 10 mg from Aetheris Pharma is adequate for the planning period. | Premise: `src-med-aetheris-supply-q3` | 8.0 | ACCEPT |
| `dec-med-nexoral-coi` | formulary | Conflict-of-interest clearance for the Nexoral review panel is complete. | Premise: `src-med-coi-panel-2026` | 9.0 (Hannah) | ACCEPT |
| `dec-med-formulary-nexoral` | formulary | Add Nexoral 10 mg (Aetheris Pharma) to the adult formulary. | Composite of monograph + supply + COI; bulletin `src-med-nmb-2026-07` | 8.0 | ACCEPT |
| `dec-med-pathway-cap-v3` | pathway | Approve Community-Acquired Pneumonia pathway v3. | Depends on `dec-med-formulary-nexoral` | 8.0 (Julian + Amara dual sign-off) | ACCEPT |
| `dec-med-helix-registry` | device | HelixPulse has a current fictional device-registry record. | Premise: `src-med-helix-registry` | 8.5 (Rafael) | ACCEPT |
| `dec-med-helix-service` | device | The Northwind Devices service agreement is accepted. | Premise: `src-med-northwind-service-v2` | 7.8 | ACCEPT |
| `dec-med-qualify-helixpulse` | device | Qualify the HelixPulse oximeter from Northwind Devices. | Composite of registry + service; bulletin `src-med-device-bulletin-2026-06` | 7.8 | ACCEPT |
| `dec-med-incident-syn2047` | safety | Close synthetic incident `INC-SYN-2047` (alarm-configuration near-miss; no patient identifiers) with a device-settings corrective action. | Depends on `dec-med-qualify-helixpulse` | 7.7 (Nora authors, Amara approves) | ACCEPT |

Suggested sample interactions:

- Apothecary cites the monograph and supply record (`int-med-001`, used, 8.3).
- Galen drafts pathway v3 citing the formulary decision (`int-med-002`, used, 8.1).
- Sentinel runs `check_bulletin` for Nexoral (`int-med-003`, used, 8.6).
- Scribe drafts the incident-closure statement using only the ticket ID `INC-SYN-2047` (`int-med-004`, used, 7.9).

#### Scripted scenario: `med-bulletin-invalidation-repair`

This is the medical A/B scenario.

1. **Passing state (T0).** All decisions above are accepted, including the dual-signed pathway and the incident closure. Certificates are in the log.
2. **Change.** A new fictional National Medicines Bulletin on Nexoral, `src-med-nmb-2026-11`, supersedes `src-med-nmb-2026-07` and adds a dosing constraint. The invalidation engine marks the formulary bulletin premise stale, the checker **rejects** `dec-med-formulary-nexoral`, and `dec-med-pathway-cap-v3` fails in the other project because its citation is no longer valid. T0 snapshots remain visible. The board lists both. The incident and device graph are **not** held (harmless with respect to this change).
3. **Repair.** Apothecary proposes a repaired monograph/restrictions sub-decision citing `src-med-nmb-2026-11`. Galen proposes a pathway v3.1 that cites the new formulary version. The checker verifies both. Julian reviews; Amara co-approves the pathway. New T1 certificates are issued.
4. **Negative control.** Galen (or Apothecary) proposes a pathway that still cites the stale formulary decision, or a pathway approval that has only one of the two required sign-offs. The checker rejects with `stale-citation` or `missing-approval`. The rejection is visible across the console, decision detail, board and audit log.

---

## 7. Fixture file layout and JSON schema

All Phase 1 views read from these files (copied into the static build, for example via `public/data`). Paths are relative to this folder:

```
aidigiscore/data/
  tenants.json
  agriculture/
    tenant.json
    people.json
    agents.json
    projects.json
    templates.json
    policies.json
    sources.json
    decisions.json
    edges.json
    interactions.json
    approvals.json
    snapshots.json
    certificates.json
    scores.json
    audit.json
    scenarios.json
  medical/
    (the same filenames)
```

`tenants.json` is the index the tenant switcher uses:

```json
{
  "tenants": [
    {
      "id": "tenant-meridian-harvest",
      "slug": "agriculture",
      "name": "Meridian Harvest Co.",
      "domain": "agriculture",
      "dataDir": "agriculture",
      "disclaimer": "All farms, suppliers, lots and people are fictional."
    },
    {
      "id": "tenant-lakeshore-health",
      "slug": "medical",
      "name": "Lakeshore Health Network",
      "domain": "medical",
      "dataDir": "medical",
      "disclaimer": "This is a decision-governance demonstration with synthetic data only. It is not clinical advice, is not a medical device, and must not be used for patient care. No real patient data is included."
    }
  ]
}
```

On tenant switch, the mock store is reset from that tenant's folder and the audit chain is recomputed from its `audit.json` (or rebuilt from events if you prefer to treat `audit.json` as a seed and then hash in the browser). Do not merge the two tenants into one graph.

### 7.1 Shared conventions

- Identifiers are stable kebab-or-slug strings, unique within a tenant, using the prefixes in §6 (`per-`, `agt-`, `prj-`, `dec-`, `src-`, `int-`, `ax-`, `tmpl-`, `org-`, `plot-`).
- Timestamps are ISO-8601 in UTC.
- Scores are numbers on a 0–10 scale, one decimal place.
- Dispositions: `accepted` | `rejected` | `stale` | `held` | `superseded` | `draft`.
- Edge types: `depends-on` | `composed-of` | `supports` | `contradicts` | `produced-by` | `supersedes` | `cites`.
- Premise types: `Evidence` | `Constraint` | `Policy` | `Approval` | `PriorDecision`.
- Every fixture file is a JSON object with a single top-level array whose name matches the file (`people`, `agents`, …), except `tenant.json`, which is one object.

Codex should emit **complete** JSON for every file, covering all of the entities named in §6, not stubs. The values below are the schema. Illustrative field values appear in §6.

### 7.2 Schemas

**`tenant.json`**

```json
{
  "id": "tenant-meridian-harvest",
  "slug": "agriculture",
  "name": "Meridian Harvest Co.",
  "domain": "agriculture",
  "description": "Fictional agribusiness group sourcing fresh produce and ingredients.",
  "disclaimer": "All farms, suppliers, lots and people are fictional."
}
```

**`people.json`** — `Person`: `id`, `name`, `title`, `roles` (string[]), `projectIds` (string[]).

**`agents.json`** — `Agent`: `id`, `name`, `brief`, `ownerPersonId`, `allowedTools` (string[]), `status` (`active` | `downgraded` | `held`).

**`projects.json`** — `Project`: `id`, `name`, `purpose`, `ownerPersonId`.

**`templates.json`** — `DecisionTemplate`: `id`, `name`, `version`, `requiredPremiseTypes` (string[]), `requiredChildTemplates` (string[]), `requiredAxioms` (string[]), `requiredApproverRoles` (string[]), `scorePolicyId`.

**`policies.json`** — `PolicyAxiom`: `id`, `statement`, `hard` (boolean; `true` for the axioms in §6), `ownerPersonId`, `version`.

**`sources.json`** — `Source`: `id`, `title`, `kind` (`watchlist` | `audit` | `contract` | `imagery` | `policy` | `monograph` | `bulletin` | `registry` | `agreement` | `other`), `version`, `publishedAt`, `validUntil`, `digest` (hex SHA-256 of a canonical payload, may be pre-seeded), `supersededBy` (source id or `null`).

**`decisions.json`** — `Decision`:

```json
{
  "id": "dec-ag-approve-redstone",
  "projectId": "prj-ag-onboarding",
  "templateId": "tmpl-vendor-farm-approval",
  "version": 1,
  "statement": "Approve Redstone Orchards as a supplier.",
  "premises": [
    { "type": "PriorDecision", "refId": "dec-ag-watchlist-redstone", "version": 1 },
    { "type": "PriorDecision", "refId": "dec-ag-quality-redstone", "version": 1 },
    { "type": "PriorDecision", "refId": "dec-ag-contract-redstone", "version": 1 },
    { "type": "PriorDecision", "refId": "dec-ag-plot-clearance", "version": 1 }
  ],
  "disposition": "accepted",
  "scoreId": "score-ag-approve-redstone-v1",
  "certificateId": "cert-ag-approve-redstone-v1",
  "t0SnapshotId": "snap-ag-approve-redstone-t0",
  "t1SnapshotId": null
}
```

**`edges.json`** — `Edge`: `id`, `type`, `fromId`, `toId`, `fromVersion`, `toVersion`. Use this for the graph explorer even when the same relation is also implied by `premises`.

**`interactions.json`** — `AgentInteraction`: `id`, `agentId`, `personId` (optional initiating user), `decisionId`, `tool`, `inputDigest`, `outputDigest`, `at`, `flag` (`used` | `supporting` | `contradicting` | `unused` | `later-invalidated`), `score`, `gateway` (`allow` | `hold`).

**`approvals.json`** — `Approval`: `id`, `decisionId`, `decisionVersion`, `personId`, `role`, `at`, `kind` (`approval` | `override`), `reason`.

**`snapshots.json`** — `Snapshot`: `id`, `decisionId`, `label` (`T0` | `T1`), `at`, `sourceVersions` (map), `policyVersions` (map), `trustValue`, `ceilingState`, `checkerVersion`, `digest`.

**`certificates.json`** — `Certificate`: `id`, `decisionId`, `decisionVersion`, `statement`, `premiseDigests`, `citations` (`{decisionId, version, certificateId}`[]), `axiomsUsed` (string[]), `checkerVersion`, `scoreRuleId`, `approvals` (ids), `verdict` (`ACCEPT` | `REJECT`), `reasons` (string[]), `at`, `digest`.

**`scores.json`** — `ScoreRecord`: `id`, `subjectType` (`interaction` | `decision` | `composite` | `agent`), `subjectId`, `B`, `P`, `H`, `C`, `T`, `ruleId`, `components` (optional breakdown), `at`.

**`audit.json`** — seed events, in order. The client should re-hash on load:

```json
{
  "records": [
    {
      "id": "aud-ag-0001",
      "at": "2026-11-01T09:00:00Z",
      "type": "decision.accepted",
      "actorId": "per-luis-ortega",
      "decisionId": "dec-ag-watchlist-redstone",
      "payload": { "summary": "Watchlist check accepted." }
    }
  ]
}
```

On hydration, compute `payloadDigest = SHA-256(canonicalJSON(payload))` and `recordHash = SHA-256(prevHash || payloadDigest || id || at || type)`, with a genesis `prevHash` of 64 zero hex characters. Store `prevHash` and `recordHash` on the in-memory record. Do not trust pre-baked hashes in the fixture if they disagree with a fresh walk.

**`scenarios.json`** — one or more scripted scenarios for the player:

```json
{
  "scenarios": [
    {
      "id": "ag-watchlist-invalidation-repair",
      "title": "Watchlist update, invalidation and repair",
      "steps": [
        { "id": "t0", "title": "Passing state (T0)", "actions": [{ "op": "hydrate" }] },
        {
          "id": "change",
          "title": "Watchlist Q3 supersedes Q2",
          "actions": [
            { "op": "supersedeSource", "sourceId": "src-ag-watchlist-2026-q2", "newSourceId": "src-ag-watchlist-2026-q3" }
          ]
        },
        {
          "id": "repair",
          "title": "Bramble proposes repair; Luis approves",
          "actions": [
            { "op": "agentPropose", "agentId": "agt-bramble", "decisionId": "dec-ag-watchlist-redstone", "proposal": "cite-src-ag-watchlist-2026-q3" },
            { "op": "approve", "personId": "per-luis-ortega", "decisionId": "dec-ag-watchlist-redstone" }
          ]
        },
        {
          "id": "negative",
          "title": "Stale citation is rejected",
          "actions": [
            { "op": "agentPropose", "agentId": "agt-rowan", "decisionId": "dec-ag-allocate-redstone", "proposal": "cite-stale-watchlist", "expect": "REJECT" }
          ]
        }
      ]
    }
  ]
}
```

The medical tenant's `scenarios.json` defines `med-bulletin-invalidation-repair` with the same four-step shape (hydrate, supersede `src-med-nmb-2026-07` with `src-med-nmb-2026-11`, repair by Apothecary and Galen with Julian and Amara approvals, negative stale citation or missing dual sign-off).

A second, optional scenario per tenant may cover the harmless-change control.

---

## 8. Data model and mock API

### 8.1 Entities

`Tenant`, `Person`, `Agent`, `Project`, `DecisionTemplate`, `PolicyAxiom`, `Source`, `Decision` (versioned), `Edge`, `AgentInteraction`, `Review`/`Approval`, `Snapshot`, `Certificate`, `ScoreRecord`, `AuditRecord`.

The graph is the set of those nodes plus the edge types in §7.1. Decisions are the unit of proof; projects are grouping and permission scopes, not a second kind of proof.

### 8.2 Scoring rules (Phase 1, deterministic JS) **[proposal]**

- **Interaction score.** A weighted combination of relevance to the linked decision, whether the evidence was used or contradicted, freshness of cited sources, and a drift flag on the agent. Range 0–10. If the interaction is later invalidated by a premise change, mark `later-invalidated` and fold that into the agent's rolling score.
- **Decision score.** Adapt the published formula `T = min(C, max(0, B − P + H))`. Default `C = 7.0` when no human approval is recorded, otherwise `C = 10`. Publish the components on the `ScoreRecord`.
- **Composite score.** If any mandatory child fails or is stale, the parent does not check and no composite T is allowed to clear it. Otherwise use **weakest-link** (minimum accepted child T) as the default rule, and record `ruleId: "weakest-link-v1"` on the certificate. A weighted rule may be implemented behind the same interface but should not be the default.
- **Agent score.** A rolling aggregate of the agent's interaction scores, plus the rates of accepted, rejected and later-invalidated proposals. This is the Phase 1 stand-in for published agent-appraisal ideas, tied to the checker so that "score agents' interactions with respect to decisions" is visible on the scoreboard.

### 8.3 Checker kernel (Phase 1, deterministic JS) **[proposal]**

A small module, versioned as `checker-0.1.0`. Input: statement, typed premises, cited decisions (id + version), template, policy axioms, recorded approvals, declared score rule. Output: `ACCEPT` or `REJECT` with a list of reason codes, plus a certificate on accept.

Checks, in order: required premises present and fresh; cited decisions accepted at the cited version and not invalidated; hard axioms satisfied (including the AI-only ceiling and approver authority); composite score recomputed under the declared rule and matching the recorded T. The module must be pure: the same input always yields the same verdict. "Re-run checker" in the UI is this function applied to a stored certificate's payload.

Reason codes to implement: `missing-premise`, `stale-citation`, `invalid-citation-version`, `axiom-failed`, `ai-ceiling`, `missing-approval`, `unauthorized-approver`, `mandatory-child-failed`, `score-mismatch`.

### 8.4 `HarnessAPI` (mock interface)

```ts
interface HarnessAPI {
  // Tenants and session
  listTenants(): Promise<Tenant[]>;
  getTenant(): Promise<Tenant>;
  setTenant(id: string): Promise<void>; // resets store from that tenant's fixtures

  // Graph
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project>;
  listDecisions(filter?: DecisionFilter): Promise<Decision[]>;
  getDecision(id: string): Promise<DecisionDetail>; // includes premises, scores, certificate, snapshots
  getGraph(scope?: { projectId?: string }): Promise<{ nodes: GraphNode[]; edges: Edge[] }>;
  getFlags(): Promise<FlaggedDecision[]>;

  // Agents and people
  listPeople(): Promise<Person[]>;
  listAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent & { score: ScoreRecord; interactions: AgentInteraction[] }>;
  listInteractions(filter?: InteractionFilter): Promise<AgentInteraction[]>;

  // Certificates, audit, verification
  getCertificate(decisionId: string, version?: number): Promise<Certificate>;
  rerunChecker(decisionId: string, version?: number): Promise<CheckerVerdict>;
  listAudit(filter?: AuditFilter): Promise<AuditRecord[]>;
  verifyAuditChain(): Promise<{ ok: boolean; brokenAt?: string; details: string }>;
  demonstrateTamper(): Promise<VerifyResult>; // demo only
  resetTamper(): Promise<void>;

  // Writes used by the console and the scenario player
  // In Phase 1 these mutate the in-memory store only.
  runScenario(id: string): Promise<void>;
  stepScenario(id: string, stepId?: string): Promise<ScenarioState>;
  resetScenario(id: string): Promise<void>;
  proposeStep(input: ProposeStepInput): Promise<CheckerVerdict>;
  applySourceChange(input: { sourceId: string; newSourceId: string }): Promise<void>;
  approve(input: { decisionId: string; personId: string; reason?: string }): Promise<void>;
  override(input: { decisionId: string; personId: string; reason: string }): Promise<void>;

  // Timeline
  getTimeline(): Promise<TimelineEvent[]>;
  peekAt(at: string): Promise<GraphSnapshot>; // read-only view of state at a timestamp
}
```

`MockHarnessClient` implements every method. UI code may depend only on `HarnessAPI`, never on fixture paths or scenario internals.

---

## 9. Suggested stack, folder layout and build plan

### 9.1 Stack (Phase 1)

- **Vite + TypeScript**, `base: '/aidigiscore/'`, static build.
- **No server.** Do not add Express, serverless functions, or a remote database.
- Light UI: typed modules and CSS (Lit, Preact or vanilla modules are all fine; pick one and stay consistent). Do not pull in a heavy design system.
- **cytoscape.js** (or equivalent) for the graph explorer.
- **Web Crypto** (`crypto.subtle`) for SHA-256, no Node-only crypto.
- Fixtures as static JSON under `aidigiscore/data/`, copied to the build.
- Scripts in `package.json`: `dev`, `build`, `preview`. The build output should be publishable as the contents of `/aidigiscore/` on this GitHub Pages site.

### 9.2 Folder layout **[proposal]**

```
aidigiscore/
  README.md                 # this file
  index.html
  package.json
  tsconfig.json
  vite.config.ts            # base: '/aidigiscore/'
  data/                     # fixtures, see §7
    tenants.json
    agriculture/…
    medical/…
  src/
    main.ts
    api/
      types.ts              # entities + HarnessAPI
      mockClient.ts
    mock/
      store.ts              # in-memory graph, hydrated from fixtures
      eventBus.ts
      scenarioPlayer.ts
    engine/
      scorer.ts
      checker.ts
      audit.ts              # hash chain + verify
      invalidation.ts
      canonicalJson.ts
    ui/
      App.ts
      TenantSwitcher.ts
      ScenarioPlayer.ts
      GraphExplorer.ts
      AgentConsole.ts
      AgentScoreboard.ts
      FlagBoard.ts
      DecisionDetail.ts
      AuditView.ts
      TimelineReplay.ts
    styles/
      app.css
```

Do not add files elsewhere in the decentricity.github.io repo. Keep the prototype self-contained under `aidigiscore/`.

### 9.3 Phased build plan

**Phase 1 — this prototype (UI-heavy, simulated backend).** Build and ship a static app on GitHub Pages that tells the whole story on mock data.

Suggested implementation order:

1. Scaffold Vite + TypeScript with `base: '/aidigiscore/'`. Confirm a blank page loads at that path locally.
2. Write TypeScript types and the fixture JSON for both tenants, following §6–§7 exactly (stable IDs, complete records, not stubs).
3. Implement `store`, `eventBus`, `scorer`, `checker`, `audit` (Web Crypto hash chain + verify) and `invalidation`. Unit-test the checker and the chain in the browser or with Vite's test runner: accept a valid composite, reject a stale citation and a missing premise, recompute weakest-link, detect a tampered audit record, leave a harmless change alone.
4. Implement `MockHarnessClient` as the only backend the UI talks to.
5. Build all seven views plus the tenant switcher and the scenario player, wired to the mock API, updating live.
6. Script `ag-watchlist-invalidation-repair` and `med-bulletin-invalidation-repair` (and the harmless-change control). Confirm the acceptance tests in §10.
7. Polish: medical disclaimer banner, empty and error states, keyboard access for the player, a short in-app "About" that credits AI-DigiScore / Patrick Hopper and links this README.
8. Build statically and publish under `/aidigiscore/`.

**Phase 2 — real backend behind the same API. [proposal, later]** Replace `MockHarnessClient` with a network client. Persist the graph, scores, certificates and audit log in a real store. Keep the Phase 1 UI. Fixtures remain as seed data and as tests.

**Phase 3 — live agents and formal export. [proposal, later]** A real MCP gateway so external agents can only reach tools through the harness. A hardened identity and permissions registry. Optional export of a critical decision subgraph to a Lean 4 file, with the Lean check result attached to the certificate.

---

## 10. Success criteria and acceptance tests

The Phase 1 demo is done when all of the following are true:

- The app runs from a fresh checkout (`npm install && npm run dev`) and as a static build served under `/aidigiscore/`, with no server process.
- Switching tenants loads a complete, separate graph for Meridian Harvest Co. or Lakeshore Health Network. The medical disclaimer is visible on the medical tenant.
- Every view in §5 is implemented and is backed by mock data: graph, agent console, scoreboard, flag board, decision detail with certificate, audit view with verification, timeline replay.
- Every simulated agent tool call appears in the graph and in the audit log.
- Playing `ag-watchlist-invalidation-repair` and `med-bulletin-invalidation-repair` shows: a passing T0; a source change that invalidates a decision in one project and causes a dependent decision in another project to fail the check, within one revalidation cycle, with T0 preserved; a repair proposal that the checker accepts after the required human approvals, issuing a new certificate; a negative stale-citation or missing-premise (or missing dual sign-off) proposal that the checker rejects with a clear reason.
- Composite scores change correctly when a child changes. A mandatory child failure is not averaged away.
- Agent scores reflect how many of each agent's proposed steps the checker accepted, rejected, or later invalidated.
- Audit-chain verification reports `ok` on the intact log and detects a tampered record.
- An unchanged or harmless case is not held.
- Re-running the checker on a stored certificate reproduces the stored verdict.

---

## 11. Non-goals (Phase 1)

- A real MCP gateway, a persistent database, or a network backend.
- Export to Lean 4, or running the Lean kernel in the browser.
- Live model or LLM calls in the agent console.
- Physical-evidence capture hardware, negation-firewall / trusted-hash-registry modules, zero-knowledge proofs, and unpublished advanced metrics.
- Production SSO, IAM, multi-region deployment, or a compliance certification mapping.
- Any real company, farm, hospital, vendor, regulator or patient. No real patient data, and no clinical advice.
- Commercial, licensing or intellectual-property terms. Those are handled off this public repository.

---

## 12. Open questions

Product and method questions still to settle with the collaboration. They should not block Phase 1; the prototype takes the defaults marked below.

- Confirm that the product unit is an enterprise decision graph spanning multiple projects, with the two tenants as fixtures (the Phase 1 assumption is yes).
- How should a composite decision be scored when all mandatory children pass? Phase 1 defaults to weakest-link, with the rule id recorded on the certificate.
- Is the 0–10 scale with a 7.0 AI-only ceiling and a below-6.0 revalidation rule required, or configurable per enterprise? Phase 1 implements those as the default axioms and makes the ceiling visible in the UI.
- Can the published scoring formula and the ceiling be treated as checkable rules in the kernel (verify *how* T was computed)? Phase 1 does this.
- Which controls are hard constraints for a given template, and which are graded signals? Phase 1 uses the axiom lists in §6.
- Which agent platforms should a later phase support first (MCP, or others)?
- For which decisions, if any, is a later-phase export to Lean 4 worth the formalisation cost?

---

## Licence and credit

Prototype code in this folder follows the licence of the [Decentricity/decentricity.github.io](https://github.com/Decentricity/decentricity.github.io) repository unless a more specific licence is added here.

AI-DigiScore concepts summarised in §3 are from published US patent application 2026/0350437 A1, inventor and applicant Patrick Joseph Hopper. That application is a publication, not a grant. This repository does not grant a patent licence.

Blocksphere, Danny (Jean-Daniel Gauthier) and Patrick Hopper are building this harness in collaboration. The Lean 4 framing is Danny's analogy.
