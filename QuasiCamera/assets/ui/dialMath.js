// Dial angle convention:
// 0 degrees = twelve o'clock, 90 degrees = three o'clock,
// 180 degrees = six o'clock, 270 degrees = nine o'clock.
// Positive rotation is clockwise.
export function pointerAngleDeg(clientX, clientY, rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    return normalizeDegrees(Math.atan2(dx, -dy) * 180 / Math.PI);
}
export function normalizeDegrees(value) {
    return ((value % 360) + 360) % 360;
}
export function shortestAngleDelta(fromDeg, toDeg) {
    return ((toDeg - fromDeg + 540) % 360) - 180;
}
export function valueIndexToAngle(index, count, minAngle, maxAngle) {
    if (count <= 1) {
        return minAngle;
    }
    const clampedIndex = Math.max(0, Math.min(count - 1, index));
    return minAngle + (clampedIndex / (count - 1)) * (maxAngle - minAngle);
}
export function angleToNearestIndex(angle, count, minAngle, maxAngle) {
    if (count <= 1) {
        return 0;
    }
    const clampedAngle = clamp(angle, minAngle, maxAngle);
    const ratio = (clampedAngle - minAngle) / (maxAngle - minAngle);
    return Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1))));
}
export function valueToAngle(value, values, minAngle, maxAngle) {
    const index = Math.max(0, values.indexOf(value));
    return valueIndexToAngle(index, values.length, minAngle, maxAngle);
}
export function angleToNearestValue(angle, definition) {
    const index = angleToNearestIndex(angle, definition.values.length, definition.minAngle, definition.maxAngle);
    return definition.values[index] ?? definition.values[0];
}
export function beginDialDrag(currentAngle, pointerAngle) {
    return {
        previousPointerAngle: pointerAngle,
        rawDialAngle: currentAngle
    };
}
export function advanceDialDrag(state, pointerAngle, definition) {
    const delta = shortestAngleDelta(state.previousPointerAngle, pointerAngle);
    const rawDialAngle = clamp(state.rawDialAngle + delta, definition.minAngle, definition.maxAngle);
    const value = angleToNearestValue(rawDialAngle, definition);
    const angle = valueToAngle(value, definition.values, definition.minAngle, definition.maxAngle);
    return {
        state: {
            previousPointerAngle: pointerAngle,
            rawDialAngle
        },
        value,
        angle
    };
}
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
