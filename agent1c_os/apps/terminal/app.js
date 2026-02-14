(() => {
  const screen = document.getElementById("screen");
  const statusEl = document.getElementById("status");
  const capture = document.getElementById("capture");
  const keyOverlay = document.getElementById("keys");
  const keyboardBtn = document.getElementById("keyboard");

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text;
  };

  if (!screen) return;
  if (!window.V86Starter) {
    setStatus("v86 engine not available.");
    return;
  }

  screen.tabIndex = 0;

  const emulator = new window.V86Starter({
    wasm_path: "../../vendor/v86/v86.wasm",
    screen_container: screen,
    bios: { url: "../../vendor/v86/bios/seabios.bin" },
    vga_bios: { url: "../../vendor/v86/bios/vgabios.bin" },
    bzimage: { url: "../../vendor/v86/buildroot-bzimage.bin", size: 5166352 },
    cmdline: "tsc=reliable mitigations=off random.trust_cpu=on",
    autostart: true,
    memory_size: 256 * 1024 * 1024,
    vga_memory_size: 8 * 1024 * 1024,
  });

  emulator.add_listener("download-progress", (evt) => {
    if (!evt.lengthComputable) {
      setStatus("Loading Buildroot Linux...");
      return;
    }
    const pct = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
    setStatus(`Loading Buildroot Linux... ${pct}%`);
  });

  emulator.add_listener("download-error", () => {
    setStatus("Failed to download v86 assets.");
  });

  emulator.add_listener("emulator-loaded", () => {
    setStatus("Buildroot Linux booting...");
  });

  const focusScreen = () => {
    if (capture) capture.focus();
    screen.focus();
    emulator.keyboard_set_status?.(true);
  };

  document.addEventListener("pointerdown", focusScreen);
  screen.addEventListener("pointerdown", focusScreen);

  const sendSpecialKey = (key) => {
    const map = {
      Enter: 13,
      Backspace: 8,
      Tab: 9,
      Escape: 27,
      ArrowUp: 38,
      ArrowDown: 40,
      ArrowLeft: 37,
      ArrowRight: 39,
      Insert: 45,
      Delete: 46,
      Home: 36,
      End: 35,
      PageUp: 33,
      PageDown: 34,
    };
    const keyCode = map[key];
    if (!keyCode) return false;
    if (key === "Enter" && emulator.keyboard_send_scancodes) {
      emulator.keyboard_send_scancodes([0x1c, 0x9c]);
    } else {
      emulator.keyboard_send_keys?.([keyCode]);
    }
    return true;
  };

  if (capture) {
    capture.tabIndex = 0;
    capture.setAttribute("aria-label", "Terminal input capture");
    capture.setAttribute("autocapitalize", "off");
    capture.setAttribute("autocomplete", "off");
    capture.setAttribute("autocorrect", "off");
    capture.setAttribute("inputmode", "text");
    capture.spellcheck = false;
    capture.addEventListener("pointerdown", focusScreen);
    capture.addEventListener("touchstart", focusScreen, { passive: true });
    capture.addEventListener("keydown", (e) => {
      const sentSpecial = sendSpecialKey(e.key);
      if (!sentSpecial && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        emulator.keyboard_send_text?.(e.key);
      }
      if (keyOverlay) {
        keyOverlay.textContent = `Key: ${e.key}  Code: ${e.code || "n/a"}  KeyCode: ${e.keyCode || 0}`;
      }
      e.preventDefault();
    });
    capture.addEventListener("input", (e) => {
      const value = e.target.value;
      if (!value) return;
      emulator.keyboard_send_text?.(value);
      if (keyOverlay) {
        keyOverlay.textContent = `Input: ${value}`;
      }
      e.target.value = "";
    });
  }

  if (keyboardBtn && capture) {
    const showKeyboard = () => {
      focusScreen();
      setTimeout(() => capture.focus(), 0);
    };
    keyboardBtn.addEventListener("click", showKeyboard);
    keyboardBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      showKeyboard();
    }, { passive: false });
  }
})();
