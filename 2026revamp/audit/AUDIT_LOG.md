# Repository Audit Log

This file is an append-oriented durable research journal for the 2026 revamp repository audit. The canonical working branch is `2026revamp-data-audit`.

## 2026-09-12 — inventory boundary established

### Personal account

GitHub repository search for `user:Decentricity` was enumerated with 100 results per page:
- page 1: repositories returned
- page 2: repositories returned
- page 3: empty

Therefore the personal-account search corpus is bounded by pages 1–2.

### Organization membership corpus

GitHub repository listing with affiliation `organization_member`, 100 results per page:
- offset 0: repositories returned across the organizations listed in `repo-ledger.md`
- offset 100: **empty**

Therefore the organization-member repository corpus is bounded by the first page/offset 0. This is stronger than relying on screenshots of the Organizations UI.

### Method

Every repository is manually inspected via README and/or source/manifest/root tree. Names and descriptions alone are insufficient evidence. Straight upstream forks/reference repositories do not become Pandu-authored projects. Multi-repo products are grouped into a single public project entity, with repositories attached as evidence/components.

### Previously confirmed classifications/findings

- `Decentricity/walkgirl` — authored physical-media/tiny-computer project: Orange Pi Zero 2W + physical Walkman; live cassette audio over USB and rebroadcast through the Pi's own Wi-Fi/web interface.
- `Decentricity/ai-odyssey` — AI-produced edition/translation of Homer, not generic AI research.
- `Decentricity/prolog-userworld` — authored neuro-symbolic/persistent-memory research prototype.
- `Decentricity/UrbanWalkingSimulator` — authored Android accessibility game for blind players using TTS and step recognition.
- `Decentricity/simulate-humans` — authored artificial-life/autonomous-human simulation game.
- `Decentricity/career-ops` — README attributes authorship to Santiago; exclude from Pandu-authored showcase.
- `Decentricity/broken-systemd` — training lab/coursework artifact.
- `Decentricity/superkart-sales-forecast` — forecasting exercise/project artifact rather than flagship product.
- `Decentricity/muse-alpha-beta-theta` — Decentricity integration/recovery layer around upstream Muse analysis work; provenance distinction must be retained.
- `Decentricity/war-gov-ufo-release-01-interesting-files` — curated research/document mirror, not a software product.
- DeBio — one serious multi-repo system; component repositories should roll up under one project entity.
- `decbio` — organization presence alone is not evidence of a serious project; prior inspection showed its site is essentially a v86-based snapshot.

### Batch: reference/coursework verification

- `Decentricity/Dromedary` — README explicitly identifies the IBM Dromedary self-alignment project and points to IBM upstream/paper. Working classification: `upstream-reference` unless a later provenance diff proves substantial original modifications.
- `Decentricity/public-apis` — README is the standard collective Public APIs list and points to upstream project. Working classification: `upstream-reference`.
- `Decentricity/MIT-Assignment-for-Prompt-Engineering` — no README; root contains `MIT.py`, which runs restaurant-review analysis with GPT-4o under three prompt-specificity variants and writes separate Excel outputs. Classification: `coursework-oneoff`.

### Batch: Flipside discovery

- `Decentricity/FlipsideAndroid` — private repository; `readme.md` documents a substantial Three.js tactics game wrapped in a thin Android WebView host. Systems include cube-face/tile coordinates, wizard/rogue/tank/healer roles, turn-based and RTS modes, GunDB multiplayer, overworld/story, persistence, procedural presentation, and Android packaging. This is a real first-class project lineage, not a utility. Because this repo is private, do not expose its repository URL/content publicly by default. Relationship to `Decentricity/flipside` and Agent1c must be resolved before public project normalization.

## Resume checkpoint

Next work:
1. Inspect `Decentricity/flipside` to resolve the Flipside lineage.
2. Inspect the remaining recent authored-looking personal repos in batches.
3. Inspect all organization repositories; for large orgs such as DeBio, classify every component but normalize them under project-level entities.
4. Update `repo-ledger.md` after each batch.
5. Rebuild `projects.js` only when the ledger has no accessible unreviewed repositories.
6. Separately implement browser History API navigation on this audit branch, then validate before any production merge.
