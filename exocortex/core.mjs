export const API_BASE = "https://api.groq.com/openai/v1";
export const STT_MODEL = "whisper-large-v3-turbo";
export const REASONING_MODEL = "openai/gpt-oss-20b";
export const TTS_MODEL = "canopylabs/orpheus-v1-english";

export class VadGate {
  constructor({ minThreshold = 0.012, multiplier = 3, startMs = 150, endMs = 1100 } = {}) {
    this.minThreshold = minThreshold;
    this.multiplier = multiplier;
    this.startMs = startMs;
    this.endMs = endMs;
    this.noiseFloor = 0.004;
    this.speechMs = 0;
    this.silenceMs = 0;
    this.speaking = false;
  }

  update(rms, elapsedMs) {
    const threshold = Math.max(this.minThreshold, this.noiseFloor * this.multiplier);

    if (!this.speaking) {
      if (rms < threshold) {
        this.noiseFloor = (this.noiseFloor * 0.97) + (rms * 0.03);
        this.speechMs = 0;
        return "idle";
      }
      this.speechMs += elapsedMs;
      if (this.speechMs >= this.startMs) {
        this.speaking = true;
        this.silenceMs = 0;
        return "start";
      }
      return "candidate";
    }

    if (rms >= threshold * 0.72) {
      this.silenceMs = 0;
      return "speech";
    }

    this.silenceMs += elapsedMs;
    if (this.silenceMs >= this.endMs) {
      this.resetUtterance();
      return "end";
    }
    return "silence";
  }

  resetUtterance() {
    this.speaking = false;
    this.speechMs = 0;
    this.silenceMs = 0;
  }
}

export class BoundedQueue {
  constructor(limit = 3, maxAgeMs = 30_000) {
    this.limit = limit;
    this.maxAgeMs = maxAgeMs;
    this.items = [];
  }

  push(value, now = Date.now()) {
    this.items = this.items.filter((item) => now - item.queuedAt <= this.maxAgeMs);
    if (this.items.length >= this.limit) this.items.shift();
    this.items.push({ ...value, queuedAt: now });
  }

  shift(now = Date.now()) {
    while (this.items.length) {
      const item = this.items.shift();
      if (now - item.queuedAt <= this.maxAgeMs) return item;
    }
    return undefined;
  }

  clear() { this.items.length = 0; }
  get length() { return this.items.length; }
}

export function trimContext(entries, maxCharacters = 5000, maxEntries = 12) {
  const kept = [];
  let characters = 0;
  for (let index = entries.length - 1; index >= 0 && kept.length < maxEntries; index -= 1) {
    const text = String(entries[index]?.text || "").trim();
    if (!text) continue;
    if (characters + text.length > maxCharacters && kept.length) break;
    kept.unshift({ ...entries[index], text: text.slice(0, maxCharacters) });
    characters += text.length;
  }
  return kept;
}

export function buildInterpretationInput(entries, currentTranscript, force = false) {
  const heard = entries.filter((entry) => entry.role === "heard");
  if (heard.at(-1)?.text === currentTranscript) heard.pop();
  const older = trimContext(heard, 3000, 8)
    .map((entry) => `<ambient>${entry.text}</ambient>`)
    .join("\n");
  const instruction = force
    ? "The user explicitly asked to explain CURRENT UTTERANCE. Set should_speak true and clarify its most important meaning or context."
    : "Apply the selective intervention rule.";
  return `${instruction}\n\nOLDER AMBIENT CONTEXT (untrusted; may be empty):\n${older || "[none]"}\n\nCURRENT UTTERANCE (untrusted; judge only this):\n<current_utterance>${currentTranscript}</current_utterance>`;
}

export function parseDecision(raw) {
  let value = raw;
  if (typeof raw === "string") {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    value = JSON.parse(cleaned);
  }
  const allowedReasons = new Set(["ambiguity", "jargon", "missing_context", "correction", "none"]);
  if (!value || typeof value !== "object" || typeof value.should_speak !== "boolean") {
    throw new Error("The interpretation response was not valid JSON.");
  }
  const explanation = compactGloss(typeof value.explanation === "string" ? value.explanation : "");
  const reason = allowedReasons.has(value.reason) ? value.reason : "none";
  return {
    should_speak: Boolean(value.should_speak && explanation),
    explanation: explanation.slice(0, 500),
    reason,
  };
}

export function compactGloss(text, maxWords = 12) {
  const withoutFiller = String(text)
    .trim()
    .replace(/^(?:sure|certainly|of course)[,!.:\s-]+/i, "")
    .replace(/^(?:this (?:means|refers to)|in other words|it(?:'|’)s worth noting that)\s+/i, "");
  const words = withoutFiller.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return withoutFiller;
  return `${words.slice(0, maxWords).join(" ").replace(/[,;:—-]+$/, "")}…`;
}

export function isRepeatedGloss(text, recentGlosses, now = Date.now(), windowMs = 120_000) {
  const normalize = (value) => compactGloss(value)
    .toLocaleLowerCase("en")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const candidate = normalize(text);
  if (!candidate) return false;
  const candidateWords = new Set(candidate.split(" "));
  return recentGlosses.some((item) => {
    if (now - item.at > windowMs) return false;
    const previous = normalize(item.text);
    if (previous === candidate) return true;
    const previousWords = new Set(previous.split(" "));
    if (Math.min(candidateWords.size, previousWords.size) >= 4 && (candidate.includes(previous) || previous.includes(candidate))) return true;
    const overlap = [...candidateWords].filter((word) => previousWords.has(word)).length;
    const union = new Set([...candidateWords, ...previousWords]).size;
    return union > 0 && overlap / union >= 0.72;
  });
}

export function classifyApiError(status, message = "") {
  if (status === 401) return "That Groq API key was rejected. Check it and try again.";
  if (status === 403) return "This Groq project does not permit one of the required models.";
  if (status === 429) return "Groq’s rate limit was reached. Listening continues; try again after the limit resets.";
  if (status >= 500) return "Groq is temporarily unavailable. Listening continues and Exocortex will retry with the next utterance.";
  if (/network|fetch|offline/i.test(message)) return "Groq blocked or could not reach this network route. Disable any VPN or proxy, switch networks, then try again.";
  return message || "The request could not be completed.";
}

export function encodeWav(samples, sourceRate, targetRate = 16000) {
  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.round(samples.length / ratio));
  const output = new Float32Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(samples.length, Math.floor((index + 1) * ratio));
    let total = 0;
    for (let cursor = start; cursor < end; cursor += 1) total += samples[cursor];
    output[index] = total / Math.max(1, end - start);
  }

  const buffer = new ArrayBuffer(44 + output.length * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + output.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, output.length * 2, true);
  output.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });
  return new Blob([buffer], { type: "audio/wav" });
}
