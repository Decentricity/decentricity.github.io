import { isHumanObjectLabel, normalizeObjectCategory, normalizeObjectLabel, validateObjectAnalysis } from "./objectNormalization.js";
const TFJS_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/+esm";
const COCO_SSD_URL = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/+esm";
const MOBILENET_URL = "https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/+esm";
const OBJECT_ANALYSIS_MAX_DIMENSION = 640;
const MIN_OBJECT_CONFIDENCE = 0.45;
const MODEL_LOAD_TIMEOUT_MS = 25_000;
const DETECTION_TIMEOUT_MS = 20_000;
const MAX_CLASSIFIED_CROPS = 4;
const PROVIDER_ID = "local-cnn:coco-ssd+mobilenet";
export class LocalCnnObjectAnalyzer {
    options;
    runtimePromise = null;
    modelStatus = "loading";
    constructor(options = {}) {
        this.options = options;
    }
    async initialize() {
        await this.loadRuntime();
    }
    dispose() {
        this.runtimePromise = null;
        this.modelStatus = "loading";
    }
    async analyze(source) {
        const startedAt = this.now();
        let input = null;
        try {
            const runtime = await withTimeout(this.loadRuntime(), this.options.modelLoadTimeoutMs ?? MODEL_LOAD_TIMEOUT_MS, "local CNN model load");
            input = await (this.options.createAnalysisInput ?? createAnalysisInput)(source, this.options.maxDimension ?? OBJECT_ANALYSIS_MAX_DIMENSION);
            const detectorStartedAt = this.now();
            const detections = await withTimeout(scoped(runtime.tf, () => runtime.detector.detect(input?.image)), this.options.detectionTimeoutMs ?? DETECTION_TIMEOUT_MS, "local object detection");
            const detectorInferenceMs = this.now() - detectorStartedAt;
            const filtered = detections
                .filter((detection) => detection.score >= (this.options.minConfidence ?? MIN_OBJECT_CONFIDENCE))
                .filter((detection) => !isHumanObjectLabel(detection.class));
            const classifierStartedAt = this.now();
            const candidates = await this.buildObjects(input, filtered, runtime);
            const classifierInferenceMs = this.now() - classifierStartedAt;
            const relationshipStartedAt = this.now();
            const relationships = deriveRelationships(candidates);
            const relationshipInferenceMs = this.now() - relationshipStartedAt;
            const validated = validateObjectAnalysis({
                objects: candidates,
                relationships,
                warnings: filtered.length === 0 ? ["No salient objects detected locally."] : []
            }, PROVIDER_ID);
            const ordered = {
                ...validated,
                objects: orderObjectsForPrompt(validated.objects, validated.relationships)
            };
            const metrics = buildMetrics({
                modelLoadMs: runtime.modelLoadMs,
                detectorInferenceMs,
                classifierInferenceMs,
                relationshipInferenceMs,
                totalObjectAnalysisMs: this.now() - startedAt,
                backend: runtime.backend,
                detectedCount: filtered.length,
                preservedCount: ordered.objects.length,
                detector: runtime.detectorName,
                classifier: runtime.classifierName,
                modelStatus: this.modelStatus
            });
            return {
                ...ordered,
                provider: PROVIDER_ID,
                metrics
            };
        }
        catch (error) {
            this.modelStatus = "failed";
            return {
                objects: [],
                relationships: [],
                provider: PROVIDER_ID,
                warnings: [`Local CNN object analysis failed: ${error instanceof Error ? error.message : String(error)}`],
                metrics: buildMetrics({
                    detectorInferenceMs: 0,
                    relationshipInferenceMs: 0,
                    totalObjectAnalysisMs: this.now() - startedAt,
                    backend: "unavailable",
                    detectedCount: 0,
                    preservedCount: 0,
                    detector: "COCO-SSD",
                    classifier: "MobileNet",
                    modelStatus: "failed"
                })
            };
        }
        finally {
            input?.dispose();
        }
    }
    async loadRuntime() {
        if (!this.runtimePromise) {
            this.modelStatus = "loading";
            this.runtimePromise = (async () => {
                const loaded = this.options.detector
                    ? await injectedRuntime(this.options.detector, this.options.classifier ?? null, () => this.now())
                    : await (this.options.runtimeLoader ?? loadBrowserRuntime)(() => this.now());
                this.modelStatus = "ready";
                return loaded;
            })().catch((error) => {
                this.modelStatus = "failed";
                this.runtimePromise = null;
                throw error;
            });
        }
        return this.runtimePromise;
    }
    async buildObjects(input, detections, runtime) {
        const objects = [];
        let classified = 0;
        for (const [index, detection] of detections.entries()) {
            const normalizedBox = normalizeDetectorBox(detection.bbox, input.width, input.height);
            if (!normalizedBox) {
                continue;
            }
            let classifierLabels = [];
            if (runtime.classifier && shouldClassifyCrop(detection.class, normalizedBox) && classified < MAX_CLASSIFIED_CROPS) {
                classified += 1;
                classifierLabels = await this.classifyCrop(input, normalizedBox, runtime);
            }
            const fusedLabel = fuseDetectionLabel(detection.class, classifierLabels);
            const normalizedLabel = normalizeObjectLabel(fusedLabel);
            if (!normalizedLabel) {
                continue;
            }
            const category = normalizeObjectCategory(normalizedLabel);
            const salience = salienceScore(normalizedBox, detection.score, normalizedLabel);
            objects.push({
                id: `object-${objects.length + 1}`,
                label: fusedLabel,
                normalizedLabel,
                category,
                boundingBox: normalizedBox,
                confidence: detection.score,
                salience,
                attributes: classifierLabels,
                detectorLabel: detection.class,
                classifierLabels
            });
        }
        return objects.sort((a, b) => b.salience - a.salience);
    }
    async classifyCrop(input, box, runtime) {
        const crop = (this.options.createCropInput ?? createCropInput)(input, box);
        if (!crop || !runtime.classifier) {
            return [];
        }
        try {
            const classifications = await scoped(runtime.tf, () => runtime.classifier?.classify(crop) ?? Promise.resolve([]));
            return classifications
                .filter((classification) => classification.probability >= 0.12)
                .slice(0, 3)
                .map((classification) => normalizedAttribute(classification.className))
                .filter((label) => typeof label === "string" && !isHumanObjectLabel(label));
        }
        catch {
            return [];
        }
    }
    now() {
        return this.options.now?.() ?? Date.now();
    }
}
function orderObjectsForPrompt(objects, relationships) {
    const relationshipSubjectIds = new Set(relationships.map((relationship) => relationship.subjectObjectId));
    return [...objects].sort((a, b) => {
        const relationshipSubjectDelta = Number(relationshipSubjectIds.has(b.id)) - Number(relationshipSubjectIds.has(a.id));
        if (relationshipSubjectDelta !== 0) {
            return relationshipSubjectDelta;
        }
        return b.salience - a.salience;
    });
}
async function injectedRuntime(detector, classifier, now) {
    const start = now();
    return {
        detector,
        classifier,
        detectorName: "mock-coco-ssd",
        classifierName: classifier ? "mock-mobilenet" : null,
        backend: "mock",
        modelLoadMs: now() - start
    };
}
async function loadBrowserRuntime(now = Date.now) {
    const startedAt = now();
    const tf = await importExternal(TFJS_URL);
    if (tf.setBackend) {
        await tf.setBackend("webgl").catch(() => tf.setBackend?.("wasm").catch(() => tf.setBackend?.("cpu").catch(() => false)));
    }
    await tf.ready?.();
    const [cocoSsd, mobilenet] = await Promise.all([
        importExternal(COCO_SSD_URL),
        importExternal(MOBILENET_URL)
    ]);
    const [detector, classifier] = await Promise.all([
        cocoSsd.load({ base: "lite_mobilenet_v2" }),
        mobilenet.load({ version: 1, alpha: 0.25 })
    ]);
    return {
        tf,
        detector,
        classifier,
        detectorName: "COCO-SSD lite_mobilenet_v2",
        classifierName: "MobileNet v1 0.25 224",
        backend: tf.getBackend?.() ?? "unknown",
        modelLoadMs: now() - startedAt
    };
}
async function importExternal(url) {
    return await import(url);
}
function normalizeDetectorBox(bbox, width, height) {
    const [x, y, boxWidth, boxHeight] = bbox;
    if (![x, y, boxWidth, boxHeight, width, height].every(Number.isFinite) || width <= 0 || height <= 0 || boxWidth <= 0 || boxHeight <= 0) {
        return null;
    }
    const left = clamp01(x / width);
    const top = clamp01(y / height);
    const right = clamp01((x + boxWidth) / width);
    const bottom = clamp01((y + boxHeight) / height);
    const normalizedWidth = right - left;
    const normalizedHeight = bottom - top;
    if (normalizedWidth <= 0 || normalizedHeight <= 0) {
        return null;
    }
    return {
        x: round01(left),
        y: round01(top),
        width: round01(normalizedWidth),
        height: round01(normalizedHeight)
    };
}
export function salienceScore(box, confidence, normalizedLabel) {
    const area = box.width * box.height;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const distance = Math.hypot(centerX - 0.5, centerY - 0.5) / Math.SQRT1_2;
    const centerWeight = 1 - clamp01(distance);
    const areaWeight = clamp01(Math.sqrt(area) * 2.2);
    const specificity = /\b(hedgehog plushie|wheelchair|laptop|motorcycle|bicycle|plastic drink bottle)\b/.test(normalizedLabel) ? 1 : 0.45;
    return round01((clamp01(confidence) * 0.38) + (areaWeight * 0.34) + (centerWeight * 0.2) + (specificity * 0.08));
}
function shouldClassifyCrop(label, box) {
    const normalized = label.toLowerCase();
    if (/\b(car|automobile|truck|bus|motorcycle|motorbike|bicycle|laptop|cell phone)\b/.test(normalized)) {
        return false;
    }
    const area = box.width * box.height;
    return /\b(teddy bear|bear|animal|dog|cat|bird|sports ball|bottle|cup|cell phone|laptop)\b/.test(normalized)
        || area >= 0.08;
}
function fuseDetectionLabel(detectorLabel, classifierLabels) {
    const detector = detectorLabel.toLowerCase();
    const evidence = `${detectorLabel} ${classifierLabels.join(" ")}`.toLowerCase();
    if (/\b(car|automobile|sedan|sports car|minivan|suv|truck|bus)\b/.test(detector)) {
        return "car";
    }
    if (/\b(laptop|notebook computer)\b/.test(detector)) {
        return "laptop";
    }
    if (/\b(teddy bear|bear)\b/.test(detector) && /\b(hedgehog|porcupine)\b/.test(evidence) && /\b(plush|toy|stuffed|stuffed animal)\b/.test(evidence)) {
        return "hedgehog stuffed animal";
    }
    if (/\b(teddy bear|bear)\b/.test(detector)) {
        return "plush toy";
    }
    if (/\b(laptop|notebook computer)\b/.test(evidence)) {
        return "laptop";
    }
    if (/\b(car|automobile|sedan|sports car|minivan|suv|truck|bus)\b/.test(evidence)) {
        return "car";
    }
    return detectorLabel;
}
function normalizedAttribute(value) {
    const normalized = value
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
    return normalized || null;
}
export function deriveRelationships(objects) {
    const relationships = [];
    const seen = new Set();
    for (const subject of objects) {
        for (const object of objects) {
            if (subject.id === object.id || !subject.boundingBox || !object.boundingBox) {
                continue;
            }
            const predicate = relationshipFor(subject, object);
            if (!predicate) {
                continue;
            }
            const relationshipSubject = predicate === "under" ? object : subject;
            const relationshipObject = predicate === "under" ? subject : object;
            const relationshipSubjectBox = relationshipSubject.boundingBox;
            const relationshipObjectBox = relationshipObject.boundingBox;
            if (!relationshipSubjectBox || !relationshipObjectBox) {
                continue;
            }
            const canonicalPredicate = predicate === "under" ? "on-top-of" : predicate;
            const inverseKey = `${relationshipObject.id}|${inversePredicate(canonicalPredicate)}|${relationshipSubject.id}`;
            const key = `${relationshipSubject.id}|${canonicalPredicate}|${relationshipObject.id}`;
            if (seen.has(key) || seen.has(inverseKey)) {
                continue;
            }
            seen.add(key);
            relationships.push({
                subjectObjectId: relationshipSubject.id,
                predicate: canonicalPredicate,
                objectObjectId: relationshipObject.id,
                confidence: relationshipConfidence(relationshipSubjectBox, relationshipObjectBox, canonicalPredicate)
            });
        }
    }
    return relationships.slice(0, 10);
}
function relationshipFor(subject, object) {
    const a = subject.boundingBox;
    const b = object.boundingBox;
    if (!a || !b) {
        return null;
    }
    if (containsBox(b, a)) {
        return "inside";
    }
    if (isOnTopOf(a, b)) {
        return "on-top-of";
    }
    if (isOnTopOf(b, a)) {
        return "under";
    }
    if (isNextTo(a, b)) {
        return "next-to";
    }
    if (isAttachedTo(a, b)) {
        return "attached-to";
    }
    return null;
}
function isOnTopOf(subject, object) {
    const subjectBottom = subject.y + subject.height;
    const objectTop = object.y;
    const objectUpperBand = object.y + object.height * 0.38;
    const gap = objectTop - subjectBottom;
    const overlap = horizontalOverlap(subject, object);
    const supportWidth = Math.min(subject.width, object.width);
    const areaSubject = subject.width * subject.height;
    const areaObject = object.width * object.height;
    return centerY(subject) < centerY(object)
        && overlap >= supportWidth * 0.28
        && subjectBottom >= objectTop - Math.max(0.06, object.height * 0.16)
        && subjectBottom <= objectUpperBand
        && gap <= Math.max(0.06, object.height * 0.18)
        && areaSubject <= areaObject * 0.85;
}
function isNextTo(a, b) {
    const vertical = verticalOverlap(a, b);
    const minHeight = Math.min(a.height, b.height);
    const horizontalGap = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
    return vertical >= minHeight * 0.35
        && horizontalGap > 0
        && horizontalGap <= Math.max(0.08, Math.min(a.width, b.width) * 0.75);
}
function isAttachedTo(a, b) {
    const iou = intersectionOverUnion(a, b);
    return iou > 0.08 && !containsBox(a, b) && !containsBox(b, a);
}
export function intersectionOverUnion(a, b) {
    const intersectionWidth = horizontalOverlap(a, b);
    const intersectionHeight = verticalOverlap(a, b);
    const intersection = intersectionWidth * intersectionHeight;
    const union = (a.width * a.height) + (b.width * b.height) - intersection;
    return union <= 0 ? 0 : intersection / union;
}
export function horizontalOverlap(a, b) {
    return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
}
export function verticalOverlap(a, b) {
    return Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}
