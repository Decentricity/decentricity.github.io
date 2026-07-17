export function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
}
export function round(value, places = 0) {
    if (value === undefined || value === null || Number.isNaN(value)) {
        return undefined;
    }
    const scale = 10 ** places;
    return Math.round(value * scale) / scale;
}
export function compactLabel(parts) {
    return parts.filter(Boolean).join(", ");
}
export function formatDegrees(value) {
    return value === undefined || value === null || Number.isNaN(value) ? "--" : `${Math.round(value)} deg`;
}
export function safeError(error) {
    return error instanceof Error ? error.message : String(error);
}
