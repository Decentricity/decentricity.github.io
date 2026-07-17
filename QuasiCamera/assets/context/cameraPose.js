const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const STALE_MS = 4_000;
const FRESH_MS = 1_200;
export function emptyCameraPose(capturedAt = Date.now()) {
    return {
        azimuthDeg: null,
        pitchDeg: null,
        rollDeg: null,
        screenOrientationDeg: currentScreenOrientationDeg(),
        confidence: "low",
        capturedAt
    };
}
export function currentScreenOrientationDeg() {
    const orientation = screen.orientation?.angle;
    const legacyOrientation = window.orientation;
    return normalizeSignedScreenAngle(orientation ?? legacyOrientation ?? 0);
}
export function normalizeDeg(value) {
    return ((value % 360) + 360) % 360;
}
export function normalizeSignedDeg(value) {
    const normalized = normalizeDeg(value);
    return normalized > 180 ? normalized - 360 : normalized;
}
export function normalizeSignedScreenAngle(value) {
    const normalized = normalizeDeg(value);
    if (normalized >= 315 || normalized < 45) {
        return 0;
    }
    if (normalized < 135) {
        return 90;
    }
    if (normalized < 225) {
        return 180;
    }
    return 270;
}
export function shortestAngleDeltaDeg(from, to) {
    return normalizeSignedDeg(to - from);
}
export function lerpAngleDeg(from, to, alpha) {
    if (to === null) {
        return from;
    }
    if (from === null) {
        return normalizeDeg(to);
    }
    return normalizeDeg(from + shortestAngleDeltaDeg(from, to) * alpha);
}
export function circularMeanDeg(values) {
    if (!values.length) {
        return null;
    }
    let x = 0;
    let y = 0;
    for (const value of values) {
        x += Math.cos(value * DEG);
        y += Math.sin(value * DEG);
    }
    if (Math.hypot(x, y) < 0.000001) {
        return null;
    }
    return normalizeDeg(Math.atan2(y, x) * RAD);
}
export function cameraPoseFromDeviceOrientation(sample) {
    const hasAngles = sample.alpha !== null && sample.beta !== null && sample.gamma !== null;
    if (!hasAngles) {
        return {
            azimuthDeg: sample.webkitCompassHeading === undefined || sample.webkitCompassHeading === null
                ? null
                : normalizeDeg(sample.webkitCompassHeading),
            pitchDeg: null,
            rollDeg: null,
            screenOrientationDeg: normalizeSignedScreenAngle(sample.screenOrientationDeg),
            confidence: "low",
            capturedAt: sample.capturedAt
        };
    }
    const matrix = orientationMatrix(sample.alpha ?? 0, sample.beta ?? 0, sample.gamma ?? 0);
    // DeviceOrientationEvent describes the device coordinate frame. The lensless
    // prototype is used like the back of a physical camera, so the virtual optical
    // axis points through the rear face of the phone: device -Z.
    const cameraForward = normalizeRequired(mulMatVec(matrix, [0, 0, -1]));
    // The photographic frame's "up" edge depends on screen rotation. This is what
    // prevents landscape rotations from being interpreted as a pitch/roll swap.
    const imageUpDevice = imageUpVectorForScreen(sample.screenOrientationDeg);
    const imageUpWorld = normalizeRequired(mulMatVec(matrix, imageUpDevice));
    const horizontal = Math.hypot(cameraForward[0], cameraForward[1]);
    const derivedAzimuth = horizontal < 0.000001
        ? null
        : normalizeDeg(Math.atan2(cameraForward[0], cameraForward[1]) * RAD);
    const azimuth = sample.webkitCompassHeading === undefined || sample.webkitCompassHeading === null
        ? derivedAzimuth
        : normalizeDeg(sample.webkitCompassHeading);
    const pitch = Math.asin(clamp(cameraForward[2], -1, 1)) * RAD;
    const roll = rollFromWorldVectors(cameraForward, imageUpWorld);
    return {
        azimuthDeg: roundPose(azimuth),
        pitchDeg: roundPose(pitch),
        rollDeg: roundPose(roll),
        screenOrientationDeg: normalizeSignedScreenAngle(sample.screenOrientationDeg),
        confidence: confidenceForPose(azimuth, pitch, roll, sample.capturedAt, sample.capturedAt),
        capturedAt: sample.capturedAt
    };
}
export function smoothCameraPose(previous, next, alpha = 0.24) {
    return {
        azimuthDeg: roundPose(lerpAngleDeg(previous.azimuthDeg, next.azimuthDeg, alpha)),
        pitchDeg: roundPose(lerpNumber(previous.pitchDeg, next.pitchDeg, alpha)),
        rollDeg: roundPose(lerpNumber(previous.rollDeg, next.rollDeg, alpha, normalizeSignedDeg)),
        screenOrientationDeg: next.screenOrientationDeg,
        confidence: next.confidence,
        capturedAt: next.capturedAt
    };
}
export function cameraPoseWithFreshness(pose, now = Date.now()) {
    return {
        ...pose,
        confidence: confidenceForPose(pose.azimuthDeg, pose.pitchDeg, pose.rollDeg, pose.capturedAt, now)
    };
}
export function freezeCameraPose(pose, capturedAt = Date.now()) {
    return {
        ...cameraPoseWithFreshness(pose, capturedAt),
        capturedAt
    };
}
export function aimLabelForPitch(pitchDeg) {
    if (pitchDeg === null) {
        return "Unknown";
    }
    if (pitchDeg <= -70) {
        return "Almost straight down";
    }
    if (pitchDeg <= -35) {
        return "Steeply downward";
    }
    if (pitchDeg <= -12) {
        return "Downward";
    }
    if (pitchDeg < 12) {
        return "Near horizon";
    }
    if (pitchDeg < 35) {
        return "Upward";
    }
    if (pitchDeg < 70) {
        return "Steeply upward";
    }
    return "Almost straight up";
}
export function frameLabelForScreen(screenOrientationDeg) {
    return normalizeSignedScreenAngle(screenOrientationDeg) === 0 || normalizeSignedScreenAngle(screenOrientationDeg) === 180
        ? "Portrait"
        : "Landscape";
}
export function directionLabelForAzimuth(azimuthDeg) {
    if (azimuthDeg === null) {
        return "unknown";
    }
    const directions = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
    const index = Math.round(normalizeDeg(azimuthDeg) / 45) % directions.length;
    return directions[index] ?? "unknown";
}
export function parseDebugPose(search, now = Date.now()) {
    const params = new URLSearchParams(search);
    const raw = params.get("debugPose");
    if (!raw) {
        return {
            enabled: false,
            pose: emptyCameraPose(now)
        };
    }
    const defaults = [237, 38.4, -7.2, 0];
    const values = raw === "1"
        ? defaults
        : defaults.map((fallback, index) => {
            const rawValue = raw.split(",")[index];
            const parsed = rawValue === undefined ? Number.NaN : Number.parseFloat(rawValue.trim());
            return Number.isFinite(parsed) ? parsed : fallback;
        });
    return {
        enabled: true,
        pose: {
            azimuthDeg: normalizeDeg(values[0] ?? defaults[0]),
            pitchDeg: clamp(values[1] ?? defaults[1], -90, 90),
            rollDeg: normalizeSignedDeg(values[2] ?? defaults[2]),
            screenOrientationDeg: normalizeSignedScreenAngle(values[3] ?? defaults[3]),
            confidence: "high",
            capturedAt: now
        }
    };
}
function confidenceForPose(azimuthDeg, pitchDeg, rollDeg, capturedAt, now) {
    if (pitchDeg === null || rollDeg === null) {
        return "low";
    }
    const age = now - capturedAt;
    if (age > STALE_MS) {
        return "low";
    }
    if (age > FRESH_MS || azimuthDeg === null) {
        return "medium";
    }
    return "high";
}
function orientationMatrix(alphaDeg, betaDeg, gammaDeg) {
    const z = alphaDeg * DEG;
    const x = betaDeg * DEG;
    const y = gammaDeg * DEG;
    const cZ = Math.cos(z);
    const sZ = Math.sin(z);
    const cX = Math.cos(x);
    const sX = Math.sin(x);
    const cY = Math.cos(y);
    const sY = Math.sin(y);
    // W3C DeviceOrientation Z-X-Y intrinsic rotation matrix. Rows are world
    // east, north, up; columns are device x, y, z.
    return [
        [cZ * cY - sZ * sX * sY, -cX * sZ, cY * sZ * sX + cZ * sY],
        [cY * sZ + cZ * sX * sY, cZ * cX, sZ * sY - cZ * cY * sX],
        [-cX * sY, sX, cX * cY]
    ];
}
function imageUpVectorForScreen(screenOrientationDeg) {
    switch (normalizeSignedScreenAngle(screenOrientationDeg)) {
        case 90:
            return [1, 0, 0];
        case 180:
            return [0, -1, 0];
        case 270:
            return [-1, 0, 0];
        default:
            return [0, 1, 0];
    }
}
function rollFromWorldVectors(cameraForward, imageUpWorld) {
    const worldUp = [0, 0, 1];
    const projectedWorldUp = subtract(worldUp, scale(cameraForward, dot(worldUp, cameraForward)));
    const levelUp = normalize(projectedWorldUp);
    if (!levelUp) {
        return null;
    }
    // Positive roll means the camera's top edge rotates clockwise as seen by the
    // photographer looking along the optical axis. The generated horizon should
    // preserve the corresponding tilt instead of being automatically leveled.
    return normalizeSignedDeg(Math.atan2(dot(cross(levelUp, imageUpWorld), cameraForward), dot(levelUp, imageUpWorld)) * RAD);
}
function mulMatVec(matrix, vector) {
    return [
        matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
        matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
        matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2]
    ];
}
function normalize(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]);
    if (length < 0.000001) {
        return null;
    }
    return [vector[0] / length, vector[1] / length, vector[2] / length];
}
function normalizeRequired(vector) {
    return normalize(vector) ?? [0, 0, 0];
}
function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function scale(vector, scalar) {
    return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}
function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}
function lerpNumber(from, to, alpha, normalizeValue = (value) => value) {
    if (to === null) {
        return from;
    }
    if (from === null) {
        return normalizeValue(to);
    }
    return normalizeValue(from + (to - from) * alpha);
}
function roundPose(value) {
    return value === null || Number.isNaN(value) ? null : Math.round(value * 10) / 10;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