export function containsBox(outer, inner) {
    return inner.x >= outer.x
        && inner.y >= outer.y
        && inner.x + inner.width <= outer.x + outer.width
        && inner.y + inner.height <= outer.y + outer.height;
}
function relationshipConfidence(a, b, predicate) {
    if (predicate === "inside") {
        return 0.82;
    }
    if (predicate === "next-to") {
        return 0.62;
    }
    if (predicate === "attached-to") {
        return 0.58;
    }
    const support = horizontalOverlap(a, b) / Math.max(0.001, Math.min(a.width, b.width));
    return round01(0.55 + clamp01(support) * 0.35);
}
function inversePredicate(predicate) {
    if (predicate === "on-top-of") {
        return "under";
    }
    if (predicate === "under") {
        return "on-top-of";
    }
    return null;
}
async function createAnalysisInput(source, maxDimension) {
    if (typeof document === "undefined" || typeof Image === "undefined") {
        return {
            image: {},
            width: source.width,
            height: source.height,
            dispose: () => undefined
        };
    }
    const image = await loadImage(source.dataUrl);
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Canvas 2D context unavailable for local object analysis");
    }
    context.drawImage(image, 0, 0, width, height);
    return {
        image: canvas,
        width,
        height,
        dispose: () => {
            canvas.width = 1;
            canvas.height = 1;
        }
    };
}
function createCropInput(input, box) {
    if (typeof document === "undefined" || !(input.image instanceof HTMLCanvasElement)) {
        return null;
    }
    const sourceX = Math.max(0, Math.floor(box.x * input.width));
    const sourceY = Math.max(0, Math.floor(box.y * input.height));
    const sourceWidth = Math.max(1, Math.ceil(box.width * input.width));
    const sourceHeight = Math.max(1, Math.ceil(box.height * input.height));
    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const context = canvas.getContext("2d");
    if (!context) {
        return null;
    }
    context.drawImage(input.image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
    return canvas;
}
function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Source image failed to decode for local object analysis"));
        image.src = dataUrl;
    });
}
function buildMetrics(metrics) {
    return {
        ...metrics,
        detectorInferenceMs: Math.max(0, Math.round(metrics.detectorInferenceMs)),
        classifierInferenceMs: metrics.classifierInferenceMs === undefined ? undefined : Math.max(0, Math.round(metrics.classifierInferenceMs)),
        relationshipInferenceMs: Math.max(0, Math.round(metrics.relationshipInferenceMs)),
        totalObjectAnalysisMs: Math.max(0, Math.round(metrics.totalObjectAnalysisMs)),
        modelLoadMs: metrics.modelLoadMs === undefined ? undefined : Math.max(0, Math.round(metrics.modelLoadMs))
    };
}
function withTimeout(promise, timeoutMs, label) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = globalThis.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (timeoutId !== undefined) {
            globalThis.clearTimeout(timeoutId);
        }
    });
}
async function scoped(tf, fn) {
    const engine = tf?.engine?.();
    engine?.startScope?.();
    try {
        return await fn();
    }
    finally {
        engine?.endScope?.();
    }
}
function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}
function round01(value) {
    return Math.round(clamp01(value) * 1000) / 1000;
}
function centerY(box) {
    return box.y + box.height / 2;
}
export const LOCAL_CNN_MODEL_INFO = {
    provider: PROVIDER_ID,
    detector: "COCO-SSD lite_mobilenet_v2",
    classifier: "MobileNet v1 0.25 224",
    runtime: "TensorFlow.js 4.22.0",
    minConfidence: MIN_OBJECT_CONFIDENCE,
    maxAnalysisDimension: OBJECT_ANALYSIS_MAX_DIMENSION,
    approximateDownload: "roughly 8-12 MB compressed across TensorFlow.js runtime, COCO-SSD lite, and MobileNet 0.25 model assets"
};
