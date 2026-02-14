export function initMenuDropdowns({ menubar }){
  const menus = Array.from(menubar.querySelectorAll(".menu"));

  function closeAll(){ menus.forEach(m => m.classList.remove("open")); }

  menubar.addEventListener("click", (e) => {
    const menu = e.target.closest(".menu");
    if (!menu) return;
    const already = menu.classList.contains("open");
    closeAll();
    if (!already) menu.classList.add("open");
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest("#menubar")) return;
    closeAll();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });
}

async function requestFullScreen(){
  try{
    const el = document.documentElement;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (el.requestFullscreen) {
      await el.requestFullscreen();
    }
  } catch {
    // ignore; some mobile browsers are picky about gestures
  }
}

export function initMenuActions({ menubar, wm, appsMenu, defaultApps, hud }){
  function openAppById(appId){
    if (!appId) return;
    if (appId === "localTerminal"){
      wm.createTerminalWindow();
    } else if (appId === "files"){
      wm.createFilesWindow();
    } else if (appId === "browser"){
      wm.createBrowserWindow();
    } else if (appId === "notes"){
      wm.createNotesWindow();
    } else if (defaultApps[appId]){
      wm.createAppWindow(defaultApps[appId].title, defaultApps[appId].url);
    }
  }

  menubar.addEventListener("click", (e) => {
    const action = e.target.getAttribute("data-action");
    const app = e.target.getAttribute("data-app");

    const savedRow = e.target.closest("[data-saved-url]");
    if (savedRow){
      const title = savedRow.getAttribute("data-saved-name") || "App";
      const url = savedRow.getAttribute("data-saved-url") || "about:blank";
      wm.createAppWindow(title, url);
      e.stopPropagation();
      return;
    }

    if (action === "fullScreen"){
      requestFullScreen();
    }
    if (action === "toggleHud" && hud){
      hud.toggle();
    }

    if (action === "openThemes"){
      wm.createThemesWindow();
    }

    if (action === "aboutSystem"){
      wm.createAppWindow("About", defaultApps.about.url);
    }
    if (action === "newFiles"){
      wm.createFilesWindow();
    }
    if (action === "newNotes"){
      wm.createNotesWindow();
    }
    if (action === "arrangeWindows" && typeof wm.arrangeVisibleWindows === "function"){
      wm.arrangeVisibleWindows();
    }
    if (action === "tileWindows" && typeof wm.tileVisibleWindows === "function"){
      wm.tileVisibleWindows();
    }

    if (app) openAppById(app);

    if (e.target.closest("#appsMenu")){
      wm.refreshOpenWindowsMenu();
      wm.refreshIcons();
    }

    if (action || app || savedRow) e.stopPropagation();
  });

  window.addEventListener("hedgey:open-app", (e) => {
    const appId = e.detail?.appId;
    if (!appId) return;
    openAppById(appId);
  });

  window.addEventListener("hedgey:upload-complete", () => {
    if (wm && typeof wm.focusDocumentsWindow === "function") {
      wm.focusDocumentsWindow();
    }
  });

  window.addEventListener("hedgey:close-upload", () => {
    if (!wm) return;
    const uploadWin = Array.from(document.querySelectorAll("[data-win]"))
      .find(win => (win.querySelector("[data-titletext]")?.textContent || "") === "Upload");
    if (!uploadWin) return;
    const id = uploadWin.dataset.id;
    if (id) {
      const closeBtn = uploadWin.querySelector("[data-close]");
      if (closeBtn) closeBtn.click();
    }
    if (typeof wm.focusDocumentsWindow === "function") {
      setTimeout(() => wm.focusDocumentsWindow(), 0);
    }
  });

  appsMenu.renderSavedApps();
}
