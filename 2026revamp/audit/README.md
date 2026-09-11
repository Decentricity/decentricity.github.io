# 2026 Revamp Repository Audit

Working branch: `2026revamp-data-audit`

This directory is the durable state for the exhaustive repository audit that drives the 2026 revamp project graph. It exists specifically so the audit can be resumed safely across ChatGPT context-window rollover or another session.

## Hard rules

1. Every accessible repository discovered under `Decentricity` and the GitHub organizations supplied by Pandu must be inspected manually enough to determine what it actually is.
2. Repository name is never accepted as evidence of purpose.
3. `repo owned/accessed` is not equivalent to `project authored`.
4. Classify each repository as one of:
   - `first-class-project`
   - `supporting-repo`
   - `modified-fork`
   - `upstream-reference`
   - `coursework-oneoff`
   - `private-audit-only`
   - `ambiguous-needs-evidence`
5. Multi-repo products/projects are represented once in the public project graph, with component repositories underneath them.
6. Private repositories may inform classification but must not be exposed publicly merely because the audit can read them.
7. Existing `2026revamp/projects.js` prose is untrusted until revalidated from repository evidence.
8. Do not merge the audit data rewrite into `gh-pages` or `publish` until the corpus pass is complete and validated.

## Inventory state

Personal account discovery was performed with GitHub repository search for `user:Decentricity`, 100 results/page. Page 1 and page 2 contain results; page 3 is empty. Thus the complete current personal-account inventory is contained in those first two pages. Org repositories are audited separately.

## Confirmed findings already carried into the audit

- `Decentricity/walkgirl`: physical-media/tiny-computer project. Orange Pi Zero 2W takes live cassette audio from a physical Walkman over USB and rebroadcasts it through its own Wi-Fi/web interface. Do not classify as a simulation/world project.
- `Decentricity/ai-odyssey`: AI-produced edition/translation of Homer, not a generic AI research project.
- `Decentricity/prolog-userworld`: concrete neuro-symbolic / persistent-memory research prototype; first-class research project.
- `Decentricity/UrbanWalkingSimulator`: Android accessibility game for blind players using TTS and step recognition; authored project.
- `Decentricity/simulate-humans`: artificial-life / autonomous-human-simulation game; authored project.
- `Decentricity/career-ops`: repository README attributes authorship to Santiago; do not represent as Pandu-authored project.
- `Decentricity/broken-systemd`: Ubuntu/systemd training lab; coursework/training artifact.
- `Decentricity/superkart-sales-forecast`: forecasting exercise/project artifact, not a flagship product.
- `Decentricity/muse-alpha-beta-theta`: Decentricity installer/recovery/integration layer around upstream Muse analysis code; preserve provenance distinction.
- `Decentricity/war-gov-ufo-release-01-interesting-files`: curated document mirror/research collection, not product work.
- DeBio is a serious multi-repo project/system and must be represented once, with node/backend/indexer/UI/bioinformatics/infrastructure repositories underneath it.
- Org membership is only a discovery source; e.g. `decbio` must not be promoted just because it appears in Organizations.

## Newly checked in this continuation

- `Decentricity/Dromedary`: README is IBM Dromedary project material and explicitly links upstream IBM project/paper. Treat as upstream/reference unless a later provenance diff shows substantial Decentricity-authored changes.
- `Decentricity/public-apis`: README is the well-known collective Public APIs list. Treat as upstream/reference unless substantial original divergence is found.
- `Decentricity/MIT-Assignment-for-Prompt-Engineering`: no README; root contains a single `MIT.py` that compares three prompt-specificity variants for restaurant-review analysis using GPT-4o and Excel input/output. Classify as coursework/assignment artifact, not flagship project.

## Resume procedure

1. Read this file.
2. Read `AUDIT_LOG.md` and `repo-ledger.md`.
3. Continue opening repository README/source files for all entries still marked `PENDING` or `AMBIGUOUS`.
4. After each batch, update `repo-ledger.md` and append a short evidence note to `AUDIT_LOG.md`.
5. Only after the ledger has no unreviewed accessible repos should `projects.js` be rebuilt from project-level entities.
