import type {
  ExposureCompensationEv,
  FilmIso,
  FlashMode,
  FocusStyle,
  ManualCameraSettings,
  SubjectMode
} from "../types.js";
import {
  EXPOSURE_VALUES,
  ISO_VALUES,
  SUBJECT_MODES,
  evLabel,
  flashLabel,
  focusStyleLabel,
  freezeManualSettings,
  loadManualSettings,
  nextExposure,
  nextIso,
  saveManualSettings,
  snapExposure,
  snapIso,
  subjectModeLabel
} from "../context/manualSettings.js";

type ManualSettingsListener = (settings: ManualCameraSettings) => void;

const SUBJECT_ANGLES: Record<SubjectMode, number> = {
  landscape: 0,
  "single-person": 90,
  group: 180,
  crowd: 270
};

export class ManualControls {
  private settings = loadManualSettings();
  private listeners: ManualSettingsListener[] = [];

  constructor(private readonly root: HTMLElement) {
    this.bind();
    this.render();
  }

  currentSettings(): ManualCameraSettings {
    return freezeManualSettings(this.settings);
  }

  freezeSettings(): ManualCameraSettings {
    return freezeManualSettings(this.settings);
  }

  onChange(listener: ManualSettingsListener): void {
    this.listeners.push(listener);
  }

