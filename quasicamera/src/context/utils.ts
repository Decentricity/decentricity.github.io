export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number | undefined | null, places = 0): number | undefined {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return undefined;
  }

  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

export function compactLabel(parts: Array<string | undefined | null>): string {
  return parts.filter(Boolean).join(", ");
}

export function formatDegrees(value: number | undefined | null): string {
  return value === undefined || value === null || Number.isNaN(value) ? "--" : `${Math.round(value)} deg`;
}

export function safeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

