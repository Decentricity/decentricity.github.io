import { saveUpload } from "../../js/filesystem.js";

const pickBtn = document.getElementById("pickFiles");
const input = document.getElementById("fileInput");

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

function notifyComplete(){
  if (parent?.window) {
    parent.window.dispatchEvent(new Event("hedgey:docs-changed"));
    parent.window.dispatchEvent(new Event("hedgey:upload-complete"));
    parent.window.dispatchEvent(new Event("hedgey:close-upload"));
  }
}

pickBtn.addEventListener("click", () => input.click());
input.addEventListener("change", async () => {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  for (const file of files){
    await saveUpload(file);
  }
  input.value = "";
  notifyComplete();
});

syncTheme();
try {
  const obs = new MutationObserver(syncTheme);
  obs.observe(parent.document.body, { attributes: true, attributeFilter: ["class"] });
} catch {}
