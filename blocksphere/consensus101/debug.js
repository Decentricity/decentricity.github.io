export function initDebugPanel() {
  const params = new URLSearchParams(window.location.search);
  const enabled = params.has("debug");
  const panel = document.getElementById("debugPanel");
  const logEl = document.getElementById("debugLog");
  if (!panel || !logEl) return;

  panel.style.display = enabled ? "block" : "none";
  if (!enabled) return;

  function log(msg) {
    logEl.textContent += `\n${msg}`;
  }

  logEl.textContent = "Debug enabled.";

  window.addEventListener("error", (e) => {
    log(`Error: ${e.message} @ ${e.filename}:${e.lineno}`);
  });

  window.addEventListener("unhandledrejection", (e) => {
    log(`Unhandled rejection: ${e.reason}`);
  });

  log(`UserAgent: ${navigator.userAgent}`);
  log(`WebGL: ${detectWebGL() ? "available" : "unavailable"}`);
}

function detectWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch (e) {
    return false;
  }
}
