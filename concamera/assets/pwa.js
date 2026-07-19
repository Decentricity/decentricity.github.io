export function registerPwa() {
    if (!("serviceWorker" in navigator)) {
        return;
    }
    window.addEventListener("load", () => {
        void navigator.serviceWorker.register("./sw.js").catch(() => undefined);
    });
}
