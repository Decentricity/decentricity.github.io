import { CONFIDENCE_VALUES, DOMAIN_VALUES, OVERLAY_DENSITY_VALUES, SCAN_MODE_VALUES, VIEW_MODE_VALUES, analysisModeLabel, confidenceLabel, domainLabel, freezeManualSettings, loadManualSettings, nextAnalysisMode, nextConfidenceThreshold, nextDomain, overlayDensityLabel, saveManualSettings, scanModeLabel, snapConfidenceThreshold, viewModeLabel } from "../context/manualSettings.js";
import { advanceDialDrag, beginDialDrag as createDialDragState, pointerAngleDeg, valueToAngle } from "./dialMath.js";
export const DOMAIN_DIAL = {
    values: DOMAIN_VALUES,
    minAngle: -125,
    maxAngle: 125
};
export const CONFIDENCE_DIAL = {
    values: CONFIDENCE_VALUES,
    minAngle: -120,
    maxAngle: 120
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
            if (target instanceof HTMLButtonElement) {
                this.handleButton(target);
            }
        });
        this.root.querySelectorAll("[data-dial]").forEach((dial) => {
            dial.addEventListener("keydown", (event) => this.handleDialKey(event, dial));
            dial.addEventListener("pointerdown", (event) => this.beginDialDrag(event, dial));
        });
        this.root.querySelector("[data-control='analysis-mode-cycle']")?.addEventListener("keydown", (event) => {
            this.handleModeKey(event);
        });
        this.root.querySelectorAll("[data-overlay-density]").forEach((button) => {
            button.addEventListener("keydown", (event) => this.handleOverlayKey(event));
        });
        this.root.querySelectorAll("[data-scan-mode]").forEach((button) => {
            button.addEventListener("keydown", (event) => this.handleScanKey(event));
        });
        this.root.querySelectorAll("[data-view-mode]").forEach((button) => {
            button.addEventListener("keydown", (event) => this.handleViewKey(event));
        });
    }
    handleButton(button) {
        const domain = button.dataset.domain;
        const overlayDensity = button.dataset.overlayDensity;
        const scanMode = button.dataset.scanMode;
        const viewMode = button.dataset.viewMode;
        const confidence = button.dataset.confidence;
        if (button.dataset.control === "analysis-mode-cycle") {
            this.cycleAnalysisMode(1);
        }
        else if (domain) {
            this.update({ domain });
        }
        else if (overlayDensity) {
            this.update({ overlayDensity });
        }
        else if (scanMode) {
            this.update({ scanMode });
        }
        else if (viewMode) {
            this.update({ viewMode });
        }
        else if (button.dataset.relationsVisible !== undefined) {
            this.update({ relationsVisible: button.dataset.relationsVisible === "true" });
        }
        else if (button.dataset.boxesVisible !== undefined) {
            this.update({ boxesVisible: button.dataset.boxesVisible === "true" });
        }
        else if (confidence !== undefined) {
            this.update({ confidenceThreshold: snapConfidenceThreshold(Number(confidence) / 100) });
        }
    }
    handleModeKey(event) {
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            this.cycleAnalysisMode(1);
        }
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            this.cycleAnalysisMode(-1);
        }
    }
    handleOverlayKey(event) {
        if (!this.handleLinearKey(event, OVERLAY_DENSITY_VALUES, this.settings.overlayDensity, (overlayDensity) => this.update({ overlayDensity }))) {
            return;
        }
    }
    handleScanKey(event) {
        this.handleLinearKey(event, SCAN_MODE_VALUES, this.settings.scanMode, (scanMode) => this.update({ scanMode }));
    }
    handleViewKey(event) {
        this.handleLinearKey(event, VIEW_MODE_VALUES, this.settings.viewMode, (viewMode) => this.update({ viewMode }));
    }
    handleLinearKey(event, values, current, update) {
        const handledKeys = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End", "Enter", " "];
        if (!handledKeys.includes(event.key)) {
            return false;
        }
        event.preventDefault();
        if (event.key === "Home") {
            update(values[0] ?? current);
        }
        else if (event.key === "End") {
            update(values[values.length - 1] ?? current);
        }
        else if (event.key === "Enter" || event.key === " ") {
            const index = values.indexOf(current);
            update(values[(index + 1) % values.length] ?? current);
        }
        else {
            const index = values.indexOf(current);
            const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
            update(values[Math.max(0, Math.min(values.length - 1, index + direction))] ?? current);
        }
        return true;
    }
    handleDialKey(event, dial) {
        const kind = dial.dataset.dial;
        if (kind !== "domain" && kind !== "confidence") {
            return;
        }
        const handledKeys = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End"];
        if (!handledKeys.includes(event.key)) {
            return;
        }
        event.preventDefault();
        if (kind === "domain") {
            if (event.key === "Home") {
                this.update({ domain: DOMAIN_VALUES[0] ?? this.settings.domain });
            }
            else if (event.key === "End") {
                this.update({ domain: DOMAIN_VALUES[DOMAIN_VALUES.length - 1] ?? this.settings.domain });
            }
            else {
                this.update({ domain: nextDomain(this.settings.domain, event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1) });
            }
        }
        else if (event.key === "Home") {
            this.update({ confidenceThreshold: CONFIDENCE_VALUES[0] ?? this.settings.confidenceThreshold });
        }
        else if (event.key === "End") {
            this.update({ confidenceThreshold: CONFIDENCE_VALUES[CONFIDENCE_VALUES.length - 1] ?? this.settings.confidenceThreshold });
        }
        else {
            this.update({ confidenceThreshold: nextConfidenceThreshold(this.settings.confidenceThreshold, event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1) });
        }
    }
    beginDialDrag(event, dial) {
        if (event.target instanceof HTMLButtonElement) {
            return;
        }
        const kind = dial.dataset.dial;
        if (kind !== "domain" && kind !== "confidence") {
            return;
        }
        const face = dial.querySelector("[data-dial-face]");
        if (!face) {
            return;
        }
        event.preventDefault();
        this.endActiveDrag();
        const definition = dialDefinition(kind);
        const currentAngle = valueToAngle(kind === "domain" ? this.settings.domain : this.settings.confidenceThreshold, definition.values, definition.minAngle, definition.maxAngle);
        const pointerAngle = pointerAngleDeg(event.clientX, event.clientY, face.getBoundingClientRect());
        let dragState = createDialDragState(currentAngle, pointerAngle);
        dial.setPointerCapture(event.pointerId);
        this.activeDrag = { pointerId: event.pointerId, dial, state: dragState };
        const move = (moveEvent) => {
            if (!this.activeDrag || moveEvent.pointerId !== event.pointerId) {
                return;
            }
            moveEvent.preventDefault();
            const nextPointerAngle = pointerAngleDeg(moveEvent.clientX, moveEvent.clientY, face.getBoundingClientRect());
            const next = advanceDialDrag(dragState, nextPointerAngle, definition);
            dragState = next.state;
            this.activeDrag.state = dragState;
            if (kind === "domain" && next.value !== this.settings.domain) {
                this.update({ domain: next.value });
            }
            else if (kind === "confidence" && next.value !== this.settings.confidenceThreshold) {
                this.update({ confidenceThreshold: next.value });
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
    update(patch) {
        this.settings = freezeManualSettings({ ...this.settings, ...patch });
        saveManualSettings(this.settings);
        this.render();
        for (const listener of this.listeners) {
            listener(this.currentSettings());
        }
    }
    render() {
        this.renderDial("domain", this.settings.domain, DOMAIN_DIAL);
        this.renderDial("confidence", this.settings.confidenceThreshold, CONFIDENCE_DIAL);
        this.renderSelector("overlayDensity", this.settings.overlayDensity, "overlay-density", overlayDensityLabel);
        this.renderSelector("scanMode", this.settings.scanMode, "scan-mode", scanModeLabel);
        this.renderSelector("viewMode", this.settings.viewMode, "view-mode", viewModeLabel);
        this.renderSwitch("relationsVisible", this.settings.relationsVisible, "relations-visible", "REL");
        this.renderSwitch("boxesVisible", this.settings.boxesVisible, "boxes-visible", "BOX");
        this.renderAnalysisButton();
    }
    cycleAnalysisMode(direction = 1) {
        this.update({ analysisMode: nextAnalysisMode(this.settings.analysisMode, direction) });
    }
    renderAnalysisButton() {
        const button = this.root.querySelector("[data-control='analysis-mode-cycle']");
        if (!button) {
            return;
        }
        button.dataset.selected = this.settings.analysisMode;
        button.setAttribute("aria-label", `Analysis mode: ${analysisModeLabel(this.settings.analysisMode)}. Press to change mode.`);
        button.querySelector("[data-analysis-label]")?.replaceChildren(analysisModeButtonLabel(this.settings.analysisMode));
        this.root.querySelectorAll("[data-analysis-icon]").forEach((icon) => {
            const active = icon.dataset.analysisIcon === this.settings.analysisMode;
            icon.hidden = !active;
            icon.classList.toggle("is-active", active);
        });
    }
    renderSelector(key, selectedValue, dataName, label) {
        const control = this.root.querySelector(`[data-control='${dataName}']`);
        control?.setAttribute("data-selected", selectedValue);
        control?.style.setProperty(`--${dataName}-index`, String([...control.querySelectorAll("button")].findIndex((button) => button.getAttribute(`data-${dataName}`) === selectedValue)));
        control?.setAttribute("aria-label", `${dataName.replace("-", " ")} selector, ${label(selectedValue)}`);
        this.root.querySelectorAll(`[data-${dataName}]`).forEach((button) => {
            const value = button.getAttribute(`data-${dataName}`);
            const selected = value === selectedValue;
            button.classList.toggle("is-selected", selected);
            button.setAttribute("role", "radio");
            button.setAttribute("aria-checked", String(selected));
            button.setAttribute("aria-label", `Set ${String(key)} to ${label(value)}`);
        });
    }
    renderSwitch(key, selectedValue, dataName, label) {
        const control = this.root.querySelector(`[data-control='${dataName}']`);
        control?.setAttribute("data-selected", selectedValue ? "on" : "off");
        control?.setAttribute("aria-label", `${label} switch, ${selectedValue ? "ON" : "OFF"}`);
        this.root.querySelectorAll(`[data-${dataName}]`).forEach((button) => {
            const selected = button.getAttribute(`data-${dataName}`) === String(selectedValue);
            button.classList.toggle("is-selected", selected);
            button.setAttribute("role", "radio");
            button.setAttribute("aria-checked", String(selected));
            button.setAttribute("aria-label", `Set ${label} ${button.textContent?.trim() ?? ""}`);
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
        dial.setAttribute("aria-valuetext", kind === "domain" ? domainLabel(selectedValue) : `${confidenceLabel(selectedValue)} percent`);
        dial.setAttribute("aria-label", kind === "domain"
            ? `Lens domain dial, ${domainLabel(selectedValue)}`
            : `Confidence threshold dial, ${confidenceLabel(selectedValue)} percent`);
        const attr = kind === "domain" ? "data-domain" : "data-confidence";
        for (const button of dial.querySelectorAll(`[${attr}]`)) {
            const raw = button.getAttribute(attr);
            const value = kind === "confidence" ? snapConfidenceThreshold(Number(raw) / 100) : raw;
            const selected = value === selectedValue;
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        }
    }
}
function dialDefinition(kind) {
    return kind === "domain" ? DOMAIN_DIAL : CONFIDENCE_DIAL;
}
function analysisModeButtonLabel(mode) {
    return mode.toUpperCase();
}
