(() => {
  const storageKey = "hedgey_rss_feeds_v1";
  const feedInput = document.getElementById("feedUrl");
  const addBtn = document.getElementById("addFeed");
  const tabs = document.getElementById("tabs");
  const content = document.getElementById("content");
  let feeds = [];
  let activeId = null;
  let storageOk = true;

  function loadFeeds(){
    try {
      const raw = localStorage.getItem(storageKey);
      feeds = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(feeds)) feeds = [];
    } catch {
      storageOk = false;
      feeds = [];
    }
    if (feeds.length && !activeId) activeId = feeds[0].id;
  }

  function saveFeeds(){
    if (!storageOk) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(feeds));
    } catch {
      storageOk = false;
    }
  }

  function addFeed(url){
    const u = (url || "").trim();
    if (!u) return;
    const id = "f" + Math.random().toString(36).slice(2, 8);
    feeds.push({ id, url: u });
    activeId = id;
    saveFeeds();
    render();
  }

  function renderTabs(){
    tabs.innerHTML = "";
    if (!feeds.length) {
      tabs.style.display = "none";
      return;
    }
    tabs.style.display = "flex";
    for (const feed of feeds){
      const btn = document.createElement("button");
      btn.className = "tab" + (feed.id === activeId ? " active" : "");
      const label = feed.url.trim();
      if (label.startsWith("https://")) {
        btn.textContent = label.slice(8);
      } else if (label.startsWith("http://")) {
        btn.textContent = label.slice(7);
      } else {
        btn.textContent = label;
      }
      btn.addEventListener("click", () => {
        activeId = feed.id;
        render();
      });
      tabs.appendChild(btn);
    }
  }

  async function fetchFeed(feed){
    const proxy = "https://api.allorigins.win/raw?url=" + encodeURIComponent(feed.url);
    const resp = await fetch(proxy);
    if (!resp.ok) throw new Error("Failed to load feed.");
    const text = await resp.text();
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const items = Array.from(doc.querySelectorAll("item, entry"));
    return items.slice(0, 30).map(item => {
      const title = item.querySelector("title")?.textContent?.trim() || "Untitled";
      const linkEl = item.querySelector("link");
      const link = linkEl?.getAttribute("href") || linkEl?.textContent || "#";
      const pubDate = item.querySelector("pubDate, updated, published")?.textContent?.trim() || "";
      return { title, link, pubDate };
    });
  }

  async function renderContent(){
    const feed = feeds.find(f => f.id === activeId);
    if (!feed) {
      content.innerHTML = '<div class="empty">Add a feed to get started.</div>';
      return;
    }
    content.innerHTML = '<div class="empty">Loading feed...</div>';
    try {
      const items = await fetchFeed(feed);
      if (!items.length) {
        content.innerHTML = '<div class="empty">No items found.</div>';
        return;
      }
      content.innerHTML = "";
      items.forEach(item => {
        const wrap = document.createElement("div");
        wrap.className = "item";
        const title = document.createElement("h3");
        const link = document.createElement("a");
        link.href = item.link;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = item.title;
        title.appendChild(link);
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = item.pubDate;
        wrap.appendChild(title);
        wrap.appendChild(meta);
        content.appendChild(wrap);
      });
    } catch (err) {
      content.innerHTML = '<div class="empty">Failed to load feed.</div>';
    }
  }

  function render(){
    renderTabs();
    renderContent();
  }

  function syncTheme(){
    try {
      const parentClasses = parent?.document?.body?.classList;
      if (!parentClasses) return;
      const themes = ["dark", "beos", "system7", "greenscreen", "cyberpunk"];
      let next = "";
      for (const t of themes){
        if (parentClasses.contains(t)) {
          next = t;
          break;
        }
      }
      document.documentElement.className = next;
    } catch {
      document.documentElement.className = "";
    }
  }

  addBtn.addEventListener("click", () => {
    addFeed(feedInput.value);
    feedInput.value = "";
    feedInput.focus();
  });

  feedInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addBtn.click();
    }
  });

  loadFeeds();
  syncTheme();
  render();

  try {
    const obs = new MutationObserver(syncTheme);
    obs.observe(parent.document.body, { attributes: true, attributeFilter: ["class"] });
  } catch {}
})();
