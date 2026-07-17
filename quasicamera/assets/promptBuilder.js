import { aimLabelForPitch, directionLabelForAzimuth, frameLabelForScreen } from "./context/cameraPose.js";
import { evLabel, flashLabel, focusStyleLabel, subjectModeLabel } from "./context/manualSettings.js";
function value(label, detail) {
    if (detail === undefined || detail === null || detail === "") {
        return `${label}: unknown`;
    }
    return `${label}: ${detail}`;
}
function facePreservationRules(selection) {
    if (!selection || selection.selectedFaceCount === 0) {
        return [
            "PRESERVE SELECTED HUMAN LIKENESS",
            "There are 0 selected real face references.",
            "No real likeness preservation is possible for this exposure.",
            "If people are needed by subject mode, create synthetic people and do not claim that any real person was preserved."
        ];
    }
    return [
        "PRESERVE SELECTED HUMAN LIKENESS",
        `There are ${selection.selectedFaceCount} selected real face references.`,
        "Each selected face represents one distinct person.",
        "Preserve recognizable facial structure, eyes, nose, mouth, jawline, skin texture and overall likeness, distinguishing visible facial features, and hairline where visible.",
        "Do not merge two people into one.",
        "Do not swap faces between bodies.",
        "Do not duplicate a selected person.",
        "Do not invent extra copies of a selected face.",
        "Do not substantially change identity.",
        "Do not beautify everyone into the same generic face.",
        "Do not replace preserved faces with merely similar strangers."
    ];
}
function subjectFaceSelectionRules(selection) {
    const ids = selection.selectedFaceIds.length > 0 ? selection.selectedFaceIds.join(", ") : "none";
    return [
        "SUBJECT MODE AND REAL-FACE MAPPING",
        `Detected source faces: ${selection.detectedFaceCount}.`,
        `Selected source faces: ${selection.selectedFaceCount}.`,
        `Selected face IDs: ${ids}.`,
        `Mapping strategy: ${selection.strategy}.`,
        `Reference-image limit for this MVP: ${selection.maxFacesApplied}.`,
        selection.promptInstruction,
        "Every selected face must appear at most once.",
        "Unselected source faces must not be preserved as recognizable people.",
        "Synthetic people may be invented only where the subject mode explicitly allows them.",
        "The selected real people are likeness references, not identity claims. Do not name them or infer who they are."
    ];
}
function objectPreservationRules(analysis) {
    if (!analysis || analysis.objects.length === 0) {
        return [
            "HUMAN AND OBJECT PRESERVATION RULES",
            "Selected human faces require recognizable identity preservation.",
            "No salient non-human semantic objects were recognized for this exposure.",
            "Do not fabricate object-analysis evidence. Continue with the face, subject-mode, context, and camera-setting instructions."
        ];
    }
    const byId = new Map(analysis.objects.map((object) => [object.id, object]));
    const objectLines = analysis.objects.map((object, index) => {
        const count = object.count && object.count > 1 ? `${object.count} instances of ` : "";
        const attributes = object.attributes.length > 0 ? `; attributes: ${object.attributes.join(", ")}` : "";
        const label = count ? `${count}${object.normalizedLabel}` : `${articleFor(object.normalizedLabel)} ${object.normalizedLabel}`;
        return `${index + 1}. ${label} (semantic category: ${object.category}${attributes})`;
    });
    const relationshipLines = analysis.relationships.flatMap((relationship) => {
        const subject = byId.get(relationship.subjectObjectId);
        const object = byId.get(relationship.objectObjectId);
        if (!subject || !object) {
            return [];
        }
        return relationshipSentence(subject, relationship.predicate, object);
    });
    return [
        "HUMAN AND OBJECT PRESERVATION RULES",
        "Selected human faces require recognizable identity preservation.",
        "Non-human objects require semantic preservation only.",
        "Do not waste reference fidelity trying to reproduce exact object colors, brands, scratches, fabric patterns, logos, license plates, model details, stitching, or material texture unless they are essential to the normalized object category.",
        "Maintain the object categories and important relationships while allowing substantial visual reinvention.",
        "",
        "SEMANTIC OBJECTS TO PRESERVE",
        "The source photograph contains these salient non-human objects:",
        ...objectLines,
        "Preserve these object categories in the regenerated photograph.",
        "They do not need to be the exact same physical objects.",
        "A preserved object does not need to be the exact same physical object as the source object.",
        ...objectVariationLines(analysis.objects),
        "Do not omit relationship-critical objects.",
        "",
        "OBJECT RELATIONSHIPS TO PRESERVE",
        ...(relationshipLines.length > 0 ? relationshipLines : ["No high-confidence object-to-object relationship was recognized."]),
        ...(relationshipLines.length > 0
            ? [
                "Preserve each relationship clearly in the regenerated scene.",
                "Do not move relationship-critical objects into a different semantic arrangement unless the required relationship remains visibly true."
            ]
            : []),
        "Use the source image as evidence of composition, viewpoint, selected faces, object categories, and relationships.",
        "The new scene may radically transform the environment and visual appearance.",
        "Do not simply reproduce the source photograph.",
        "Do not remove salient preserved objects.",
        "Do not change essential relationships."
    ];
}
function objectVariationLines(objects) {
    const lines = [];
    if (objects.some((object) => object.normalizedLabel === "car")) {
        lines.push("The target car does not need to resemble the source car; make, model, body style, color, age, condition, license plate, and brand markings may change.");
    }
    if (objects.some((object) => object.normalizedLabel === "hedgehog plushie")) {
        lines.push("The target hedgehog plushie does not need to resemble the source plushie; colors, fabric, stitching, character design, proportions, and material may change.");
    }
    objects
        .filter((object) => object.normalizedLabel !== "car" && object.normalizedLabel !== "hedgehog plushie")
        .slice(0, 3)
        .forEach((object) => {
        lines.push(`The target ${object.normalizedLabel} does not need to preserve exact color, brand, age, surface wear, or source-specific details.`);
    });
    return lines;
}
function articleFor(label) {
    return /^[aeiou]/i.test(label) ? "An" : "A";
}
function relationshipSentence(subject, predicate, object) {
    const subjectLabel = subject.normalizedLabel;
    const objectLabel = object.normalizedLabel;
    if (predicate === "on-top-of") {
        return [
            `The ${subjectLabel} is positioned on top of the ${objectLabel}.`,
            `Do not place the ${subjectLabel} beside the ${objectLabel}, inside the ${objectLabel}, under the ${objectLabel}, or held by a person unless the ${subjectLabel} also remains visibly on top of the ${objectLabel}.`
        ];
    }
    return [`The ${subjectLabel} is ${predicate.replaceAll("-", " ")} the ${objectLabel}.`];
}
export class PromptBuilder {
    virtualLensMm;
    constructor(virtualLensMm = 22) {
        this.virtualLensMm = virtualLensMm;
    }
    build(context, faceSelection, objectAnalysis) {
        const location = context.location;
        const weather = context.weather;
        const audio = context.audio;
        const motion = context.motion;
        const device = context.device;
        const pose = context.cameraPose;
        const settings = context.manualSettings;
        const illumination = illuminationContext(context);
        const lines = [
            "QUASICAMERA IMAGE TRANSFORMATION",
            "The source image is a real camera photograph captured at shutter time.",
            "Create a new, substantially transformed photographic scene.",
            "The source photograph supplies facial likeness references, approximate human pose and framing where useful, and camera viewpoint.",
            "The new image does not need to preserve the original location, exact object appearance, furniture, vehicles, signage, or background.",
            "Preserve selected people according to the face rules and preserve recognized non-human objects according to the semantic-object rules below.",
            "Do not include fantasy, surrealism, illustration, painting, CGI, or visible AI artifacts.",
            "Make the result look like a realistic compact point-and-shoot photograph on instant film.",
            "Use ordinary photographic imperfections: available light, weather haze, flash falloff, slight handheld framing, natural grain.",
            "",
            ...facePreservationRules(faceSelection),
            "",
            ...objectPreservationRules(objectAnalysis),
            "",
            "PROMPT PRIORITY ORDER",
            "PRIORITY 1 -- SELECTED HUMAN LIKENESS: preserve exactly the selected real face references according to subject mode.",
            "PRIORITY 2 -- OBJECT SEMANTICS: recognized non-human objects remain the same general kind of object.",
            "PRIORITY 3 -- OBJECT RELATIONSHIPS: important spatial and functional object relationships remain clear.",
            "PRIORITY 4 -- IMMUTABLE SCENE FACTS: time, timezone, daylight phase, weather, location, and indoor/outdoor state.",
            "PRIORITY 5 -- CAMERA GEOMETRY: source viewpoint, heading, pitch, roll, framing, and virtual lens.",
            "PRIORITY 6 -- SUBJECT AND COMPOSITION: landscape, one person, group, or crowd.",
            "PRIORITY 7 -- CAMERA RENDERING SETTINGS: exposure compensation, ISO, flash, and depth of field.",
            "Lower-priority settings must never rewrite, reinterpret, or contradict higher-priority facts.",
            "",
            ...sceneFactRules(context, illumination),
            "",
            ...geographicContextRules(context),
            "",
            ...sceneConsistencyRules(context, illumination),
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
            value("Photographic daylight phase", illumination.phase),
            value("Indoor/outdoor switch", context.mode),
            value("Location label", location.label),
            value("Latitude", location.latitude),
            value("Longitude", location.longitude),
            value("GPS accuracy meters", location.accuracy),
            value("Reverse geocoding provider", location.reverseGeocode?.provider),
            value("Nearest mapped feature", location.reverseGeocode?.feature.name),
            value("Feature type", location.reverseGeocode?.feature.type),
            value("Road", location.reverseGeocode?.address.road),
            value("Neighborhood", location.reverseGeocode?.address.neighborhood),
            value("Suburb", location.reverseGeocode?.address.suburb),
            value("City", location.reverseGeocode?.address.city),
            value("Region", location.reverseGeocode?.address.region),
            value("Country", location.reverseGeocode?.address.country),
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
            value("Detected source faces", context.quasiCamera?.detectedFaceCount),
            value("Selected source faces", context.quasiCamera?.selectedFaceCount),
            value("Subject mapping strategy", context.quasiCamera?.subjectMappingStrategy),
            value("Face analysis provider", context.quasiCamera?.faceAnalysisProvider),
            value("Recognized non-human objects", context.quasiCamera?.recognizedObjects?.map((object) => object.normalizedLabel).join(", ")),
            value("Recognized object relationships", context.quasiCamera?.objectRelationships?.map((relationship) => `${relationship.subject} ${relationship.predicate} ${relationship.object}`).join("; ")),
            value("Object analysis provider", context.quasiCamera?.objectAnalysisProvider),
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
            `Exposure compensation: ${evPromptLabel(settings.exposureCompensationEv)}.`,
            `Flash: ${settings.flashMode}.`,
            `Film speed: ISO ${settings.iso}.`,
            `Virtual lens: ${this.virtualLensMm} mm full-frame equivalent.`,
            "Treat these as physical camera settings, not as loose aesthetic suggestions.",
            "Apply them together coherently.",
            "Do not contradict immutable scene facts or the supplied camera pitch, roll, heading, location, weather, time, or indoor/outdoor context.",
            "",
            ...(faceSelection ? subjectFaceSelectionRules(faceSelection) : subjectPriorityRules(context)),
            "",
            ...depthOfFieldRules(context, this.virtualLensMm),
            "",
            ...flashRules(context),
            "",
            ...filmSpeedRules(context),
            "",
            ...exposureRules(context, illumination),
            "",
            ...manualInteractionRules(context, this.virtualLensMm),
            "",
            ...finalConsistencyCheck(context, illumination),
            "",
            "Use azimuth together with location context only as geometry. The camera faces approximately "
                + `${directionLabelForAzimuth(pose.azimuthDeg)} from the supplied coordinates. `
                + "Do not invent or assert that a specific landmark is visible unless it is supplied by reliable context.",
            "",
            "Preserve approximate camera height, camera angle, pitch, roll, portrait/landscape framing, and major perspective direction from the source photograph.",
            "Do not automatically straighten a rolled source frame.",
            "Compose one plausible transformed photograph from these facts. No captions, no interface, no text overlay."
        ];
        return lines.join("\n");
    }
}
function illuminationContext(context) {
    const phase = daylightPhase(context);
    return {
        phase,
        timeText: context.time.time || "unknown local time",
        weatherText: context.weather.description || "unknown weather",
        locationText: locationSummary(context),
        isDaylight: phase === "morning daylight" || phase === "midday daylight" || phase === "afternoon daylight",
        isNight: phase === "night",
        isTwilight: phase === "sunrise / early dawn" || phase === "sunset / twilight"
    };
}
function daylightPhase(context) {
    const hour = Number.isFinite(context.time.hour) ? context.time.hour : parseHour(context.time.time);
    if (hour !== null) {
        if (hour < 4) {
            return "night";
        }
        if (hour < 5) {
            return "pre-dawn";
        }
        if (hour < 6.5) {
            return "sunrise / early dawn";
        }
        if (hour < 11) {
            return "morning daylight";
        }
        if (hour < 14) {
            return "midday daylight";
        }
        if (hour < 17) {
            return "afternoon daylight";
        }
        if (hour < 18.5) {
            return "sunset / twilight";
        }
        if (hour < 21) {
            return "evening";
        }
        return "night";
    }
    switch (context.time.dayPeriod) {
        case "morning":
            return "morning daylight";
        case "afternoon":
            return "afternoon daylight";
        case "evening":
            return "evening";
        case "night":
        default:
            return "night";
    }
}
function parseHour(time) {
    const match = time.match(/^(\d{1,2})(?::(\d{2}))?/);
    if (!match) {
        return null;
    }
    const hour = Number(match[1]);
    const minute = Number(match[2] ?? 0);
    if (!Number.isFinite(hour) || hour < 0 || hour > 23 || !Number.isFinite(minute)) {
        return null;
    }
    return hour + minute / 60;
}
function sceneFactRules(context, illumination) {
    const weather = context.weather;
    return [
        "SCENE FACTS -- IMMUTABLE",
        "The following describe the physical scene at shutter time and must remain true in the generated photograph:",
        value("Local date", context.time.date),
        value("Local clock time", context.time.time),
        value("Timezone", context.time.timezone),
        value("Daylight phase", illumination.phase),
        value("Weather", weather.description),
        value("Temperature", weather.temperatureC === undefined ? undefined : `${weather.temperatureC} C`),
        value("Cloud cover", weather.cloudCoverPercent === undefined ? undefined : `${weather.cloudCoverPercent}%`),
        value("Rain", weather.rainMm === undefined ? undefined : `${weather.rainMm} mm`),
        value("Indoor/outdoor", context.mode),
        value("Location", illumination.locationText),
        "These facts define the actual environment.",
        "Do not alter the time of day, daylight phase, weather, season, or location in response to exposure compensation, ISO, flash, depth of field, or subject mode.",
        "Camera settings affect how this same scene is photographed. They do not create a different scene."
    ];
}
function sceneConsistencyRules(context, illumination) {
    const lines = [
        "TIME, DAYLIGHT, AND WEATHER CONSISTENCY",
        sceneSentence(context, illumination),
        `The sky, ambient illumination, shadow direction, visible activity, and color temperature must remain consistent with approximately ${illumination.timeText} in ${illumination.locationText} under ${illumination.weatherText} weather.`,
        "Exposure compensation must not apply a cinematic color grade.",
        "Preserve color temperature appropriate to the stated local time, weather, and illumination source."
    ];
    if (illumination.isDaylight) {
        lines.push("Do not depict dusk, sunset, twilight, evening, night, a purple sunset sky, an orange horizon glow, streetlights dominating the scene, or nighttime darkness.");
        lines.push("A negative EV may make the daylight sky darker in recorded luminance, but it must remain recognizably the same daytime sky.");
        lines.push("Do not replace a known daylight sky with sunset clouds, dusk gradients, purple twilight, orange horizon light, a starry sky, or a night sky.");
        if (illumination.phase === "morning daylight" && clearWeather(context.weather.description)) {
            lines.push("For clear morning weather, the underexposed sky may be a deeper blue or gray-blue, depending on atmospheric conditions, but not a dusk palette.");
        }
    }
    else if (illumination.isNight) {
        lines.push("This is a nighttime scene. Do not create daylight merely because exposure compensation is positive.");
        lines.push("Positive EV may over-record lamps, flash-lit nearby subjects, or bright surfaces, but the environment remains night.");
    }
    else if (illumination.isTwilight) {
        lines.push("This twilight or dawn illumination is an immutable scene fact; do not move the scene to midday, night, or a different weather condition.");
    }
    else {
        lines.push("This low-light phase is an immutable scene fact; exposure changes recorded brightness, not the actual hour or weather.");
    }
    return lines;
}
function sceneSentence(context, illumination) {
    if (illumination.phase === "midday daylight") {
        return `This is a daylight scene near midday in ${context.mode} context. Preserve a daytime sky and daylight environmental cues even if the photograph is severely underexposed.`;
    }
    if (illumination.phase === "morning daylight") {
        return `This is an ${context.mode} morning-daylight scene.`;
    }
    if (illumination.phase === "afternoon daylight") {
        return `This is an ${context.mode} afternoon-daylight scene.`;
    }
    if (illumination.phase === "night") {
        return `This is an ${context.mode} nighttime scene.`;
    }
    return `This is an ${context.mode} ${illumination.phase} scene.`;
}
function finalConsistencyCheck(context, illumination) {
    const ev = context.manualSettings.exposureCompensationEv;
    const lines = [
        "CONSISTENCY CHECK",
        `Known scene: ${illumination.phase}, ${illumination.weatherText.toLowerCase()} weather.`,
        `Requested camera exposure: ${evPromptLabel(ev)}.`
    ];
    if (ev < 0) {
        lines.push(`Required result: a ${exposureAdjective(ev)} ${illumination.phase} photograph.`);
    }
    else if (ev > 0) {
        lines.push(`Required result: a ${exposureAdjective(ev)} version of the same ${illumination.phase} scene.`);
    }
    else {
        lines.push(`Required result: a neutral exposure of the same ${illumination.phase} scene.`);
    }
    if (illumination.isDaylight) {
        lines.push("Forbidden result: dusk, sunset, twilight, evening, or nighttime.");
    }
    else if (illumination.isNight) {
        lines.push("Forbidden result: daylight or daytime.");
    }
    else {
        lines.push("Forbidden result: a different time of day, weather, season, or location.");
    }
    return lines;
}
function locationSummary(context) {
    const location = context.location;
    const reverse = location.reverseGeocode;
    const address = reverse?.address;
    const parts = [
        reverse?.feature.name,
        address?.neighborhood,
        address?.suburb,
        address?.city || address?.municipality,
        address?.region,
        address?.country
    ].filter(Boolean);
    if (parts.length > 0) {
        return parts.join(", ");
    }
    return location.label || "unknown location";
}
function clearWeather(description) {
    return /\b(clear|sunny)\b/i.test(description);
}
function exposureAdjective(ev) {
    switch (ev) {
        case -3:
            return "severely underexposed";
        case -2:
            return "strongly underexposed";
        case -1:
            return "slightly underexposed";
        case 1:
            return "slightly overexposed";
        case 2:
            return "strongly overexposed";
        case 3:
            return "substantially overexposed";
        case 0:
        default:
            return "neutrally exposed";
    }
}
function evPromptLabel(ev) {
    return `${ev > 0 ? "+" : ""}${ev} EV`;
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
function geographicContextRules(context) {
    const location = context.location;
    const reverse = location.reverseGeocode;
    const address = reverse?.address;
    const feature = reverse?.feature;
    const lines = [
        "GEOGRAPHIC CONTEXT",
        "Exact coordinates:",
        value("Latitude", location.latitude),
        value("Longitude", location.longitude),
        value("GPS accuracy", location.accuracy === undefined ? undefined : `approximately ${location.accuracy} meters`),
        "",
        "Reverse-geocoded context:",
        value("Nearest mapped feature", feature?.name),
        value("Feature type", feature?.type),
        value("Approximate distance from GPS point", feature?.distanceMeters === null || feature?.distanceMeters === undefined ? undefined : `${feature.distanceMeters} meters`),
        value("House number", address?.houseNumber),
        value("Road", address?.road),
        value("Neighborhood", address?.neighborhood),
        value("Suburb", address?.suburb),
        value("District", address?.district),
        value("City", address?.city || address?.municipality),
        value("Region", address?.region),
        value("Postcode", address?.postcode),
        value("Country", address?.country),
        value("Reverse-geocoding provider", reverse?.provider),
        value("Reverse-geocoding confidence", reverse?.confidence),
        "",
        "The coordinates are direct sensor data.",
        "The address and named feature are reverse-geocoding results from the nearest suitable mapped object. They are contextual clues, not proof that the camera is physically inside that building.",
        "Use the locality, street character, urban density, architecture, vegetation, and regional context to imagine a plausible scene.",
        "Do not place a recognizable named building prominently in the image merely because it is the nearest mapped feature.",
        "Do not reproduce a specific private house.",
        "Do not invent signage, house numbers, business branding, or landmark visibility unless the context makes it genuinely plausible."
    ];
    if (!reverse || reverse.confidence === "low") {
        lines.push("When GPS accuracy or reverse-geocoding confidence is low, rely more strongly on broad suburb/city/region context than on the exact nearest feature.");
    }
    return lines;
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
function exposureRules(context, illumination) {
    const ev = context.manualSettings.exposureCompensationEv;
    const lines = [
        `EXPOSURE COMPENSATION: ${evPromptLabel(ev)}`,
        "First establish a neutral photographic exposure for the immutable scene facts.",
        `Apply ${evPromptLabel(ev)} relative to neutral exposure by changing recorded exposure only.`,
        `Then apply ${evPromptLabel(ev)} to that same scene's neutral exposure.`,
        "Do not reinterpret the EV number as a request for a darker or brighter environment."
    ];
    if (ev < 0) {
        const stops = Math.abs(ev) === 1 ? "one stop" : `${Math.abs(ev)} stops`;
        lines.push(`Photograph the already-defined scene approximately ${stops} below a neutral exposure.`);
        lines.push(`This must produce a ${exposureAdjective(ev)} version of the same scene: darker recorded midtones, reduced shadow detail, possible crushed blacks, dimmer foreground subjects, reduced visibility in dark areas, preserved bright-source hierarchy, and possible retention of some highlight detail.`);
        lines.push("ABSOLUTE CONSTRAINT:");
        lines.push("Do not convert daylight into dusk, sunset, twilight, evening, or night.");
        lines.push("Do not change the sky into a sunset sky.");
        lines.push("Do not move the sun toward the horizon.");
        lines.push("Do not add evening color grading.");
        lines.push("Do not introduce nighttime lighting.");
        lines.push("Do not change the weather.");
        if (illumination.isDaylight) {
            lines.push("If the scene is daylight, retain unmistakable daylight cues while rendering the photograph underexposed.");
        }
    }
    else if (ev > 0) {
        const stops = ev === 1 ? "one stop" : `${ev} stops`;
        lines.push(`Photograph the already-defined scene approximately ${stops} above a neutral exposure.`);
        lines.push("Exposure compensation increases recorded exposure only.");
        lines.push(`This must produce a ${exposureAdjective(ev)} version of the same scene: lifted midtones, brighter recorded surfaces, washed highlights, plausible sky clipping, reduced highlight texture, and pale or blown bright surfaces at high positive EV.`);
        lines.push("Do not change cloudy weather into sunshine.");
        lines.push("Do not move the scene to midday.");
        lines.push("Do not introduce a brighter time of day.");
        lines.push("Do not change the sun position.");
        lines.push("Do not change the weather.");
        if (illumination.isNight) {
            lines.push("If the scene is nighttime, keep it nighttime; overexposure may blow out lamps, flash-lit nearby subjects, or bright surfaces but must not create daylight.");
        }
    }
    else {
        lines.push("Use a neutral exposure consistent with the immutable time, weather, flash, ISO, movement, and indoor/outdoor context.");
        lines.push("Do not change the scene's hour, weather, or daylight phase.");
    }
    lines.push("Exposure compensation must not apply a cinematic color grade.");
    lines.push("Preserve color temperature appropriate to the stated local time, weather, and illumination source.");
    return lines;
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