  private bind(): void {
    this.root.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      this.handleButton(target);
    });

    this.root.querySelectorAll<HTMLElement>("[data-dial]").forEach((dial) => {
      dial.addEventListener("keydown", (event) => this.handleDialKey(event, dial));
      dial.addEventListener("pointerdown", (event) => this.beginDialDrag(event, dial));
    });
  }

  private handleButton(button: HTMLButtonElement): void {
    const focusStyle = button.dataset.focusStyle as FocusStyle | undefined;
    const flashMode = button.dataset.flashMode as FlashMode | undefined;
    const subjectMode = button.dataset.subjectMode as SubjectMode | undefined;
    const ev = button.dataset.ev;
    const iso = button.dataset.iso;

    if (focusStyle) {
      this.update({ focusStyle });
    } else if (flashMode) {
      this.update({ flashMode });
    } else if (subjectMode) {
      this.update({ subjectMode });
    } else if (ev !== undefined) {
      this.update({ exposureCompensationEv: snapExposure(Number(ev)) });
    } else if (iso !== undefined) {
      this.update({ iso: snapIso(Number(iso)) });
    }
  }

  private handleDialKey(event: KeyboardEvent, dial: HTMLElement): void {
    const kind = dial.dataset.dial;
    if (kind !== "ev" && kind !== "iso") {
      return;
    }

    const handledKeys = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End"];
    if (!handledKeys.includes(event.key)) {
      return;
    }

    event.preventDefault();
    if (kind === "ev") {
      this.handleEvKey(event.key);
    } else {
      this.handleIsoKey(event.key);
    }
  }

  private beginDialDrag(event: PointerEvent, dial: HTMLElement): void {
    if (event.target instanceof HTMLButtonElement) {
      return;
    }

    const kind = dial.dataset.dial;
    if (kind !== "ev" && kind !== "iso") {
      return;
    }

    event.preventDefault();
    dial.setPointerCapture(event.pointerId);
    this.updateDialFromPointer(event, dial);

    const move = (moveEvent: PointerEvent): void => {
      this.updateDialFromPointer(moveEvent, dial);
    };
    const up = (upEvent: PointerEvent): void => {
      dial.releasePointerCapture(upEvent.pointerId);
      dial.removeEventListener("pointermove", move);
      dial.removeEventListener("pointerup", up);
      dial.removeEventListener("pointercancel", up);
    };

    dial.addEventListener("pointermove", move);
    dial.addEventListener("pointerup", up);
    dial.addEventListener("pointercancel", up);
  }

  private updateDialFromPointer(event: PointerEvent, dial: HTMLElement): void {
    const rect = dial.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    const angle = clamp(Math.atan2(y, x) * 180 / Math.PI + 90, -140, 140);

    if (dial.dataset.dial === "ev") {
      const ratio = (clamp(angle, -120, 120) + 120) / 240;
      const value = -3 + ratio * 6;
      this.update({ exposureCompensationEv: snapExposure(value) });
    } else {
      const ratio = (clamp(angle, -132, 132) + 132) / 264;
      const index = Math.round(ratio * (ISO_VALUES.length - 1));
      this.update({ iso: ISO_VALUES[index] ?? this.settings.iso });
    }
  }

  private handleEvKey(key: string): void {
    if (key === "Home") {
      this.update({ exposureCompensationEv: EXPOSURE_VALUES[0] ?? this.settings.exposureCompensationEv });
    } else if (key === "End") {
      this.update({ exposureCompensationEv: EXPOSURE_VALUES[EXPOSURE_VALUES.length - 1] ?? this.settings.exposureCompensationEv });
    } else {
      this.update({ exposureCompensationEv: nextExposure(this.settings.exposureCompensationEv, key === "ArrowRight" || key === "ArrowUp" ? 1 : -1) });
    }
  }

  private handleIsoKey(key: string): void {
    if (key === "Home") {
      this.update({ iso: ISO_VALUES[0] ?? this.settings.iso });
    } else if (key === "End") {
      this.update({ iso: ISO_VALUES[ISO_VALUES.length - 1] ?? this.settings.iso });
    } else {
      this.update({ iso: nextIso(this.settings.iso, key === "ArrowRight" || key === "ArrowUp" ? 1 : -1) });
    }
  }

  private update(patch: Partial<ManualCameraSettings>): void {
    this.settings = freezeManualSettings({
      ...this.settings,
      ...patch
    });
    saveManualSettings(this.settings);
    this.render();
    for (const listener of this.listeners) {
      listener(this.currentSettings());
    }
  }

  private render(): void {
    this.renderSubjectDial();
    this.renderLever("focusStyle", this.settings.focusStyle);
    this.renderLever("flashMode", this.settings.flashMode);
    this.renderDial("ev", this.settings.exposureCompensationEv, EXPOSURE_VALUES, evAngle);
    this.renderDial("iso", this.settings.iso, ISO_VALUES, isoAngle);
  }

  private renderSubjectDial(): void {
    const dial = this.root.querySelector<HTMLElement>("[data-control='subject']");
    if (!dial) {
      return;
    }

    dial.style.setProperty("--mode-angle", `${SUBJECT_ANGLES[this.settings.subjectMode]}deg`);
    dial.setAttribute("aria-label", `Subject mode dial, ${subjectModeLabel(this.settings.subjectMode)}`);
    this.root.querySelectorAll<HTMLButtonElement>("[data-subject-mode]").forEach((button) => {
      const selected = button.dataset.subjectMode === this.settings.subjectMode;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(selected));
    });
  }

  private renderLever(key: "focusStyle" | "flashMode", selectedValue: FocusStyle | FlashMode): void {
    const attr = key === "focusStyle" ? "data-focus-style" : "data-flash-mode";
    const control = this.root.querySelector<HTMLElement>(key === "focusStyle" ? "[data-control='depth']" : "[data-control='flash']");
    control?.setAttribute("data-selected", selectedValue);
    control?.setAttribute(
      "aria-label",
      key === "focusStyle"
        ? `Depth selector, ${focusStyleLabel(selectedValue as FocusStyle)}`
        : `Flash selector, ${flashLabel(selectedValue as FlashMode)}`
    );

    this.root.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach((button) => {
      const selected = button.getAttribute(attr) === selectedValue;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(selected));
    });
  }

  private renderDial<T extends number>(
    kind: "ev" | "iso",
    selectedValue: T,
    values: readonly T[],
    angleForValue: (value: T) => number
  ): void {
    const dial = this.root.querySelector<HTMLElement>(`[data-dial='${kind}']`);
    const face = dial?.querySelector<HTMLElement>("[data-dial-face]");
    if (!dial || !face) {
      return;
    }

    const angle = angleForValue(selectedValue);
    face.style.setProperty("--dial-angle", `${-angle}deg`);
    dial.setAttribute("aria-valuenow", String(selectedValue));
    dial.setAttribute("aria-valuetext", kind === "ev" ? evLabel(selectedValue as ExposureCompensationEv) : `ISO ${selectedValue}`);
    dial.setAttribute("aria-label", kind === "ev"
      ? `Exposure compensation dial, ${evLabel(selectedValue as ExposureCompensationEv)}`
      : `ISO dial, ISO ${selectedValue}`);

    const attr = kind === "ev" ? "data-ev" : "data-iso";
    for (const button of dial.querySelectorAll<HTMLButtonElement>(`[${attr}]`)) {
      const value = Number(button.getAttribute(attr));
      const selected = values.includes(value as T) && value === selectedValue;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  }
}

function evAngle(value: ExposureCompensationEv): number {
  return value * 40;
}

function isoAngle(value: FilmIso): number {
  const index = ISO_VALUES.indexOf(value);
  return -132 + index * 24;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
