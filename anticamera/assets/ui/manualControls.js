import { EXPOSURE_VALUES, ISO_VALUES, evLabel, flashLabel, focusStyleLabel, freezeManualSettings, loadManualSettings, nextExposure, nextIso, saveManualSettings, snapExposure, snapIso, subjectModeLabel } from "../context/manualSettings.js";
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
const SUBJECT_ANGLES = {
    landscape: 0,
    "single-person": 90,
    group: 180,
    crowd: 270
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
    }
    handleButton(button) {
        const focusStyle = button.dataset.focusStyle;
        const flashMode = button.dataset.flashMode;
        const subjectMode = button.dataset.subjectMode;
        const ev = button.dataset.ev;
        const iso = button.dataset.iso;
        if (focusStyle) {
            this.update({ focusStyle });
        }
        else if (flashMode) {
            this.update({ flashMode });
        }
        else if (subjectMode) {
            this.update({ subjectMode });
        }
        else if (ev !== undefined) {
            this.update({ exposureCompensationEv: snapExposure(Number(ev)) });
        }
        else if (iso !== undefined) {
            this.update({ iso: snapIso(Number(iso)) });
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
        this.renderSubjectDial();
        this.renderLever("focusStyle", this.settings.focusStyle);
        this.renderLever("flashMode", this.settings.flashMode);
        this.renderDial("ev", this.settings.exposureCompensationEv, EV_DIAL);
        this.renderDial("iso", this.settings.iso, ISO_DIAL);
    }
    renderSubjectDial() {
        const dial = this.root.querySelector("[data-control='subject']");
        if (!dial) {
            return;
        }
        dial.style.setProperty("--mode-angle", `${SUBJECT_ANGLES[this.settings.subjectMode]}deg`);
        dial.setAttribute("aria-label", `Subject mode dial, ${subjectModeLabel(this.settings.subjectMode)}`);
        this.root.querySelectorAll("[data-subject-mode]").forEach((button) => {
            const selected = button.dataset.subjectMode === this.settings.subjectMode;
            button.classList.toggle("is-selected", selected);
            button.setAttribute("role", "radio");
            button.setAttribute("aria-checked", String(selected));
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
