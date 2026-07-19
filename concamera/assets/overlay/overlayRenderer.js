import { DEFAULT_MANUAL_SETTINGS, densityObjectLimit, sanitizeManualSettings, scanModeObjectLimit } from "../context/manualSettings.js";
export const OVERLAY_RENDER_VERSION = "semantic-overlay-v1";
const MAX_OUTPUT_DIMENSION = 1600;
export class SemanticOverlayRenderer {
    dependencies;
    constructor(dependencies = browserOverlayDependencies()) {
        this.dependencies = dependencies;
    }
    async render(input) {
        const startedAt = this.dependencies.now();
        const settings = sanitizeManualSettings(input.settings);
        const sourceImage = await this.dependencies.loadImage(input.source.dataUrl);
        const { width, height } = outputDimensions(input.source.width, input.source.height);
        const canvas = this.dependencies.createCanvas(width, height);
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Overlay canvas context unavailable");
        }
        context.drawImage(sourceImage, 0, 0, width, height);
        const renderedObjects = selectOverlayObjects(input.analysis, settings);
        const renderedRelationships = selectOverlayRelationships(input.analysis.relationships, renderedObjects, settings);
        drawOverlay(context, width, height, renderedObjects, renderedRelationships, settings, input);
        return {
            imageDataUrl: canvas.toDataURL("image/jpeg", 0.92),
            sceneSummary: sceneSummary(renderedObjects, renderedRelationships, settings, input.analysis.warnings),
            renderVersion: OVERLAY_RENDER_VERSION,
            overlayRenderMs: Math.max(0, Math.round(this.dependencies.now() - startedAt)),
            renderedObjects,
            renderedRelationships
        };
    }
}
export function selectOverlayObjects(analysis, settings = DEFAULT_MANUAL_SETTINGS) {
    const normalized = sanitizeManualSettings(settings);
    const limit = Math.min(scanModeObjectLimit(normalized.scanMode), densityObjectLimit(normalized.overlayDensity));
    const threshold = normalized.confidenceThreshold;
    const relationshipCritical = new Set();
    analysis.relationships.forEach((relationship) => {
        relationshipCritical.add(relationship.subjectObjectId);
        relationshipCritical.add(relationship.objectObjectId);
    });
    return [...analysis.objects]
        .filter((object) => object.confidence === null || object.confidence >= threshold)
        .sort((a, b) => {
        const criticalDelta = Number(relationshipCritical.has(b.id)) - Number(relationshipCritical.has(a.id));
        if (criticalDelta !== 0) {
            return criticalDelta;
        }
        return b.salience - a.salience;
    })
        .slice(0, limit);
}
export function selectOverlayRelationships(relationships, objects, settings = DEFAULT_MANUAL_SETTINGS) {
    const normalized = sanitizeManualSettings(settings);
    const ids = new Set(objects.map((object) => object.id));
    const available = relationships.filter((relationship) => ids.has(relationship.subjectObjectId) && ids.has(relationship.objectObjectId));
    if (normalized.overlayDensity === "minimal") {
        return available.slice(0, 1);
    }
    return available.slice(0, normalized.overlayDensity === "full" ? 16 : 8);
}
export function affordanceFor(label) {
    const text = label.toLowerCase();
    const mapping = [
        [/\bchair\b/, ["SIT"]],
        [/\bdoor\b/, ["OPEN", "CLOSE"]],
        [/\bkeyboard\b/, ["TYPE"]],
        [/\bmouse\b/, ["POINT", "CLICK"]],
        [/\bbottle\b/, ["HOLD"]],
        [/\bcup\b/, ["DRINK"]],
        [/\bbicycle\b/, ["RIDE"]],
        [/\bcar\b/, ["DRIVE"]],
        [/\bumbrella\b/, ["SHELTER"]],
        [/\bbook\b/, ["READ"]]
    ];
    return mapping.find(([pattern]) => pattern.test(text))?.[1] ?? [];
}
export function risksFor(object) {
    const label = object.normalizedLabel.toLowerCase();
    const risks = [];
    if (object.category === "vehicle" && object.boundingBox && foregroundCentral(object.boundingBox)) {
        risks.push("POSSIBLE VEHICLE NEARBY");
    }
    if (/\b(knife|scissors|blade|saw|sharp tool)\b/.test(label)) {
        risks.push("POSSIBLE SHARP OBJECT");
    }
    if (object.boundingBox && object.boundingBox.y + object.boundingBox.height > 0.78 && object.boundingBox.width > 0.18) {
        risks.push("POSSIBLE TRIP HAZARD");
    }
    return risks;
}
function drawOverlay(context, width, height, objects, relationships, settings, input) {
    const normalized = sanitizeManualSettings(settings);
    context.save();
    context.lineWidth = Math.max(2, Math.round(width / 520));
    context.font = `${Math.max(14, Math.round(width / 54))}px "Courier New", monospace`;
    context.textBaseline = "top";
    drawHeader(context, width, input.timestamp, normalized);
    if (objects.length === 0) {
        drawUnavailable(context, width, height);
        context.restore();
        return;
    }
    if (normalized.relationsVisible) {
        drawRelationshipLines(context, width, height, objects, relationships, normalized.analysisMode);
    }
    for (const object of objects) {
        if (!object.boundingBox) {
            continue;
        }
        const box = scaleBox(object.boundingBox, width, height);
        if (normalized.boxesVisible) {
            if (normalized.overlayDensity === "full") {
                drawFullBox(context, box);
            }
            else {
                drawCornerBox(context, box, normalized.overlayDensity === "minimal" ? 0.18 : 0.28);
            }
        }
        const label = labelForObject(object, normalized.analysisMode, normalized.overlayDensity);
        if (label) {
            drawLabel(context, label, box.x, Math.max(10, box.y - labelHeight(context, label) - 4), width);
        }
    }
    if (normalized.analysisMode === "semantic") {
        drawRelationshipSummary(context, relationships, objects, width, height);
    }
    if (normalized.overlayDensity === "full") {
        drawDiagnostics(context, input.analysis, objects, relationships, width, height);
    }
    context.restore();
}
function labelForObject(object, mode, density) {
    const base = object.normalizedLabel.toUpperCase();
    switch (mode) {
        case "affordance": {
            const actions = affordanceFor(object.normalizedLabel);
            return actions.length > 0 ? `${base} -> ${actions.join("/")}` : null;
        }
        case "risk": {
            const risks = risksFor(object);
            return risks.length > 0 ? risks.join(" / ") : null;
        }
        case "attention":
            return `ATTN ${base}`;
        case "semantic":
        case "taxonomy":
        default:
            return density === "full" && object.confidence !== null
                ? `${base} ${Math.round(object.confidence * 100)}`
                : base;
    }
}
function drawHeader(context, width, timestamp, settings) {
    const label = `CONCAMERA ${settings.analysisMode.toUpperCase()} ${new Date(timestamp).toISOString().slice(11, 19)}`;
    drawLabel(context, label, 12, 12, width);
}
function drawUnavailable(context, width, height) {
    context.save();
    context.textAlign = "center";
    context.font = `${Math.max(18, Math.round(width / 34))}px "Courier New", monospace`;
    const text = "ANALYSIS UNAVAILABLE";
    const metrics = context.measureText(text);
    const padding = 12;
    context.fillStyle = "rgba(5, 9, 10, 0.78)";
    context.fillRect((width - metrics.width) / 2 - padding, height / 2 - 22, metrics.width + padding * 2, 44);
    context.fillStyle = "#70fff2";
    context.fillText(text, width / 2, height / 2 - 12);
    context.restore();
}
function drawCornerBox(context, box, ratio) {
    const length = Math.max(12, Math.min(box.width, box.height) * ratio);
    context.save();
    context.strokeStyle = "#67fff0";
    context.shadowColor = "rgba(103, 255, 240, 0.45)";
    context.shadowBlur = 5;
    context.beginPath();
    context.moveTo(box.x, box.y + length);
    context.lineTo(box.x, box.y);
    context.lineTo(box.x + length, box.y);
    context.moveTo(box.x + box.width - length, box.y);
    context.lineTo(box.x + box.width, box.y);
    context.lineTo(box.x + box.width, box.y + length);
    context.moveTo(box.x + box.width, box.y + box.height - length);
    context.lineTo(box.x + box.width, box.y + box.height);
    context.lineTo(box.x + box.width - length, box.y + box.height);
    context.moveTo(box.x + length, box.y + box.height);
    context.lineTo(box.x, box.y + box.height);
    context.lineTo(box.x, box.y + box.height - length);
    context.stroke();
    context.restore();
}
function drawFullBox(context, box) {
    context.save();
    context.strokeStyle = "#67fff0";
    context.shadowColor = "rgba(103, 255, 240, 0.45)";
    context.shadowBlur = 5;
    context.strokeRect(box.x, box.y, box.width, box.height);
    context.restore();
}
function drawRelationshipLines(context, width, height, objects, relationships, mode) {
    const byId = new Map(objects.map((object) => [object.id, object]));
    for (const relationship of relationships) {
        const subject = byId.get(relationship.subjectObjectId);
        const object = byId.get(relationship.objectObjectId);
        if (!subject?.boundingBox || !object?.boundingBox) {
            continue;
        }
        const a = center(scaleBox(subject.boundingBox, width, height));
        const b = center(scaleBox(object.boundingBox, width, height));
        context.save();
        context.strokeStyle = mode === "semantic" ? "#ff4fd8" : "rgba(255, 79, 216, 0.74)";
        context.fillStyle = "#ff4fd8";
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
        drawLabel(context, relationshipLabel(subject, relationship, object), (a.x + b.x) / 2, (a.y + b.y) / 2, width);
        context.restore();
    }
}
function drawRelationshipSummary(context, relationships, objects, width, height) {
    const byId = new Map(objects.map((object) => [object.id, object]));
    const lines = relationships.slice(0, 4).flatMap((relationship) => {
        const subject = byId.get(relationship.subjectObjectId);
        const object = byId.get(relationship.objectObjectId);
        return subject && object ? [relationshipLabel(subject, relationship, object)] : [];
    });
    lines.forEach((line, index) => drawLabel(context, line, 12, height - 34 * (lines.length - index), width));
}
function drawDiagnostics(context, analysis, objects, relationships, width, height) {
    const lines = [
        `OBJECTS ${objects.length}/${analysis.objects.length}`,
        `REL ${relationships.length}`,
        `PROVIDER ${analysis.provider}`,
        ...(analysis.metrics ? [`BACKEND ${analysis.metrics.backend.toUpperCase()}`, `MS ${analysis.metrics.totalObjectAnalysisMs}`] : [])
    ];
    lines.forEach((line, index) => drawLabel(context, line, width - 250, height - 28 * (lines.length - index), width));
}
function drawLabel(context, text, x, y, width) {
    const paddingX = 7;
    const paddingY = 4;
    const metrics = context.measureText(text);
    const textHeight = labelHeight(context, text);
    const left = Math.max(6, Math.min(width - metrics.width - paddingX * 2 - 6, x));
    const top = Math.max(6, y);
    context.save();
    context.fillStyle = "rgba(3, 8, 10, 0.78)";
    context.fillRect(left, top, metrics.width + paddingX * 2, textHeight + paddingY * 2);
    context.strokeStyle = "rgba(103, 255, 240, 0.55)";
    context.strokeRect(left, top, metrics.width + paddingX * 2, textHeight + paddingY * 2);
    context.fillStyle = "#70fff2";
    context.fillText(text, left + paddingX, top + paddingY);
    context.restore();
}
function labelHeight(context, text) {
    const metrics = context.measureText(text);
    return metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || 16;
}
function relationshipLabel(subject, relationship, object) {
    return `${subject.normalizedLabel.toUpperCase()} ${relationship.predicate.replace(/-/g, " ").toUpperCase()} ${object.normalizedLabel.toUpperCase()}`;
}
function sceneSummary(objects, relationships, settings, warnings) {
    if (objects.length === 0) {
        return warnings.length > 0 ? `Analysis unavailable: ${warnings[0]}` : "No salient local objects detected.";
    }
    const objectText = objects.map((object) => object.normalizedLabel).join(", ");
    const relationshipText = relationshipSummary(objects, relationships);
    return `${settings.analysisMode} overlay: ${objectText}.${relationshipText}`;
}
function relationshipSummary(objects, relationships) {
    if (relationships.length === 0) {
        return "";
    }
    const byId = new Map(objects.map((object) => [object.id, object]));
    const text = relationships.flatMap((relationship) => {
        const subject = byId.get(relationship.subjectObjectId);
        const object = byId.get(relationship.objectObjectId);
        return subject && object
            ? [`${subject.normalizedLabel} ${relationship.predicate.replace(/-/g, " ")} ${object.normalizedLabel}`]
            : [];
    }).join("; ");
    return text ? ` Relationships: ${text}.` : "";
}
function foregroundCentral(box) {
    const centerX = box.x + box.width / 2;
    return centerX >= 0.25 && centerX <= 0.75 && box.y + box.height >= 0.58;
}
function outputDimensions(sourceWidth, sourceHeight) {
    const max = Math.max(1, Math.max(sourceWidth, sourceHeight));
    const scale = Math.min(1, MAX_OUTPUT_DIMENSION / max);
    return {
        width: Math.max(1, Math.round(sourceWidth * scale)),
        height: Math.max(1, Math.round(sourceHeight * scale))
    };
}
function scaleBox(box, width, height) {
    return {
        x: box.x * width,
        y: box.y * height,
        width: box.width * width,
        height: box.height * height
    };
}
function center(box) {
    return {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2
    };
}
function browserOverlayDependencies() {
    return {
        loadImage,
        createCanvas(width, height) {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            return canvas;
        },
        now: () => Date.now()
    };
}
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Source image failed to load for overlay rendering"));
        image.src = src;
    });
}
export function persistedRelationshipText(relationships) {
    return relationships
        .map((relationship) => `${relationship.subject} ${relationship.predicate.replace(/-/g, " ")} ${relationship.object}`)
        .join("; ");
}
