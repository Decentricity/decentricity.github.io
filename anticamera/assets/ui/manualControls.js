import { EXPOSURE_VALUES, ISO_VALUES, evLabel, flashLabel, focusStyleLabel, freezeManualSettings, loadManualSettings, nextExposure, nextIso, saveManualSettings, snapExposure, snapIso, subjectModeLabel } from "../context/manualSettings.js";
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
        event.preventDefault();
        dial.setPointerCapture(event.pointerId);
        this.updateDialFromPointer(event, dial);
        const move = (moveEvent) => {
            this.updateDialFromPointer(moveEvent, dial);
        };
        const up = (upEvent) => {
            dial.releasePointerCapture(upEvent.pointerId);
            dial.removeEventListener("pointermove", move);
            dial.removeEventListener("pointerup", up);
            dial.removeEventListener("pointercancel", up);
        };
        dial.addEventListener("pointermove", move);
        dial.addEventListener("pointerup", up);
        dial.addEventListener("pointercancel", up);
    }
    updateDialFromPointer(event, dial) {
        const rect = dial.getBoundingClientRect();
        const x = event.clientX - (rect.left + rect.width / 2);
        const y = event.clientY - (rect.top + rect.height / 2);
        const angle = clamp(Math.atan2(y, x) * 180 / Math.PI + 90, -140, 140);
        if (dial.dataset.dial === "ev") {
            const ratio = (clamp(angle, -120, 120) + 120) / 240;
            const value = -3 + ratio * 6;
            this.update({ exposureCompensationEv: snapExposure(value) });
        }
        else {
            const ratio = (clamp(angle, -132, 132) + 132) / 264;
            const index = Math.round(ratio * (ISO_VALUES.length - 1));
            this.update({ iso: ISO_VALUES[index] ?? this.settings.iso });
        }
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
        this.renderDial("ev", this.settings.exposureCompensationEv, EXPOSURE_VALUES, evAngle);
        this.renderDial("iso", this.settings.iso, ISO_VALUES, isoAngle);
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
    renderDial(kind, selectedValue, values, angleForValue) {
        const dial = this.root.querySelector(`[data-dial='${kind}']`);
        const face = dial?.querySelector("[data-dial-face]");
        if (!dial || !face) {
            return;
        }
        const angle = angleForValue(selectedValue);
        face.style.setProperty("--dial-angle", `${-angle}deg`);
        dial.setAttribute("aria-valuenow", String(selectedValue));
        dial.setAttribute("aria-valuetext", kind === "ev" ? evLabel(selectedValue) : `ISO ${selectedValue}`);
        dial.setAttribute("aria-label", kind === "ev"
            ? `Exposure compensation dial, ${evLabel(selectedValue)}`
            : `ISO dial, ISO ${selectedValue}`);
        const attr = kind === "ev" ? "data-ev" : "data-iso";
        for (const button of dial.querySelectorAll(`[${attr}]`)) {
            const value = Number(button.getAttribute(attr));
            const selected = values.includes(value) && value === selectedValue;
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        }
    }
}
function evAngle(value) {
    return value * 40;
}
function isoAngle(value) {
    const index = ISO_VALUES.indexOf(value);
    return -132 + index * 24;
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
