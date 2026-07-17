import { aimLabelForPitch, directionLabelForAzimuth, frameLabelForScreen } from "./context/cameraPose.js";
import { evLabel, flashLabel, focusStyleLabel, subjectModeLabel } from "./context/manualSettings.js";
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
        const settings = context.manualSettings;
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
            value("Subject mode", subjectModeLabel(settings.subjectMode)),
            value("Depth style", focusStyleLabel(settings.focusStyle)),
            value("Exposure compensation", evLabel(settings.exposureCompensationEv)),
            value("Flash", flashLabel(settings.flashMode)),
            value("Film speed ISO", settings.iso),
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
            "MANUAL CAMERA SETTINGS -- STRICT PHOTOGRAPHIC CONSTRAINTS",
            `Subject mode: ${subjectModeLabel(settings.subjectMode).toLowerCase()}.`,
            `Depth style: ${settings.focusStyle === "bokeh" ? "shallow depth of field / bokeh" : "broad depth of field / deep focus"}.`,
            `Exposure compensation: ${evLabel(settings.exposureCompensationEv)}.`,
            `Flash: ${settings.flashMode}.`,
            `Film speed: ISO ${settings.iso}.`,
            `Virtual lens: ${this.virtualLensMm} mm full-frame equivalent.`,
            "Treat these as physical camera settings, not as loose aesthetic suggestions.",
            "Apply them together coherently.",
            "Do not contradict the supplied camera pitch, roll, heading, location, weather, time, or indoor/outdoor context.",
            "",
            ...manualSettingRules(context, this.virtualLensMm),
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
function manualSettingRules(context, lensMm) {
    return [
        ...subjectPriorityRules(context),
        "",
        ...depthOfFieldRules(context, lensMm),
        "",
        ...exposureRules(context),
        "",
        ...flashRules(context),
        "",
        ...filmSpeedRules(context),
        "",
        ...manualInteractionRules(context, lensMm)
    ];
}
function subjectPriorityRules(context) {
    switch (context.manualSettings.subjectMode) {
        case "single-person":
            return [
                "SUBJECT PRIORITY: ONE PERSON",
                "The user selected one-person mode. Imagine a plausible photograph centered on one principal human subject consistent with the contextual clues.",
                "Use the available location, direction, audio, weather, time, and environmental context to determine a believable candid situation.",
                "Do not create a formal studio portrait unless the context supports one.",
                "Do not fabricate a recognizable real individual."
            ];
        case "group":
            return [
                "SUBJECT PRIORITY: SMALL GROUP",
                "The user selected small-group mode. Imagine a plausible photograph featuring roughly two to five principal people consistent with the contextual clues.",
                "Compose them as a coherent group rather than unrelated background pedestrians.",
                "Keep body scale, interaction, and spatial placement natural."
            ];
        case "crowd":
            return [
                "SUBJECT PRIORITY: CROWD",
                "The user selected crowd mode. Imagine a plausible crowded photograph consistent with the contextual clues.",
                "The crowd should meaningfully shape the composition and density of the scene.",
                "Avoid cloned faces, repeated bodies, duplicated clothing patterns, or impossible overlaps.",
                "Subject mode is creative direction, not evidence that a crowd was detected."
            ];
        case "landscape":
        default:
            return [
                "SUBJECT PRIORITY: LANDSCAPE / ENVIRONMENT",
                "The environment is the principal subject.",
                "Favor geography, architecture, streetscape, weather, spatial depth, or the surrounding interior.",
                "People may appear naturally but should not dominate unless unavoidable from contextual evidence."
            ];
    }
}
function depthOfFieldRules(context, lensMm) {
    const mode = context.manualSettings.subjectMode;
    if (context.manualSettings.focusStyle === "bokeh") {
        const rules = [
            "DEPTH OF FIELD -- STRICT PHOTOGRAPHIC CONSTRAINT",
            "Use shallow depth of field with a clearly defined focal plane.",
            "Keep the principal subject optically sharp.",
            "Render foreground and/or background elements progressively out of focus according to plausible lens geometry.",
            "Produce natural optical bokeh, not uniform Gaussian blur and not a software portrait-mode cutout.",
            `A ${lensMm} mm lens naturally has deep depth of field, so strong bokeh requires close subject distance and must remain optically believable.`
        ];
        if (mode === "single-person") {
            rules.push("For one-person mode, favor focus on the person with plausible background separation.");
        }
        else if (mode === "group") {
            rules.push("For small-group mode, retain enough depth to keep all intended people sharp.");
        }
        else if (mode === "crowd") {
            rules.push("For crowd mode, avoid an impossibly thin focal plane that makes nearly everyone unusably blurred.");
        }
        else {
            rules.push("For landscape mode, allow foreground-detail focus or deliberate miniature-like depth only if photographically plausible; do not default to portrait bokeh.");
        }
        return rules;
    }
    return [
        "DEPTH OF FIELD -- STRICT PHOTOGRAPHIC CONSTRAINT",
        "Use broad depth of field.",
        "Keep foreground, middle distance, and background reasonably legible where lighting permits.",
        "Do not introduce conspicuous portrait-style background blur."
    ];
}
function exposureRules(context) {
    const ev = context.manualSettings.exposureCompensationEv;
    if (ev === -3) {
        return [
            "EXPOSURE COMPENSATION",
            "Apply -3 EV relative to the model's neutral exposure.",
            "The photograph should be substantially underexposed, with very dark midtones and heavily reduced shadow detail.",
            "Do not reinterpret this as nighttime unless the other context indicates night."
        ];
    }
    if (ev === -2) {
        return [
            "EXPOSURE COMPENSATION",
            "Apply -2 EV relative to neutral exposure.",
            "The photograph should be visibly underexposed, with darker midtones and reduced shadow detail.",
            "Do not reinterpret this as nighttime unless the other context indicates night."
        ];
    }
    if (ev === -1) {
        return [
            "EXPOSURE COMPENSATION",
            "Apply -1 EV relative to neutral exposure.",
            "The photograph should be slightly dark, with restrained midtones and somewhat deeper shadows."
        ];
    }
    if (ev === 1) {
        return [
            "EXPOSURE COMPENSATION",
            "Apply +1 EV relative to neutral exposure.",
            "The photograph should be slightly bright, with lifted midtones while preserving plausible highlights."
        ];
    }
    if (ev === 2) {
        return [
            "EXPOSURE COMPENSATION",
            "Apply +2 EV relative to the model's neutral exposure.",
            "The photograph should be visibly brighter, with lifted midtones and plausible highlight clipping.",
            "Do not merely make the scene sunnier or change the time of day."
        ];
    }
    if (ev === 3) {
        return [
            "EXPOSURE COMPENSATION",
            "Apply +3 EV relative to neutral exposure.",
            "The photograph should be substantially overexposed, with bright midtones and stronger plausible highlight clipping.",
            "Do not merely make the scene sunnier or change the time of day."
        ];
    }
    return [
        "EXPOSURE COMPENSATION",
        "Apply 0 EV relative to neutral exposure.",
        "Use a neutral exposure consistent with the supplied time, weather, flash, ISO, movement, and indoor/outdoor context."
    ];
}
function flashRules(context) {
    if (context.manualSettings.flashMode === "off") {
        return [
            "FLASH: OFF",
            "Use only plausible ambient illumination.",
            "Do not introduce direct on-camera flash characteristics."
        ];
    }
    const rules = [
        "FLASH: ON -- DIRECT COMPACT-CAMERA FLASH",
        "Simulate a small direct flash mounted close to the lens axis.",
        "Use a relatively hard frontal burst with rapid falloff.",
        "Nearby subjects may be bright while the background remains darker.",
        "Allow characteristic compact-camera effects where contextually appropriate: sharp-edged shadows behind nearby subjects, specular highlights, reflective surfaces catching the flash, slight red-eye risk, darker distant background, and frozen nearby motion.",
        "Do not turn the entire environment into evenly lit daylight."
    ];
    if (context.mode === "outdoor" && context.time.dayPeriod !== "night") {
        rules.push("Outdoors in bright daylight, flash acts as modest fill flash, not a dominant night flash.");
    }
    if (context.mode === "indoor" || context.time.dayPeriod === "night") {
        rules.push("Indoors or at night, direct-flash character may be pronounced.");
    }
    if (context.manualSettings.subjectMode === "landscape") {
        rules.push("Landscape mode with distant scenery: the tiny flash should have little or no effect on distant objects.");
    }
    if (context.manualSettings.subjectMode === "crowd") {
        rules.push("Crowd mode: avoid lighting an entire large crowd uniformly from a tiny flash.");
    }
    return rules;
}
function filmSpeedRules(context) {
    const iso = context.manualSettings.iso;
    if (iso <= 160) {
        return [
            `FILM SPEED: ISO ${iso}`,
            "Simulate slow fine-grained color film.",
            "Use fine grain, cleaner tonal transitions, and lower apparent sensitivity.",
            "In weak light, preserve the possibility of darker exposure or motion blur unless flash or other context compensates."
        ];
    }
    if (iso <= 400) {
        return [
            `FILM SPEED: ISO ${iso}`,
            "Simulate general-purpose consumer color film.",
            "Use moderate fine-to-medium grain and balanced sensitivity."
        ];
    }
    return [
        `FILM SPEED: ISO ${iso}`,
        "Simulate fast consumer film.",
        "Use visibly coarser but organic film grain, reduced fine detail, slightly rougher color and shadow rendition, and greater sensitivity in low light.",
        "Do not add digital sensor noise, block artifacts, or a uniform monochrome noise overlay."
    ];
}
function manualInteractionRules(context, lensMm) {
    const settings = context.manualSettings;
    const rules = [
        "SETTING INTERACTIONS AND PHYSICAL REASONING",
        `A tiny direct flash cannot illuminate distant mountains, a skyline, or an entire street.`,
        `Exposure compensation changes brightness, not the scene's hour, weather, location, or identity.`,
        `ISO affects sensitivity and film texture, not depth of field.`,
        `Subject mode affects composition, not factual claims about who is present.`,
        `The ${lensMm} mm rectilinear lens sets a wide field of view; use perspective and subject distance to reconcile it with depth-of-field settings.`
    ];
    if (settings.iso <= 160 && settings.flashMode === "off" && (context.mode === "indoor" || context.time.dayPeriod === "night")) {
        rules.push("ISO 80-160, flash off, and dim interior/night context: the image may be dark and/or exhibit plausible motion blur.");
    }
    if (settings.iso >= 500 && settings.flashMode === "off" && (context.mode === "indoor" || context.time.dayPeriod === "night")) {
        rules.push("High ISO, flash off, and dim interior/night context: a brighter capture is more plausible, but with coarser organic film grain.");
    }
    if (settings.iso <= 160 && settings.flashMode === "on") {
        rules.push("Low ISO with flash on: nearby subjects may still be sharply exposed by the flash despite lower ambient sensitivity.");
    }
    if (settings.iso >= 500 && settings.exposureCompensationEv === 3) {
        rules.push("High ISO combined with +3 EV permits stronger highlight clipping and coarse shadow texture.");
    }
    return rules;
}
