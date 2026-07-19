export const EXPOSURE_VALUES = [-3, -2, -1, 0, 1, 2, 3];
export const ISO_VALUES = [80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000];
export const SUBJECT_MODES = ["landscape", "single-person", "group", "crowd"];
export const FOCUS_STYLES = ["deep-focus", "bokeh"];
export const FLASH_MODES = ["off", "on"];
export const FOCAL_DISTANCE_VALUES = ["21mm", "28mm", "35mm", "50mm", "80mm", "telephoto", "macro"];
export const GROUNDING_MODES = ["grounded", "free"];
export const DEFAULT_MANUAL_SETTINGS = {
    focusStyle: "deep-focus",
    exposureCompensationEv: 0,
    subjectMode: "landscape",
    flashMode: "off",
    iso: 200,
    focalDistance: "21mm",
    groundingMode: "grounded"
};
const STORAGE_KEY = "quasicamera.manualSettings.v1";
export function loadManualSettings(storage = localStorage) {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
        return { ...DEFAULT_MANUAL_SETTINGS };
    }
    try {
        return sanitizeManualSettings(JSON.parse(raw));
    }
    catch {
        return { ...DEFAULT_MANUAL_SETTINGS };
    }
}
export function saveManualSettings(settings, storage = localStorage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeManualSettings(settings)));
}
export function sanitizeManualSettings(candidate = {}) {
    return {
        focusStyle: isOneOf(candidate.focusStyle, FOCUS_STYLES) ? candidate.focusStyle : DEFAULT_MANUAL_SETTINGS.focusStyle,
        exposureCompensationEv: isOneOf(candidate.exposureCompensationEv, EXPOSURE_VALUES)
            ? candidate.exposureCompensationEv
            : DEFAULT_MANUAL_SETTINGS.exposureCompensationEv,
        subjectMode: isOneOf(candidate.subjectMode, SUBJECT_MODES) ? candidate.subjectMode : DEFAULT_MANUAL_SETTINGS.subjectMode,
        flashMode: isOneOf(candidate.flashMode, FLASH_MODES) ? candidate.flashMode : DEFAULT_MANUAL_SETTINGS.flashMode,
        iso: isOneOf(candidate.iso, ISO_VALUES) ? candidate.iso : DEFAULT_MANUAL_SETTINGS.iso,
        focalDistance: isOneOf(candidate.focalDistance, FOCAL_DISTANCE_VALUES)
            ? candidate.focalDistance
            : DEFAULT_MANUAL_SETTINGS.focalDistance,
        groundingMode: isOneOf(candidate.groundingMode, GROUNDING_MODES)
            ? candidate.groundingMode
            : DEFAULT_MANUAL_SETTINGS.groundingMode
    };
}
export function freezeManualSettings(settings) {
    return { ...sanitizeManualSettings(settings) };
}
export function snapExposure(value) {
    return nearestDetent(value, EXPOSURE_VALUES);
}
export function snapIso(value) {
    return nearestDetent(value, ISO_VALUES);
}
export function nextExposure(current, delta) {
    return nextDetent(current, EXPOSURE_VALUES, delta);
}
export function nextIso(current, delta) {
    return nextDetent(current, ISO_VALUES, delta);
}
export function nextFocalDistance(current, delta) {
    return nextDetent(current, FOCAL_DISTANCE_VALUES, delta);
}
export function nextGroundingMode(current, delta) {
    return nextDetent(current, GROUNDING_MODES, delta);
}
export function subjectModeLabel(mode) {
    switch (mode) {
        case "single-person":
            return "1 PERSON";
        case "group":
            return "GROUP";
        case "crowd":
            return "CROWD";
        case "landscape":
        default:
            return "LANDSCAPE";
    }
}
export function subjectModeShort(mode) {
    switch (mode) {
        case "single-person":
            return "P1";
        case "group":
            return "P3";
        case "crowd":
            return "CRWD";
        case "landscape":
        default:
            return "LAND";
    }
}
export function focusStyleLabel(style) {
    return style === "bokeh" ? "BOKEH" : "DEEP";
}
export function focusStyleShort(style) {
    return style === "bokeh" ? "BKH" : "DF";
}
export function evLabel(value) {
    return `${value > 0 ? "+" : ""}${value}EV`;
}
export function flashLabel(value) {
    return value === "on" ? "ON" : "OFF";
}
export function focalDistanceLabel(value) {
    switch (value) {
        case "telephoto":
            return "TELEPHOTO";
        case "macro":
            return "MACRO";
        default:
            return value.toUpperCase();
    }
}
export function focalDistanceShort(value) {
    switch (value) {
        case "telephoto":
            return "TEL";
        case "macro":
            return "MAC";
        default:
            return `F${value.replace("mm", "")}`;
    }
}
export function groundingModeLabel(value) {
    return value === "free" ? "FREE" : "GROUNDED";
}
export function groundingModeShort(value) {
    return value === "free" ? "FREE" : "GRND";
}
export function focalDistanceEquivalentMm(value) {
    switch (value) {
        case "28mm":
            return 28;
        case "35mm":
            return 35;
        case "50mm":
            return 50;
        case "80mm":
            return 80;
        case "telephoto":
            return 135;
        case "macro":
            return 60;
        case "21mm":
        default:
            return 21;
    }
}
export function focalDistancePromptLabel(value) {
    switch (value) {
        case "telephoto":
            return "telephoto equivalent, approximately 135 mm full-frame equivalent";
        case "macro":
            return "macro close-focus lens mode, approximately 60 mm full-frame equivalent";
        default:
            return `${focalDistanceEquivalentMm(value)} mm full-frame equivalent`;
    }
}
export function settingsReadout(settings) {
    const normalized = sanitizeManualSettings(settings);
    return [
        subjectModeShort(normalized.subjectMode),
        focusStyleShort(normalized.focusStyle),
        focalDistanceShort(normalized.focalDistance),
        groundingModeShort(normalized.groundingMode),
        evLabel(normalized.exposureCompensationEv),
        `FL-${flashLabel(normalized.flashMode)}`,
        `ISO${normalized.iso}`
    ].join(" ");
}
function nearestDetent(value, detents) {
    let closest = detents[0];
    let distance = Math.abs(value - closest);
    for (const detent of detents) {
        const nextDistance = Math.abs(value - detent);
        if (nextDistance < distance) {
            closest = detent;
            distance = nextDistance;
        }
    }
    return closest;
}
function nextDetent(current, detents, delta) {
    const index = detents.indexOf(current);
    const nextIndex = Math.max(0, Math.min(detents.length - 1, index + delta));
    return detents[nextIndex] ?? current;
}
function isOneOf(value, allowed) {
    return allowed.includes(value);
}
