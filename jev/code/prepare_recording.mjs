// Reconstruct request snapshots from the original append-only conversation log.
// API responses, observed branches, labels, timings, and state are never edited.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const original = JSON.parse(fs.readFileSync(path.join(root, 'data/original-recording.json'), 'utf8'));
const data = structuredClone(original);
let corrected = 0;
for (const scenario of data.conversations) {
  const fullHistory = scenario.turns[0].request.state.conversation;
  const prefixLength = fullHistory.length - scenario.turns.length * 2;
  if (prefixLength < 0) throw new Error('Unexpected original history length');
  const history = structuredClone(fullHistory.slice(0, prefixLength));
  scenario.initial_history = structuredClone(history);
  for (const turn of scenario.turns) {
    turn.request.state.conversation = structuredClone(history);
    history.push({speaker:turn.buyer.name, text:turn.buyer.text}, {speaker:'Raya, sales NPC', text:turn.seller_reply});
    corrected++;
  }
  if (JSON.stringify(history) !== JSON.stringify(fullHistory)) throw new Error('History reconstruction failed');
}
data.recording_correction = {
  fields_corrected: corrected,
  original_file: 'original-recording.json',
  description: 'The original logger retained a reference to an append-only history list, so saved request.conversation fields later contained the entire conversation. The synchronous HTTP request was serialized before each new turn was appended; future turns were not available at call time. In this file, those history fields are reconstructed from the initial context and preceding recorded turns, not independently captured wire payloads. All API responses, observed branches, prewritten labels, timings, and before/after states are unchanged. The original file is retained for audit. The published runner now deep-copies history when building each request.'
};
fs.writeFileSync(path.join(root, 'data/results.json'), JSON.stringify(data, null, 2) + '\n');
const compact = {run_at_utc:data.run_at_utc, summary:data.summary, conversations:data.conversations.map(s => ({
  id:s.id, title:s.title, hidden_setup:s.hidden_setup, initial_history:s.initial_history,
  turns:s.turns.map(t=>({number:t.number,buyer:t.buyer,seller_reply:t.seller_reply,branch:t.branch,
    expected_branch:t.expected_branch,checks:t.checks,events:t.events,before:t.before,after:t.after,
    answers:t.response.answers,elapsed_seconds:t.elapsed_seconds,author_note:t.author_note}))
}))};
fs.writeFileSync(path.join(root, 'data/replay.js'), 'window.JEV_RECORDING = '+JSON.stringify(compact).replaceAll('<','\\u003c')+';\n');
console.log(`Prepared ${corrected} reconstructed histories; responses preserved.`);
