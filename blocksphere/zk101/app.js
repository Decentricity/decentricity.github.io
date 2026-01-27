let currentIndex = 0;
let pyodideReady = null;

const appEl = document.getElementById("app");
const startBtn = document.getElementById("start-btn");

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceOutsideSpans(html, pattern, replacer) {
  const parts = html.split(/(<span class="glossary"[^>]*>.*?<\/span>)/gi);
  return parts
    .map((part) => {
      if (part.startsWith("<span class=\"glossary\"")) return part;
      return part.replace(pattern, replacer);
    })
    .join("");
}

function annotateText(raw) {
  if (!raw || typeof raw !== "string") return raw;
  let output = raw;
  const glossarySorted = [...GLOSSARY].sort(
    (a, b) => b.term.length - a.term.length
  );

  glossarySorted.forEach(({ term, def }) => {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
    output = replaceOutsideSpans(output, pattern, (match) => {
      return `<span class="glossary" data-term="${term}" data-def="${def}">${match}</span>`;
    });
  });

  return output;
}

function createTopicCard(topic, index, total) {
  const card = document.createElement("section");
  card.className = "topic-card";

  card.innerHTML = `
    <div class="topic-header">
      <div>
        <h2 class="topic-title">${annotateText(topic.title)}</h2>
        <div class="topic-meta">Topic ${index + 1} of ${total} · ${annotateText(topic.subtitle)}</div>
      </div>
    <div class="topic-meta">Blocksphere Zero-Knowledge 101</div>
    </div>
    <div class="topic-body">
      <div class="topic-copy">
        <h3>Concept</h3>
        <p>${annotateText(topic.overview)}</p>
        <ul>
          ${topic.points.map((p) => `<li>${annotateText(p)}</li>`).join("")}
        </ul>
      </div>
      <div class="editor">
        <h3>Python Lab</h3>
        <textarea spellcheck="false" class="code-editor">${topic.code}</textarea>
        <div class="topic-actions">
          <button class="secondary run-btn">Run code</button>
          <div class="topic-meta">Output</div>
        </div>
        <div class="output" aria-live="polite">Ready.</div>
      </div>
    </div>
    <div class="topic-actions">
      <button class="secondary prev-btn" ${index === 0 ? "disabled" : ""}>Back</button>
      <button class="primary next-btn">${index === total - 1 ? "Finish" : "Next"}</button>
    </div>
  `;

  const runBtn = card.querySelector(".run-btn");
  const outputEl = card.querySelector(".output");
  const codeEl = card.querySelector(".code-editor");
  const prevBtn = card.querySelector(".prev-btn");
  const nextBtn = card.querySelector(".next-btn");

  runBtn.addEventListener("click", () => runCode(codeEl.value, outputEl));
  prevBtn.addEventListener("click", () => goTo(index - 1));
  nextBtn.addEventListener("click", () => goTo(index + 1));

  return card;
}

function render() {
  appEl.innerHTML = "";
  const topic = TOPICS[currentIndex];
  const card = createTopicCard(topic, currentIndex, TOPICS.length);
  appEl.appendChild(card);
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

function goTo(index) {
  if (index < 0) return;
  if (index >= TOPICS.length) {
    currentIndex = TOPICS.length - 1;
    render();
    return;
  }
  currentIndex = index;
  render();
}

async function getPyodide() {
  if (!pyodideReady) {
    pyodideReady = (async () => {
      const pyodide = await loadPyodide();
      return pyodide;
    })();
  }
  return pyodideReady;
}

async function runCode(code, outputEl) {
  outputEl.textContent = "Loading Python runtime...";
  try {
    const pyodide = await getPyodide();

    let stdout = "";
    let stderr = "";

    pyodide.setStdout({
      batched: (s) => {
        stdout += s + "\n";
      },
    });
    pyodide.setStderr({
      batched: (s) => {
        stderr += s + "\n";
      },
    });

    await pyodide.runPythonAsync(code);

    const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
    outputEl.textContent = combined || "(no output)";
  } catch (err) {
    outputEl.textContent = String(err);
  }
}

startBtn.addEventListener("click", () => {
  currentIndex = 0;
  render();
});

render();
