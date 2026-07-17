export class FullscreenController {
    button;
    constructor(button) {
        this.button = button;
        this.button.addEventListener("click", () => {
            void this.toggle();
        });
        document.addEventListener("fullscreenchange", () => this.render());
        this.render();
    }
    async toggle() {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                const orientation = screen.orientation;
                await orientation.lock?.("landscape").catch(() => undefined);
            }
            else {
                await document.exitFullscreen();
            }
        }
        catch {
            // Fullscreen and orientation lock can be rejected by browser policy.
        }
        finally {
            this.render();
        }
    }
    render() {
        const active = Boolean(document.fullscreenElement);
        this.button.setAttribute("aria-pressed", String(active));
        this.button.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
        this.button.classList.toggle("is-fullscreen", active);
    }
}
