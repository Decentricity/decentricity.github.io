import { DEFAULT_MANUAL_SETTINGS, EXPOSURE_VALUES, ISO_VALUES, SUBJECT_MODES, evLabel, flashLabel, focusStyleLabel, freezeManualSettings, loadManualSettings, nextExposure, nextIso, saveManualSettings, snapExposure, snapIso, subjectModeLabel } from "../context/manualSettings.js";
import { advanceDialDrag, beginDialDrag as createDialDragState, pointerAngleDeg, valueToAngle } from "./dialMath.js";
export const EV_DIAL = {
    values: EXPOSURE_VALUES,
    minAngle: -120,
    maxAngle: 120
};
export const ISO_DIAL = {
    values: ISO_VALUES,
    minAngle: -132,
    maxAngle: 132
};
export class ManualControls {
    root;
    settings = loadManualSettings();
    listeners = [];
    activeDrag = null;
    constructor(root) {
        this.root = root;
        this.bind();
        this.render();
    }
    currentSettings() {
        return freezeManualSettings(this.settings);
    }
    freezeSettings() {
        return freezeManualSettings(this.settings);
    }
    onChange(listener) {
        this.listeners.push(listener);
    }
    bind() {
        this.root.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target.closest("button") : null;
            if (!(target instanceof HTMLButtonElement)) {
                return;
            }
            this.handleButton(target);
        });
        this.root.querySelectorAll("[data-dial]").forEach((dial) => {
            dial.addEventListener("keydown", (event) => this.handleDialKey(event, dial));
            dial.addEventListener("pointerdown", (event) => this.beginDialDrag(event, dial));
        });
        this.root.querySelector("[data-control='subject-cycle']")?.addEventListener("keydown", (event) => {
            this.handleSubjectKey(event);
        });
    }
    handleButton(button) {
        const focusStyle = button.dataset.focusStyle;
        const flashMode = button.dataset.flashMode;
        const ev = button.dataset.ev;
        const iso = button.dataset.iso;
        if (button.dataset.control === "subject-cycle") {
            this.cycleSubjectMode(1);
        }
        else if (focusStyle) {
            this.update({ focusStyle });
        }
        else if (flashMode) {
            this.update({ flashMode });
        }
        else if (ev !== undefined) {
            this.update({ exposureCompensationEv: snapExposure(Number(ev)) });
        }
        else if (iso !== undefined) {
            this.update({ iso: snapIso(Number(iso)) });
        }
    }
    handleSubjectKey(event) {
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            this.cycleSubjectMode(1);
        }
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            this.cycleSubjectMode(-1);
        }
    }
    handleDialKey(event, dial) {
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
        }
        else {
            this.handleIsoKey(event.key);
        }
    }
    beginDialDrag(event, dial) {
        if (event.target instanceof HTMLButtonElement) {
            return;
        }
        const kind = dial.dataset.dial;
        if (kind !== "ev" && kind !== "iso") {
            return;
        }
        const face = dial.querySelector("[data-dial-face]");
        if (!face) {
            return;
        }
        event.preventDefault();
        this.endActiveDrag();
        const definition = dialDefinition(kind);
        const currentAngle = valueToAngle(kind === "ev" ? this.settings.exposureCompensationEv : this.settings.iso, definition.values, definition.minAngle, definition.maxAngle);
        const pointerAngle = pointerAngleDeg(event.clientX, event.clientY, face.getBoundingClientRect());
        let dragState = createDialDragState(currentAngle, pointerAngle);
        dial.setPointerCapture(event.pointerId);
        this.activeDrag = {
            pointerId: event.pointerId,
            dial,
            state: dragState
        };
        const move = (moveEvent) => {
            if (!this.activeDrag || moveEvent.pointerId !== event.pointerId) {
                return;
            }
            moveEvent.preventDefault();
            const nextPointerAngle = pointerAngleDeg(moveEvent.clientX, moveEvent.clientY, face.getBoundingClientRect());
            const next = advanceDialDrag(dragState, nextPointerAngle, definition);
            dragState = next.state;
            this.activeDrag.state = dragState;
            if (kind === "ev") {
                const exposureCompensationEv = next.value;
                if (exposureCompensationEv !== this.settings.exposureCompensationEv) {
                    this.update({ exposureCompensationEv });
                }
            }
            else {
                const iso = next.value;
                if (iso !== this.settings.iso) {
                    this.update({ iso });
                }
            }
        };
        const up = (upEvent) => {
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
    endActiveDrag() {
        if (!this.activeDrag) {
            return;
        }
        const { dial, pointerId } = this.activeDrag;
        if (dial.hasPointerCapture(pointerId)) {
            dial.releasePointerCapture(pointerId);
        }
        this.activeDrag = null;
    }
    handleEvKey(key) {
        if (key === "Home") {
            this.update({ exposureCompensationEv: EXPOSURE_VALUES[0] ?? this.settings.exposureCompensationEv });
        }
        else if (key === "End") {
            this.update({ exposureCompensationEv: EXPOSURE_VALUES[EXPOSURE_VALUES.length - 1] ?? this.settings.exposureCompensationEv });
        }
        else {
            this.update({ exposureCompensationEv: nextExposure(this.settings.exposureCompensationEv, key === "ArrowRight" || key === "ArrowUp" ? 1 : -1) });
        }
    }
    handleIsoKey(key) {
        if (key === "Home") {
            this.update({ iso: ISO_VALUES[0] ?? this.settings.iso });
        }
        else if (key === "End") {
            this.update({ iso: ISO_VALUES[ISO_VALUES.length - 1] ?? this.settings.iso });
        }
        else {
            this.update({ iso: nextIso(this.settings.iso, key === "ArrowRight" || key === "ArrowUp" ? 1 : -1) });
        }
    }
    update(patch) {
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
    render() {
        this.renderSubjectButton();
        this.renderLever("focusStyle", this.settings.focusStyle);
        this.renderLever("flashMode", this.settings.flashMode);
        this.renderDial("ev", this.settings.exposureCompensationEv, EV_DIAL);
        this.renderDial("iso", this.settings.iso, ISO_DIAL);
    }
    cycleSubjectMode(direction = 1) {
        const currentIndex = SUBJECT_MODES.indexOf(this.settings.subjectMode);
        const index = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex = (index + direction + SUBJECT_MODES.length) % SUBJECT_MODES.length;
        this.update({ subjectMode: SUBJECT_MODES[nextIndex] ?? DEFAULT_MANUAL_SETTINGS.subjectMode });
    }
    renderSubjectButton() {
        const button = this.root.querySelector("[data-control='subject-cycle']");
        if (!button) {
            return;
        }
        button.dataset.selected = this.settings.subjectMode;
        button.setAttribute("aria-label", `Subject mode: ${subjectModeLabel(this.settings.subjectMode)}. Press to change mode.`);
        button.querySelector("[data-subject-label]")?.replaceChildren(subjectButtonLabel(this.settings.subjectMode));
        this.root.querySelectorAll("[data-subject-icon]").forEach((icon) => {
            const active = icon.dataset.subjectIcon === this.settings.subjectMode;
            icon.hidden = !active;
            icon.classList.toggle("is-active", active);
        });
    }
    renderLever(key, selectedValue) {
        const attr = key === "focusStyle" ? "data-focus-style" : "data-flash-mode";
        const control = this.root.querySelector(key === "focusStyle" ? "[data-control='depth']" : "[data-control='flash']");
        control?.setAttribute("data-selected", selectedValue);
        control?.setAttribute("aria-label", key === "focusStyle"
            ? `Depth selector, ${focusStyleLabel(selectedValue)}`
            : `Flash selector, ${flashLabel(selectedValue)}`);
        this.root.querySelectorAll(`[${attr}]`).forEach((button) => {
            const selected = button.getAttribute(attr) === selectedValue;
            button.classList.toggle("is-selected", selected);
            button.setAttribute("role", "radio");
            button.setAttribute("aria-checked", String(selected));
        });
    }
    renderDial(kind, selectedValue, definition) {
        const dial = this.root.querySelector(`[data-dial='${kind}']`);
        if (!dial) {
            return;
        }
        const angle = valueToAngle(selectedValue, definition.values, definition.minAngle, definition.maxAngle);
        dial.style.setProperty("--rotor-angle", `${angle}deg`);
        dial.setAttribute("aria-valuenow", String(selectedValue));
        dial.setAttribute("aria-valuetext", kind === "ev" ? evLabel(selectedValue) : `ISO ${selectedValue}`);
        dial.setAttribute("aria-label", kind === "ev"
            ? `Exposure compensation dial, ${evLabel(selectedValue)}`
            : `ISO dial, ISO ${selectedValue}`);
        const attr = kind === "ev" ? "data-ev" : "data-iso";
        for (const button of dial.querySelectorAll(`[${attr}]`)) {
            const value = Number(button.getAttribute(attr));
            const selected = definition.values.includes(value) && value === selectedValue;
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        }
    }
}
function dialDefinition(kind) {
    return kind === "ev" ? EV_DIAL : ISO_DIAL;
}
function subjectButtonLabel(mode) {
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
