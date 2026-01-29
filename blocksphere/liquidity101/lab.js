(() => {
  let currentIndex = 0;

  const appEl = document.getElementById("labApp");
  const jumpBtn = document.getElementById("jumpToLab");

  if (!appEl || typeof TOPICS === "undefined") {
    return;
  }

  function block(title, content) {
    if (!content) return "";
    return `
      <div class="panel">
        <h4>${title}</h4>
        <div class="code-block">${escapeHtml(content)}</div>
      </div>
    `;
  }

  function list(title, items) {
    if (!items || items.length === 0) return "";
    return `
      <div class="panel">
        <h4>${title}</h4>
        <div class="code-block">${escapeHtml(items.join("\n"))}</div>
      </div>
    `;
  }

  function escapeHtml(text) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function codePanel(title, code, label) {
    if (!code) return "";
    if (label === "Complete") {
      return `
        <details class="panel details">
          <summary>${title}</summary>
          <div class="code-actions">
            <button class="secondary copy-btn" data-copy="${encodeURIComponent(code)}" data-label="${label}">Copy ${label}</button>
            <button class="secondary remix-btn">Open Remix</button>
          </div>
          <div class="code-hint">Optional: paste into Remix if you don’t want to run locally.</div>
          <div class="code-block">${escapeHtml(code)}</div>
        </details>
      `;
    }
    return `
      <div class="panel">
        <h4>${title}</h4>
        <div class="code-actions">
          <button class="secondary copy-btn" data-copy="${encodeURIComponent(code)}" data-label="${label}">Copy ${label}</button>
          <button class="secondary remix-btn">Open Remix</button>
        </div>
        <div class="code-hint">Optional: paste into Remix if you don’t want to run locally.</div>
        <div class="code-block">${escapeHtml(code)}</div>
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
          <p class="topic-note">Preferred: run locally via the terminal. Remix is optional.</p>
          ${block("Commands", commands)}
          ${topic.studentTodo ? `<div class="panel"><h4>Student TODO</h4><div class="code-block">${escapeHtml(topic.studentTodo)}</div></div>` : ""}
          ${codePanel("Student Version", topic.studentCode, "Student")}
          ${codePanel("Reference (Complete)", topic.referenceCode, "Complete")}
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

    card.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const code = decodeURIComponent(btn.getAttribute("data-copy"));
        const label = btn.getAttribute("data-label") || "Code";
        await navigator.clipboard.writeText(code);
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = `Copy ${label}`;
        }, 1200);
      });
    });

    card.querySelectorAll(".remix-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.open("https://remix.ethereum.org", "_blank", "noopener");
      });
    });

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

  if (jumpBtn) {
    jumpBtn.addEventListener("click", () => {
      document.getElementById("lab").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  window.renderLab = render;
  render();
})();
