# Jev: expert systems, but the predicates understand you

Static article and recorded experiment at https://decentricity.github.io/jev/.
All people, buyers, policies, offers, and dialogue are fictional. The 25 Jev
responses are real; the page replays them and makes no live API calls.

## Read and replay

Serve this directory's parent, then open `/jev/`:

```sh
python3 -m http.server 8765
```

## Verify without a key

```sh
python3 code/replay_check.py
python3 code/replay_check.py --summary
```

The audit replays the deterministic controller over all recorded responses and
checks request reconstruction, state transitions, reply selection, and four
controller invariants. It does not rerun Jev. Nineteen of 25 branches match the
prewritten expectations; six mismatches remain intentionally visible.

## Make new live calls

Python 3.10+; the main runner uses only the standard library.
Read a key without echoing it or placing its value in shell history:

```sh
read -rsp 'TypeSafe API key: ' TYPESAFE_API_KEY
export TYPESAFE_API_KEY
python3 code/sales_npc.py --scenario champion --output ./new-run
unset TYPESAFE_API_KEY
```

Omit `--scenario champion` to run all eight authored paths (25 turns); use
`--workers 1` for sequential execution. A rerun may produce different answers.
Run outputs go into `new-run`, leaving the published recording unchanged.
The optional `code/jev_minimal_example.py` needs `pip install typesafe-sdk`;
`code/typesafe_quick_test.py` demonstrates all three primitives without the SDK.
Never add a credential to client-side JavaScript, a screenshot, or Git.

## Recording provenance

- Model: `jev-1.13.0`, 19 September 2026, UTC.
- Initial run: six paths, 23 calls, 19 expected-branch matches.
- Follow-up: two explicit-offer probes, both still chose clarification.
- Final total: 25 calls, 19 matches, zero failures of the four recorded invariants.
- `data/original-recording.json` is the unchanged original recording.
- `data/results.json` preserves every answer and result but reconstructs request
  history snapshots, with a top-level `recording_correction` explanation.
- `data/replay.js` is a compact browser display dataset derived from that file.
- `data/report.md` contains the complete readable transcript.

### Logger bug and correction

The original request objects referenced one growing history list. HTTP serialized
that list synchronously before adding the current turn, but saving the records
afterward showed future turns in older request fields. This is an evidence-logging
bug, not evidence that future messages were sent to Jev. Histories are reconstructed
from the retained initial context and preceding recorded dialogue; they are not
independent network captures. The published runner now deep-copies request history.
Rebuild derived data with `node code/prepare_recording.mjs`.

### What this does not prove

This is not a representative accuracy, latency, safety, or calibration benchmark.
Expected labels were authored for the demo. Four follow-up/short-assent probes
are closely related. The roles and approvals are simulated, not authenticated
business authority. No contract is signed and no external action is executed.
Numbers parse only a limited set of example formats, not every Indonesian locale.
The 0.85 Noul and 0.45 Choice-confidence thresholds are not production-validated.
Scores are observed telemetry, not control signals in this implementation.
