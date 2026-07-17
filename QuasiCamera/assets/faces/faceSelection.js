export const MAX_PRESERVED_FACE_REFERENCES = 5;
export function selectFacesForSubjectMode(faces, subjectMode, seed, maxFaces = MAX_PRESERVED_FACE_REFERENCES) {
    const usableFaces = uniqueFaces(faces);
    if (usableFaces.length === 0) {
        return zeroFaceSelection(subjectMode);
    }
    if (subjectMode === "landscape") {
        const selected = [weightedDeterministicFace(usableFaces, seed, subjectMode)];
        return buildSelection(subjectMode, "environmental-likeness", usableFaces.length, selected, maxFaces, [
            "SUBJECT MODE: LANDSCAPE",
            "The environment must dominate the composition.",
            "Incorporate the selected facial likeness indirectly into a plausible visual element such as a mural, textile print, poster, sculpted relief, reflection, or decorative artwork.",
            "The face must remain recognizable but must not become a grotesque biological object.",
            "Do not create a severed head, disembodied realistic face floating in space, body horror, or disturbing facial distortion."
        ].join("\n"), "one preserved likeness incorporated into the environment");
    }
    if (subjectMode === "single-person") {
        const selected = [weightedDeterministicFace(usableFaces, seed, subjectMode)];
        return buildSelection(subjectMode, "preserved-hero", usableFaces.length, selected, maxFaces, [
            "SUBJECT MODE: PERSON",
            "Use only the selected reference person as the principal recognizable real person.",
            "Create one clear hero subject.",
            "Do not preserve the other source faces.",
            "Any incidental background people must be synthetic and must not resemble unselected source people."
        ].join("\n"), "one preserved hero subject");
    }
    if (subjectMode === "group") {
        const selected = rankedSubset(usableFaces, seed, subjectMode, maxFaces);
        const strategy = selected.length === usableFaces.length && selected.length > 1
            ? "preserved-group"
            : "preserved-plus-synthetic-group";
        return buildSelection(subjectMode, strategy, usableFaces.length, selected, maxFaces, [
            "SUBJECT MODE: GROUP",
            `Preserve ${selected.length} selected real people as distinct principal group members.`,
            "If additional people are needed, they must be synthetic and should not resemble unselected source faces.",
            "Keep each selected person as one distinct face; do not merge identities or swap faces between bodies."
        ].join("\n"), "preserved group with synthetic additions only if needed");
    }
    const selected = rankedSubset(usableFaces, seed, subjectMode, maxFaces);
    return buildSelection(subjectMode, "preserved-plus-synthetic-crowd", usableFaces.length, selected, maxFaces, [
        "SUBJECT MODE: CROWD",
        `Place ${selected.length} selected real people naturally within a much larger crowd of synthetic people.`,
        "Each preserved person must appear exactly once.",
        "Other people may be newly invented.",
        "Do not tile, clone, or duplicate any preserved person across the crowd."
    ].join("\n"), "preserved real people among a synthetic crowd");
}
function zeroFaceSelection(subjectMode) {
    const instructions = {
        landscape: [
            "SUBJECT MODE: LANDSCAPE",
            "No real faces were detected.",
            "Generate a landscape or environmental photograph. No real likeness preservation is possible and no person is required."
        ].join("\n"),
        "single-person": [
            "SUBJECT MODE: PERSON",
            "No real faces were detected.",
            "Generate one entirely synthetic person. Do not claim a real person was preserved."
        ].join("\n"),
        group: [
            "SUBJECT MODE: GROUP",
            "No real faces were detected.",
            "Generate a synthetic small group. Do not claim real people were preserved."
        ].join("\n"),
        crowd: [
            "SUBJECT MODE: CROWD",
            "No real faces were detected.",
            "Generate a synthetic crowd. Do not claim real people were preserved."
        ].join("\n")
    };
    return {
        subjectMode,
        strategy: "synthetic-subjects",
        selectedFaces: [],
        selectedFaceIds: [],
        selectedFaceCount: 0,
        detectedFaceCount: 0,
        syntheticSubjectInstruction: "synthetic-subjects",
        promptInstruction: instructions[subjectMode],
        maxFacesApplied: MAX_PRESERVED_FACE_REFERENCES
    };
}
function buildSelection(subjectMode, strategy, detectedFaceCount, selectedFaces, maxFacesApplied, promptInstruction, syntheticSubjectInstruction) {
    return {
        subjectMode,
        strategy,
        selectedFaces,
        selectedFaceIds: selectedFaces.map((face) => face.id),
        selectedFaceCount: selectedFaces.length,
        detectedFaceCount,
        syntheticSubjectInstruction,
        promptInstruction,
        maxFacesApplied
    };
}
function uniqueFaces(faces) {
    const seen = new Set();
    return faces.filter((face) => {
        if (seen.has(face.id)) {
            return false;
        }
        seen.add(face.id);
        return face.boundingBox.width > 0 && face.boundingBox.height > 0;
    });
}
function rankedSubset(faces, seed, subjectMode, maxFaces) {
    return [...faces]
        .sort((a, b) => scoreFace(b, seed, subjectMode) - scoreFace(a, seed, subjectMode))
        .slice(0, Math.max(0, maxFaces));
}
function weightedDeterministicFace(faces, seed, subjectMode) {
    const ranked = rankedSubset(faces, seed, subjectMode, faces.length);
    const totalWeight = ranked.reduce((sum, face) => sum + Math.max(0.001, scoreFace(face, seed, subjectMode)), 0);
    let target = seededUnit(`${seed}:${subjectMode}:pick`) * totalWeight;
    for (const face of ranked) {
        target -= Math.max(0.001, scoreFace(face, seed, subjectMode));
        if (target <= 0) {
            return face;
        }
    }
    return ranked[0] ?? faces[0];
}
export function scoreFace(face, seed, subjectMode = "single-person") {
    const area = Math.sqrt(Math.max(0, face.areaRatio));
    const centered = 1 - Math.min(1, Math.max(0, face.centerDistance));
    const confidence = face.confidence ?? 0.75;
    const randomComponent = seededUnit(`${seed}:${subjectMode}:${face.id}`);
    return area * 4 + centered * 1.6 + confidence * 1.1 + randomComponent * 0.6;
}
function seededUnit(input) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
}
