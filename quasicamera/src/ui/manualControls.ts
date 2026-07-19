import type {
  ExposureCompensationEv,
  FilmIso,
  FlashMode,
  FocalDistance,
  FocusStyle,
  GenerationGroundingMode,
  ManualCameraSettings,
  SubjectMode
} from "../types.js";
import {
  DEFAULT_MANUAL_SETTINGS,
  EXPOSURE_VALUES,
  FOCAL_DISTANCE_VALUES,
  GROUNDING_MODES,
  ISO_VALUES,
  SUBJECT_MODES,
  evLabel,
  flashLabel,
  focalDistanceLabel,
  focusStyleLabel,
  freezeManualSettings,
  groundingModeLabel,
  loadManualSettings,
  nextExposure,
  nextFocalDistance,
  nextGroundingMode,
  nextIso,
  saveManualSettings,
  snapExposure,
  snapIso,
  subjectModeLabel
} from "../context/manualSettings.js";
import {
  type DialDefinition,
  type DialDragState,
  advanceDialDrag,
  beginDialDrag as createDialDragState,
  pointerAngleDeg,
  valueToAngle
} from "./dialMath.js";

type ManualSettingsListener = (settings: ManualCameraSettings) => void;
type DialKind = "ev" | "iso";

export const EV_DIAL: DialDefinition<ExposureCompensationEv> = {
  values: EXPOSURE_VALUES,
  minAngle: -120,
  maxAngle: 120
};

export const ISO_DIAL: DialDefinition<FilmIso> = {
  values: ISO_VALUES,
  minAngle: -132,
  maxAngle: 132
};

export class ManualControls {
  private settings = loadManualSettings();
  private listeners: ManualSettingsListener[] = [];
  private activeDrag: { pointerId: number; dial: HTMLElement; state: DialDragState } | null = null;

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

