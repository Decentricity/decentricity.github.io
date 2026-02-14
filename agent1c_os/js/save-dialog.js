import { upsertSavedApp } from "./storage.js";

export function createSaveDialog({ modal, nameField, urlField, btnNo, btnYes, onSaved }){
  let currentUrl = "";
  let onDone = null;

  function open(url, suggestedName, doneCb){
    currentUrl = url || "";
    onDone = typeof doneCb === "function" ? doneCb : null;

    urlField.textContent = currentUrl;
    nameField.value = (suggestedName || "").trim() || "";

    modal.classList.add("open");
    modal.setAttribute("aria-hidden","false");

    setTimeout(() => {
      nameField.focus();
      nameField.select();
    }, 0);
  }

  function close(){
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden","true");
    currentUrl = "";
    onDone = null;
  }

  btnNo.addEventListener("click", (e) => { e.stopPropagation(); close(); });
  btnYes.addEventListener("click", (e) => {
    e.stopPropagation();
    const name = nameField.value.trim();
    const ok = upsertSavedApp(name, currentUrl);
    if (ok) {
      if (typeof onSaved === "function") onSaved();
      if (onDone) onDone();
    }
    close();
  });

  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "Enter"){ e.preventDefault(); btnYes.click(); }
  });

  return { open, close };
}
