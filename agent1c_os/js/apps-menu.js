import { loadSavedApps } from "./storage.js";

export function createAppsMenu({ savedAppsList, appsList, appsConfig }){
  let submenuBound = false;
  let flyout = null;
  let flyoutCategory = null;
  let flyoutOpenedAt = 0;

  function clearNode(node){
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function ensureFlyout(){
    if (flyout) return flyout;
    flyout = document.createElement("div");
    flyout.className = "menu-dropdown bevel-out hairline menu-flyout";
    flyout.style.display = "none";
    document.body.appendChild(flyout);
    return flyout;
  }

  function closeFlyout(){
    if (!flyout) return;
    flyout.style.display = "none";
    flyout.innerHTML = "";
    flyoutCategory = null;
    flyoutOpenedAt = 0;
  }

  function emitOpen(appId){
    if (!appId) return;
    window.dispatchEvent(new CustomEvent("hedgey:open-app", {
      detail: { appId },
    }));
  }

  function isMobilePointer(){
    return window.matchMedia("(pointer: coarse)").matches;
  }

  function openFlyout(items, anchorEl, categoryKey){
    const panel = ensureFlyout();
    panel.innerHTML = "";
    items.forEach(app => {
      const row = document.createElement("div");
      row.className = "menu-item";
      row.textContent = app.title;
      row.setAttribute("data-app", app.id);
      panel.appendChild(row);
    });

    const rect = anchorEl.getBoundingClientRect();
    panel.style.display = "block";
    panel.style.position = "fixed";
    panel.style.left = "0px";
    panel.style.top = "0px";
    panel.style.pointerEvents = "none";

    const panelRect = panel.getBoundingClientRect();
    let left = rect.right;
    let top = rect.top;
    if (left + panelRect.width > window.innerWidth - 6) {
      left = rect.left - panelRect.width;
    }
    if (top + panelRect.height > window.innerHeight - 6) {
      top = Math.max(6, window.innerHeight - panelRect.height - 6);
    }
    left = Math.max(6, left);
    top = Math.max(6, top);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    flyoutCategory = categoryKey;
    flyoutOpenedAt = Date.now();
    setTimeout(() => {
      if (panel === flyout) panel.style.pointerEvents = "auto";
    }, 80);
  }

  let lastByCategory = {};

  function buildCategories(apps){
    return apps.reduce((acc, app) => {
      const category = app.category || "games";
      if (!acc[category]) acc[category] = [];
      acc[category].push(app);
      return acc;
    }, {});
  }

  function renderAppsMenu(){
    if (!appsList) return;
    clearNode(appsList);
    const apps = appsConfig?.apps || [];
    const byCategory = buildCategories(apps);
    lastByCategory = byCategory;

    const topApps = byCategory.top || [];
    if (topApps.length) {
      for (const app of topApps){
        const row = document.createElement("div");
        row.className = "menu-item";
        row.textContent = app.title;
        row.setAttribute("data-app", app.id);
        appsList.appendChild(row);
      }
      const sep = document.createElement("div");
      sep.className = "menu-sep";
      appsList.appendChild(sep);
    }

    const categories = [
      { key: "system", title: "System" },
      { key: "utilities", title: "Utilities" },
      { key: "games", title: "Games" },
    ];

    for (const category of categories){
      const items = byCategory[category.key] || [];
      if (!items.length) continue;
      const label = document.createElement("div");
      label.className = "menu-item menu-subtitle";
      label.textContent = category.title;
      label.setAttribute("data-category", category.key);
      appsList.appendChild(label);
    }

    if (!submenuBound){
      submenuBound = true;
      appsList.addEventListener("click", (e) => {
        const toggle = e.target.closest("[data-category]");
        if (!toggle) return;
        e.preventDefault();
        e.stopPropagation();
        const key = toggle.getAttribute("data-category");
        if (isMobilePointer()) {
          openFlyout((lastByCategory[key] || []), toggle, key);
          return;
        }
        if (flyoutCategory === key) {
          closeFlyout();
          return;
        }
        const items = (lastByCategory[key] || []);
        if (!items.length) return;
        openFlyout(items, toggle, key);
      });

      appsList.addEventListener("click", (e) => {
        const isCategory = e.target.closest("[data-category]");
        if (isCategory) return;
        if (flyoutCategory) closeFlyout();
      });

      appsList.addEventListener("mousemove", (e) => {
        const toggle = e.target.closest("[data-category]");
        if (!toggle) return;
        const key = toggle.getAttribute("data-category");
        if (flyoutCategory === key) return;
        const items = (lastByCategory[key] || []);
        if (!items.length) return;
        openFlyout(items, toggle, key);
      });

      appsList.addEventListener("pointerenter", (e) => {
        const toggle = e.target.closest("[data-category]");
        if (!toggle) return;
        const key = toggle.getAttribute("data-category");
        if (flyoutCategory === key) return;
        const items = (lastByCategory[key] || []);
        if (!items.length) return;
        openFlyout(items, toggle, key);
      }, true);

      document.addEventListener("click", (e) => {
        if (!flyout) return;
        if (e.target.closest(".menu-flyout")) {
          if (Date.now() - flyoutOpenedAt < 200) {
            e.stopPropagation();
            return;
          }
          const appRow = e.target.closest("[data-app]");
          if (appRow) {
            emitOpen(appRow.getAttribute("data-app"));
          }
          closeFlyout();
          const appsMenu = document.getElementById("appsMenu");
          if (appsMenu) appsMenu.classList.remove("open");
          e.stopPropagation();
          return;
        }
      });

      document.addEventListener("click", (e) => {
        if (!flyout) return;
        if (e.target.closest("#appsDropdown") || e.target.closest(".menu-flyout")) return;
        closeFlyout();
      });
    }
  }

  function renderSavedApps(){
    clearNode(savedAppsList);
    const saved = loadSavedApps();

    if (!saved.length){
      const empty = document.createElement("div");
      empty.className = "menu-item";
      empty.textContent = "(none)";
      empty.style.pointerEvents = "none";
      empty.style.opacity = "0.75";
      savedAppsList.appendChild(empty);
      return;
    }

    for (const item of saved){
      const row = document.createElement("div");
      row.className = "menu-item";
      row.textContent = item.name;
      row.setAttribute("data-saved-name", item.name);
      row.setAttribute("data-saved-url", item.url);
      savedAppsList.appendChild(row);
    }
  }

  return { renderSavedApps, renderAppsMenu };
}
