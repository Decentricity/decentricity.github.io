let currentIndex = 0;

const appEl = document.getElementById("app");
const startBtn = document.getElementById("start-btn");

function block(title, content) {
  if (!content) return "";
  return `
    <div class="panel">
      <h4>${title}</h4>
      <div class="code-block">${content}</div>
    </div>
  `;
}

function list(title, items) {
  if (!items || items.length === 0) return "";
  return `
    <div class="panel">
      <h4>${title}</h4>
      <div class="code-block">${items.join("\n")}</div>
    </div>
  `;
}

function renderTopic(topic, index, total) {
  const commands = topic.commands ? topic.commands.join("\n") : "";

  const card = document.createElement("section");
  card.className = "topic-card";

  card.innerHTML = `
    <div class="topic-header">
      <div>
        <h2 class="topic-title">${topic.title}</h2>
        <div class="topic-meta">${topic.slide} · Topic ${index + 1} of ${total} · ${topic.subtitle}</div>
      </div>
      <div class="topic-meta">Blocksphere Liquidity 101</div>
    </div>
    <div class="topic-body">
      <div class="topic-copy">
        <h3>Concept</h3>
        <p>${topic.overview}</p>
        ${topic.bullets ? `<ul>${topic.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}
      </div>
      <div class="topic-copy">
        <h3>Terminal Steps</h3>
        ${block("Commands", commands)}
        ${topic.studentTodo ? `<div class="panel"><h4>Student TODO</h4><div class="code-block">${topic.studentTodo}</div></div>` : ""}
        ${topic.referenceCode ? block("Reference (Complete)", topic.referenceCode) : ""}
        ${topic.notes ? list("Notes", topic.notes) : ""}
      </div>
    </div>
    <div class="topic-actions">
      <button class="secondary prev-btn" ${index === 0 ? "disabled" : ""}>Back</button>
      <button class="primary next-btn">${index === total - 1 ? "Finish" : "Next"}</button>
    </div>
  `;

  card.querySelector(".prev-btn").addEventListener("click", () => goTo(index - 1));
  card.querySelector(".next-btn").addEventListener("click", () => goTo(index + 1));

  return card;
}

function render() {
  appEl.innerHTML = "";
  const topic = TOPICS[currentIndex];
  const card = renderTopic(topic, currentIndex, TOPICS.length);
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

startBtn.addEventListener("click", () => {
  currentIndex = 0;
  render();
});

render();