    this.root.querySelector<HTMLButtonElement>("[data-control='subject-cycle']")?.addEventListener("keydown", (event) => {
      this.handleSubjectKey(event);
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-focal-distance]").forEach((button) => {
      button.addEventListener("keydown", (event) => this.handleFocalKey(event));
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-grounding-mode]").forEach((button) => {
      button.addEventListener("keydown", (event) => this.handleGroundingKey(event));
    });
  }

  private handleButton(button: HTMLButtonElement): void {
    const focusStyle = button.dataset.focusStyle as FocusStyle | undefined;
    const flashMode = button.dataset.flashMode as FlashMode | undefined;
    const focalDistance = button.dataset.focalDistance as FocalDistance | undefined;
    const groundingMode = button.dataset.groundingMode as GenerationGroundingMode | undefined;
    const ev = button.dataset.ev;
    const iso = button.dataset.iso;

    if (button.dataset.control === "subject-cycle") {
      this.cycleSubjectMode(1);
    } else if (focusStyle) {
      this.update({ focusStyle });
    } else if (flashMode) {
      this.update({ flashMode });
    } else if (focalDistance) {
      this.update({ focalDistance });
    } else if (groundingMode) {
      this.update({ groundingMode });
    } else if (ev !== undefined) {
      this.update({ exposureCompensationEv: snapExposure(Number(ev)) });
    } else if (iso !== undefined) {
      this.update({ iso: snapIso(Number(iso)) });
    }
  }

  private handleSubjectKey(event: KeyboardEvent): void {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      this.cycleSubjectMode(1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      this.cycleSubjectMode(-1);
    }
  }

  private handleFocalKey(event: KeyboardEvent): void {
    const handledKeys = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End"];
    if (!handledKeys.includes(event.key)) {
      return;
    }

    event.preventDefault();
    if (event.key === "Home") {
      this.update({ focalDistance: FOCAL_DISTANCE_VALUES[0] ?? this.settings.focalDistance });
    } else if (event.key === "End") {
      this.update({ focalDistance: FOCAL_DISTANCE_VALUES[FOCAL_DISTANCE_VALUES.length - 1] ?? this.settings.focalDistance });
    } else {
      this.update({ focalDistance: nextFocalDistance(this.settings.focalDistance, event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) });
    }
  }

  private handleGroundingKey(event: KeyboardEvent): void {
    const handledKeys = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End", "Enter", " "];
    if (!handledKeys.includes(event.key)) {
      return;
    }

    event.preventDefault();
    if (event.key === "Home") {
      this.update({ groundingMode: GROUNDING_MODES[0] ?? this.settings.groundingMode });
    } else if (event.key === "End") {
      this.update({ groundingMode: GROUNDING_MODES[GROUNDING_MODES.length - 1] ?? this.settings.groundingMode });
    } else if (event.key === "Enter" || event.key === " ") {
      this.update({ groundingMode: this.settings.groundingMode === "grounded" ? "free" : "grounded" });
    } else {
      this.update({ groundingMode: nextGroundingMode(this.settings.groundingMode, event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) });
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

    const kind = dial.dataset.dial as DialKind | undefined;
    if (kind !== "ev" && kind !== "iso") {
      return;
    }

    const face = dial.querySelector<HTMLElement>("[data-dial-face]");
    if (!face) {
      return;
    }

    event.preventDefault();
    this.endActiveDrag();

    const definition = dialDefinition(kind);
    const currentAngle = valueToAngle(
      kind === "ev" ? this.settings.exposureCompensationEv : this.settings.iso,
      definition.values,
      definition.minAngle,
      definition.maxAngle
    );
    const pointerAngle = pointerAngleDeg(event.clientX, event.clientY, face.getBoundingClientRect());
    let dragState = createDialDragState(currentAngle, pointerAngle);

    dial.setPointerCapture(event.pointerId);
    this.activeDrag = {
      pointerId: event.pointerId,
      dial,
      state: dragState
    };

    const move = (moveEvent: PointerEvent): void => {
      if (!this.activeDrag || moveEvent.pointerId !== event.pointerId) {
        return;
      }

      moveEvent.preventDefault();
      const nextPointerAngle = pointerAngleDeg(moveEvent.clientX, moveEvent.clientY, face.getBoundingClientRect());
      const next = advanceDialDrag(dragState, nextPointerAngle, definition);
      dragState = next.state;
      this.activeDrag.state = dragState;

      if (kind === "ev") {
        const exposureCompensationEv = next.value as ExposureCompensationEv;
        if (exposureCompensationEv !== this.settings.exposureCompensationEv) {
          this.update({ exposureCompensationEv });
        }
      } else {
        const iso = next.value as FilmIso;
        if (iso !== this.settings.iso) {
          this.update({ iso });
        }
      }
    };
    const up = (upEvent: PointerEvent): void => {
      if (upEvent.pointerId !== event.pointerId) {
        return;
      }

      if (dial.hasPointerCapture(upEvent.pointerId)) {
        dial.releasePointerCapture(upEvent.pointerId);
      }
      dial.removeEventListener("pointermove", move);
      dial.removeEventListener("pointerup", up);
      dial.removeEventListener("pointercancel", up);
      this.activeDrag = null;
    };

    dial.addEventListener("pointermove", move);
    dial.addEventListener("pointerup", up);
    dial.addEventListener("pointercancel", up);
  }

  private endActiveDrag(): void {
    if (!this.activeDrag) {
      return;
    }

    const { dial, pointerId } = this.activeDrag;
    if (dial.hasPointerCapture(pointerId)) {
      dial.releasePointerCapture(pointerId);
    }
    this.activeDrag = null;
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
    this.renderSubjectButton();
    this.renderLever("focusStyle", this.settings.focusStyle);
    this.renderLever("flashMode", this.settings.flashMode);
    this.renderDial("ev", this.settings.exposureCompensationEv, EV_DIAL);
    this.renderDial("iso", this.settings.iso, ISO_DIAL);
    this.renderFocalSelector();
    this.renderGroundingSelector();
  }

  private cycleSubjectMode(direction: -1 | 1 = 1): void {
    const currentIndex = SUBJECT_MODES.indexOf(this.settings.subjectMode);
    const index = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (index + direction + SUBJECT_MODES.length) % SUBJECT_MODES.length;
    this.update({ subjectMode: SUBJECT_MODES[nextIndex] ?? DEFAULT_MANUAL_SETTINGS.subjectMode });
  }

  private renderSubjectButton(): void {
    const button = this.root.querySelector<HTMLButtonElement>("[data-control='subject-cycle']");
    if (!button) {
      return;
    }

    button.dataset.selected = this.settings.subjectMode;
    button.setAttribute("aria-label", `Subject mode: ${subjectModeLabel(this.settings.subjectMode)}. Press to change mode.`);
    button.querySelector<HTMLElement>("[data-subject-label]")?.replaceChildren(subjectButtonLabel(this.settings.subjectMode));

    this.root.querySelectorAll<HTMLElement>("[data-subject-icon]").forEach((icon) => {
      const active = icon.dataset.subjectIcon === this.settings.subjectMode;
      icon.hidden = !active;
      icon.classList.toggle("is-active", active);
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

  private renderFocalSelector(): void {
    const control = this.root.querySelector<HTMLElement>("[data-control='focal-distance']");
    if (!control) {
      return;
    }

    const index = FOCAL_DISTANCE_VALUES.indexOf(this.settings.focalDistance);
    control.dataset.selected = this.settings.focalDistance;
    control.style.setProperty("--focal-index", String(Math.max(0, index)));
    control.setAttribute("aria-label", `Focal distance selector, ${focalDistanceLabel(this.settings.focalDistance)}`);

    this.root.querySelectorAll<HTMLButtonElement>("[data-focal-distance]").forEach((button) => {
      const selected = button.dataset.focalDistance === this.settings.focalDistance;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(selected));
      button.setAttribute("aria-label", `Set focal distance to ${focalDistanceLabel(button.dataset.focalDistance as FocalDistance)}`);
    });
  }

  private renderGroundingSelector(): void {
    const control = this.root.querySelector<HTMLElement>("[data-control='grounding']");
    if (!control) {
      return;
    }

    control.dataset.selected = this.settings.groundingMode;
    control.setAttribute("aria-label", `Grounding selector, ${groundingModeLabel(this.settings.groundingMode)}`);

    this.root.querySelectorAll<HTMLButtonElement>("[data-grounding-mode]").forEach((button) => {
      const selected = button.dataset.groundingMode === this.settings.groundingMode;
      const mode = button.dataset.groundingMode as GenerationGroundingMode;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(selected));
      button.setAttribute("aria-label", `Set grounding mode to ${groundingModeLabel(mode)}`);
    });
  }

  private renderDial<T extends number>(
    kind: DialKind,
    selectedValue: T,
    definition: DialDefinition<T>
  ): void {
    const dial = this.root.querySelector<HTMLElement>(`[data-dial='${kind}']`);
    if (!dial) {
      return;
    }

    const angle = valueToAngle(selectedValue, definition.values, definition.minAngle, definition.maxAngle);
    dial.style.setProperty("--rotor-angle", `${angle}deg`);
    dial.setAttribute("aria-valuenow", String(selectedValue));
    dial.setAttribute("aria-valuetext", kind === "ev" ? evLabel(selectedValue as ExposureCompensationEv) : `ISO ${selectedValue}`);
    dial.setAttribute("aria-label", kind === "ev"
      ? `Exposure compensation dial, ${evLabel(selectedValue as ExposureCompensationEv)}`
      : `ISO dial, ISO ${selectedValue}`);

    const attr = kind === "ev" ? "data-ev" : "data-iso";
    for (const button of dial.querySelectorAll<HTMLButtonElement>(`[${attr}]`)) {
      const value = Number(button.getAttribute(attr));
      const selected = definition.values.includes(value as T) && value === selectedValue;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  }
}

function dialDefinition(kind: DialKind): DialDefinition<ExposureCompensationEv | FilmIso> {
  return kind === "ev" ? EV_DIAL : ISO_DIAL;
}

function subjectButtonLabel(mode: SubjectMode): string {
  switch (mode) {
    case "single-person":
      return "PERSON";
    case "group":
      return "GROUP";
    case "crowd":
      return "CROWD";
    case "landscape":
    default:
      return "LANDSCAPE";
  }
}
