export interface DialDefinition<T extends number> {
  values: readonly T[];
  minAngle: number;
  maxAngle: number;
}

export interface DialDragState {
  previousPointerAngle: number;
  rawDialAngle: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Dial angle convention:
// 0 degrees = twelve o'clock, 90 degrees = three o'clock,
// 180 degrees = six o'clock, 270 degrees = nine o'clock.
// Positive rotation is clockwise.
export function pointerAngleDeg(clientX: number, clientY: number, rect: RectLike): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  return normalizeDegrees(Math.atan2(dx, -dy) * 180 / Math.PI);
}

export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function shortestAngleDelta(fromDeg: number, toDeg: number): number {
  return ((toDeg - fromDeg + 540) % 360) - 180;
}

export function valueIndexToAngle(index: number, count: number, minAngle: number, maxAngle: number): number {
  if (count <= 1) {
    return minAngle;
  }

  const clampedIndex = Math.max(0, Math.min(count - 1, index));
  return minAngle + (clampedIndex / (count - 1)) * (maxAngle - minAngle);
}

export function angleToNearestIndex(angle: number, count: number, minAngle: number, maxAngle: number): number {
  if (count <= 1) {
    return 0;
  }

  const clampedAngle = clamp(angle, minAngle, maxAngle);
  const ratio = (clampedAngle - minAngle) / (maxAngle - minAngle);
  return Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1))));
}

export function valueToAngle<T extends number>(value: T, values: readonly T[], minAngle: number, maxAngle: number): number {
  const index = Math.max(0, values.indexOf(value));
  return valueIndexToAngle(index, values.length, minAngle, maxAngle);
}

export function angleToNearestValue<T extends number>(angle: number, definition: DialDefinition<T>): T {
  const index = angleToNearestIndex(angle, definition.values.length, definition.minAngle, definition.maxAngle);
  return definition.values[index] ?? definition.values[0] as T;
}

export function beginDialDrag(currentAngle: number, pointerAngle: number): DialDragState {
  return {
    previousPointerAngle: pointerAngle,
    rawDialAngle: currentAngle
  };
}

export function advanceDialDrag<T extends number>(
  state: DialDragState,
  pointerAngle: number,
  definition: DialDefinition<T>
): { state: DialDragState; value: T; angle: number } {
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

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
