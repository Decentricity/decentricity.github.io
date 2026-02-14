import { DARK_MODE_KEY, THEME_KEY } from "./constants.js";

export function initThemeToggle({ button }){
  function apply(on){
    document.body.classList.toggle("dark", !!on);
    button.textContent = on ? "☀" : "☾";
  }

  const saved = localStorage.getItem(DARK_MODE_KEY);
  apply(saved === "1");

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const on = !document.body.classList.contains("dark");
    apply(on);
    localStorage.setItem(DARK_MODE_KEY, on ? "1" : "0");
  });
}

export function getTheme(){
  return localStorage.getItem(THEME_KEY) || "hedgey";
}

export function applyTheme(name, { persist = true } = {}){
  const allowed = ["beos", "system7", "greenscreen", "cyberpunk", "hedgeyOS"];
  const theme = allowed.includes(name) ? name : "hedgey";
  document.body.classList.toggle("beos", theme === "beos");
  document.body.classList.toggle("system7", theme === "system7");
  document.body.classList.toggle("greenscreen", theme === "greenscreen");
  document.body.classList.toggle("cyberpunk", theme === "cyberpunk");
  document.body.classList.toggle("hedgeyOS", theme === "hedgeyOS");
  if (persist) localStorage.setItem(THEME_KEY, theme);
}

export function initThemeState(){
  const saved = localStorage.getItem(THEME_KEY);
  if (!saved) {
    localStorage.setItem(THEME_KEY, "hedgeyOS");
    applyTheme("hedgeyOS", { persist: false });
    return;
  }
  applyTheme(getTheme(), { persist: false });
}
