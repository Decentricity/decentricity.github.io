import { aimLabelForPitch, directionLabelForAzimuth, frameLabelForScreen } from "./context/cameraPose.js";
function value(label, detail) {
    if (detail === undefined || detail === null || detail === "") {
        return `${label}: unknown`;
    }
    return `${label}: ${detail}`;
}
export class PromptBuilder {
    virtualLensMm;
    constructor(virtualLensMm = 22) {
        this.virtualLensMm = virtualLensMm;
    }
    build(context) {
        const location = context.location;
        const weather = context.weather;
        const audio = context.audio;
        const motion = context.motion;
        const device = context.device;
        const pose = context.cameraPose;
        const lines = [
            "You are Anti-Camera, a lensless camera that records context rather than light.",
            "Imagine what could plausibly exist at this place and time from contextual clues only.",
            "Do not claim to recreate reality. Do not include fantasy, surrealism, illustration, painting, CGI, or visible AI artifacts.",
            "Make the result look like a realistic compact point-and-shoot photograph on instant film.",
            "Use ordinary photographic imperfections: available light, weather haze, flash falloff, slight handheld framing, natural grain.",
            "",
            "CAMERA POSE -- STRICT COMPOSITIONAL CONSTRAINT",
            poseLine("The virtual camera is facing azimuth", pose.azimuthDeg, directionLabelForAzimuth(pose.azimuthDeg), false),
            poseLine("Its optical axis is pitched", pose.pitchDeg, "relative to the local horizon", true),
            rollLine(pose.rollDeg),
            `The device is held in ${frameLabelForScreen(pose.screenOrientationDeg).toLowerCase()} orientation.`,
            `Pose sensor confidence: ${pose.confidence}.`,
            "",
            "Render the scene exactly from this camera pose.",
            "Do not silently level the horizon.",
            "Do not substitute an eye-level viewpoint.",
            "Do not create a generic frontal composition.",
            "Do not show scenery that would lie outside this field of view.",
            `Simulate a ${this.virtualLensMm} mm full-frame-equivalent rectilinear lens.`,
            "Maintain realistic wide-angle perspective.",
            "Do not use fisheye distortion.",
            "",
            ...poseCompositionRules(context),
            "",
            "Context captured at shutter press:",
            value("Local date", context.time.date),
            value("Local time", context.time.time),
            value("Timezone", context.time.timezone),
            value("Day period", context.time.dayPeriod),
            value("Indoor/outdoor switch", context.mode),
            value("Location label", location.label),
            value("Latitude", location.latitude),
            value("Longitude", location.longitude),
            value("GPS accuracy meters", location.accuracy),
            value("Weather", weather.description),
            value("Temperature C", weather.temperatureC),
            value("Humidity percent", weather.humidityPercent),
            value("Cloud cover percent", weather.cloudCoverPercent),
            value("Rain mm", weather.rainMm),
            value("Wind kph", weather.windKph),
            value("Camera azimuth degrees", pose.azimuthDeg),
            value("Camera pitch degrees", pose.pitchDeg),
            value("Camera roll degrees", pose.rollDeg),
            value("Screen orientation degrees", pose.screenOrientationDeg),
            value("Camera aim", aimLabelForPitch(pose.pitchDeg)),
            value("Movement", motion.movement),
            value("Acceleration magnitude", motion.accelerationMagnitude),
            value("Ambient audio", audio.descriptor),
            value("Average volume", audio.averageVolume),
            value("Noisiness", audio.noisiness),
            value("Speech probability", audio.speechProbability),
            value("Device type", device.deviceType),
            value("Viewport", `${device.viewport.width}x${device.viewport.height} ${device.viewport.orientation}`),
            value("Language", device.language),
            "",
            "Use azimuth together with location context only as geometry. The camera faces approximately "
                + `${directionLabelForAzimuth(pose.azimuthDeg)} from the supplied coordinates. `
                + "Do not invent or assert that a specific landmark is visible unless it is supplied by reliable context.",
            "",
            "Compose one plausible photograph from these facts. No captions, no interface, no text overlay."
        ];
        return lines.join("\n");
    }
}
function poseLine(label, valueDeg, suffix, alwaysSign) {
    if (valueDeg === null) {
        return `${label}: unknown.`;
    }
    return `${label} ${formatSigned(valueDeg, alwaysSign)} degrees ${suffix}.`;
}
function rollLine(rollDeg) {
    if (rollDeg === null) {
        return "Camera roll is unknown; if horizon cues are present, do not force an artificially level generic composition.";
    }
    return `The camera is rolled ${formatSigned(rollDeg, true)} degrees, producing a horizon tilted by approximately ${Math.abs(rollDeg).toFixed(1)} degrees.`;
}
function poseCompositionRules(context) {
    const pitch = context.cameraPose.pitchDeg;
    const roll = context.cameraPose.rollDeg;
    const frame = frameLabelForScreen(context.cameraPose.screenOrientationDeg).toLowerCase();
    const rules = [
        "POSE-SPECIFIC FRAMING RULES",
        `Compose natively for a ${frame} photographic frame; do not generate a different orientation and crop it afterward.`
    ];
    if (pitch === null) {
        rules.push("Pitch is unavailable, so keep camera height and viewpoint plausible without defaulting to a centered eye-level postcard view.");
    }
    else if (pitch >= 70) {
        rules.push("The optical axis points almost vertically upward. The center of the frame must depict what is overhead.");
        rules.push("The ground must not appear except possibly at extreme frame edges due to the wide field of view.");
    }
    else if (pitch >= 35) {
        rules.push("Because the camera is pitched steeply upward, the image should contain substantially more sky, ceiling, treetops, upper floors, signage, or overhead structure than ground.");
        rules.push("Place the local horizon well below the vertical center of the frame or outside the frame.");
    }
    else if (pitch >= 12) {
        rules.push("Because the camera is pitched upward, place the local horizon below the vertical center of the frame.");
        rules.push("Favor upper facades, treetops, ceiling, sky, hanging signs, elevated objects, or overhead structure.");
    }
    else if (pitch > -12) {
        rules.push("The optical axis is near the horizon. Keep a natural horizon-height composition consistent with a handheld point-and-shoot.");
    }
    else if (pitch > -35) {
        rules.push("Because the camera is pitched downward, place the local horizon above the vertical center of the frame.");
        rules.push("Favor pavement, floor, tabletops, nearby objects, lower architectural details, or feet-level surfaces.");
    }
    else if (pitch > -70) {
        rules.push("Because the camera is pitched steeply downward, the image should contain substantially more ground, floor, tabletop, pavement, or near-field surfaces than sky or ceiling.");
        rules.push("Place the local horizon high in the frame or outside the frame.");
    }
    else {
        rules.push("The optical axis points almost vertically downward. The center of the frame must depict the ground, floor, feet-level objects, or surfaces beneath the camera.");
        rules.push("The sky and distant horizon must not appear.");
    }
    if (roll !== null) {
        rules.push(`Preserve an approximately ${formatSigned(roll, true)} degree camera roll. Vertical structures and the horizon should rotate consistently with the camera.`);
        rules.push("Do not automatically straighten the image.");
    }
    return rules;
}
function formatSigned(value, alwaysSign) {
    const sign = value >= 0 && alwaysSign ? "+" : "";
    return `${sign}${value.toFixed(1)}`;
}
