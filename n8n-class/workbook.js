(() => {
  const STORAGE_KEY = "n8n-class-workbook-checks-v1";

  function loadChecks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveChecks(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  function updateProgress() {
    const boxes = [...document.querySelectorAll('.content input[type="checkbox"]')];
    const done = boxes.filter((b) => b.checked).length;
    const bar = document.getElementById("progress-bar");
    const label = document.getElementById("progress-count");
    const total = boxes.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    if (bar) bar.style.width = `${pct}%`;
    if (label) label.textContent = `${done} / ${total}`;
  }

  function enhanceTaskLists() {
    const checks = loadChecks();
    document.querySelectorAll(".content li").forEach((li, idx) => {
      const box = li.querySelector('input[type="checkbox"]');
      if (!box) return;
      const ul = li.closest("ul");
      if (ul) ul.classList.add("task-list");
      li.classList.add("task-item");

      const id = `chk-${idx}-${(li.textContent || "").trim().slice(0, 60)}`;
      box.dataset.checkId = id;
      if (id in checks) box.checked = !!checks[id];
      li.classList.toggle("done", box.checked);

      box.addEventListener("change", () => {
        const map = loadChecks();
        map[id] = box.checked;
        saveChecks(map);
        li.classList.toggle("done", box.checked);
        updateProgress();
      });
    });
    updateProgress();
  }

  function enhanceCodeBlocks() {
    document.querySelectorAll(".content pre").forEach((pre) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      btn.addEventListener("click", async () => {
        const text = pre.querySelector("code")?.innerText || pre.innerText;
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = "Copied";
          setTimeout(() => (btn.textContent = "Copy"), 1200);
        } catch {
          btn.textContent = "Failed";
          setTimeout(() => (btn.textContent = "Copy"), 1200);
        }
      });
      pre.appendChild(btn);
    });
  }

  function buildToc() {
    const toc = document.getElementById("toc");
    if (!toc) return;
    const heads = [...document.querySelectorAll(".content h2, .content h3")];
    toc.innerHTML = "";
    heads.forEach((h) => {
      if (!h.id) {
        h.id = h.textContent
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      }
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `#${h.id}`;
      a.textContent = h.textContent;
      if (h.tagName === "H3") a.classList.add("depth-3");
      li.appendChild(a);
      toc.appendChild(li);
    });

    const links = [...toc.querySelectorAll("a")];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === `#${id}`));
        });
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0.01 }
    );
    heads.forEach((h) => observer.observe(h));
  }

  function wireMobileNav() {
    const toggle = document.getElementById("nav-toggle");
    const closeOnNav = () => document.body.classList.remove("nav-open");
    toggle?.addEventListener("click", () => {
      document.body.classList.toggle("nav-open");
    });
    document.getElementById("toc")?.addEventListener("click", (e) => {
      if (e.target.closest("a")) closeOnNav();
    });
    document.addEventListener("click", (e) => {
      if (!document.body.classList.contains("nav-open")) return;
      if (e.target.closest(".sidebar") || e.target.closest("#nav-toggle")) return;
      closeOnNav();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    buildToc();
    enhanceTaskLists();
    enhanceCodeBlocks();
    wireMobileNav();
  });
})();
