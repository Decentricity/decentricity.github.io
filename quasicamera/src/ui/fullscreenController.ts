export class FullscreenController {
  constructor(private readonly button: HTMLButtonElement) {
    this.button.addEventListener("click", () => {
      void this.toggle();
    });
    document.addEventListener("fullscreenchange", () => this.render());
    this.render();
  }

  private async toggle(): Promise<void> {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (orientation: string) => Promise<void>;
        };
        await orientation.lock?.("landscape").catch(() => undefined);
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen and orientation lock can be rejected by browser policy.
    } finally {
      this.render();
    }
  }

  private render(): void {
    const active = Boolean(document.fullscreenElement);
    this.button.setAttribute("aria-pressed", String(active));
    this.button.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
    this.button.classList.toggle("is-fullscreen", active);
  }
}
