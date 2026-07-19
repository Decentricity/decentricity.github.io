export const MAX_PRESERVED_OBJECTS = 16;
export const MAX_PRESERVED_RELATIONSHIPS = 10;
export const SUPPORTED_OBJECT_PREDICATES = [
    "on-top-of",
    "under",
    "inside",
    "holding",
    "wearing",
    "attached-to",
    "next-to",
    "in-front-of",
    "behind",
    "surrounding",
    "riding",
    "sitting-on",
    "standing-on",
    "carrying",
    "part-of"
];
const CATEGORIES = [
    "animal",
    "toy",
    "vehicle",
    "furniture",
    "food",
    "plant",
    "clothing",
    "container",
    "electronics",
    "tool",
    "building",
    "natural-feature",
    "other"
];
const HUMAN_LABEL_RE = /\b(person|people|man|woman|child|children|boy|girl|human|face|head|body|adult|teen|baby|infant)\b/i;
function asRecord(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null;
    }
    return value;
}
function stringValue(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function clamp01(value, fallback) {
    const numeric = finiteNumber(value);
    if (numeric === null) {
        return fallback;
    }
    return Math.min(1, Math.max(0, numeric));
}
function normalizedText(value) {
    return value
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}
export function isHumanObjectLabel(label) {
    return HUMAN_LABEL_RE.test(label);
}
export function normalizeObjectLabel(label) {
    const text = normalizedText(label);
    if (!text || isHumanObjectLabel(text)) {
        return null;
    }
    if (/\b(hedgehog|porcupine)\b/.test(text) && /\b(plush|plushie|stuffed|stuffed animal|toy)\b/.test(text)) {
        return "hedgehog plushie";
    }
    if (/\b(macbook|laptop|notebook computer)\b/.test(text)) {
        return "laptop";
    }
    if (/\b(computer mouse|mouse|pointing device)\b/.test(text)) {
        return "mouse";
    }
    if (/\b(wheelchair)\b/.test(text)) {
        return "wheelchair";
    }
    if (/\b(motorbike|motorcycle|scooter)\b/.test(text)) {
        return "motorcycle";
    }
    if (/\b(toyota|honda|suzuki|daihatsu|mitsubishi|bmw|mercedes|tesla|avanza|sedan|hatchback|suv|minivan|pickup|car|automobile|vehicle)\b/.test(text)) {
        return "car";
    }
    if (/\b(bicycle|bike)\b/.test(text)) {
        return "bicycle";
    }
    if (/\b(soft drink|soda|coca cola|coke|water bottle|plastic bottle|drink bottle)\b/.test(text)) {
        return "plastic drink bottle";
    }
    if (/\b(cardboard box|box)\b/.test(text)) {
        return "box";
    }
    return text;
}
export function normalizeObjectCategory(label, category) {
    const candidate = stringValue(category);
    if (candidate && CATEGORIES.includes(candidate)) {
        return candidate;
    }
    const text = normalizedText(label);
    if (/\b(plushie|plush|stuffed animal|toy|doll|figure|figurine)\b/.test(text)) {
        return "toy";
    }
    if (/\b(car|motorcycle|bicycle|truck|bus|train|scooter|vehicle)\b/.test(text)) {
        return "vehicle";
    }
    if (/\b(cat|dog|bird|horse|fish|animal)\b/.test(text)) {
        return "animal";
    }
    if (/\b(chair|table|sofa|bed|desk|cabinet|shelf)\b/.test(text)) {
        return "furniture";
    }
    if (/\b(laptop|mouse|keyboard|phone|camera|television|computer|speaker)\b/.test(text)) {
        return "electronics";
    }
    if (/\b(box|bottle|cup|bag|basket|container)\b/.test(text)) {
        return "container";
    }
    if (/\b(hat|coat|shirt|jacket|shoe|dress)\b/.test(text)) {
        return "clothing";
    }
    if (/\b(tree|plant|flower|grass)\b/.test(text)) {
        return "plant";
    }
    if (/\b(food|bread|rice|fruit|vegetable|meal)\b/.test(text)) {
        return "food";
    }
    if (/\b(building|house|mall|tower|bridge)\b/.test(text)) {
        return "building";
    }
    if (/\b(mountain|river|lake|beach|hill|rock)\b/.test(text)) {
        return "natural-feature";
    }
    if (/\b(tool|hammer|wrench|knife|scissors)\b/.test(text)) {
        return "tool";
    }
    return "other";
}
export function normalizePredicate(predicate) {
    const text = normalizedText(predicate).replace(/\s+/g, " ");
    if (!text) {
        return null;
    }
    if (/(^|\b)(on top of|atop|sitting atop|placed on|resting on|resting atop|on roof of|on the roof of|on hood of|on the hood of)(\b|$)/.test(text)) {
        return "on-top-of";
    }
    if (/\b(under|underneath|below|beneath)\b/.test(text)) {
        return "under";
    }
    if (/\b(inside|within|contained in|inside of|in box|in container)\b/.test(text)) {
        return "inside";
    }
    if (/\b(holding|held by|grasping)\b/.test(text)) {
        return "holding";
    }
    if (/\b(wearing|worn by)\b/.test(text)) {
        return "wearing";
    }
    if (/\b(attached to|fixed to|mounted on|connected to|leaning against)\b/.test(text)) {
        return "attached-to";
    }
    if (/\b(next to|beside|adjacent to|near)\b/.test(text)) {
        return "next-to";
    }
    if (/\b(in front of|before)\b/.test(text)) {
        return "in-front-of";
    }
    if (/\b(behind|in back of)\b/.test(text)) {
        return "behind";
    }
    if (/\b(surrounding|around|encircling)\b/.test(text)) {
        return "surrounding";
    }
    if (/\b(riding|mounted on)\b/.test(text)) {
        return "riding";
    }
    if (/\b(sitting on|seated on)\b/.test(text)) {
        return "sitting-on";
    }
    if (/\b(standing on)\b/.test(text)) {
        return "standing-on";
    }
    if (/\b(carrying|carried by)\b/.test(text)) {
        return "carrying";
    }
    if (/\b(part of|component of|piece of)\b/.test(text)) {
        return "part-of";
    }
    return SUPPORTED_OBJECT_PREDICATES.includes(text)
        ? text
        : null;
}
function normalizedBoundingBox(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const record = asRecord(value);
    if (!record) {
        return null;
    }
    const x = finiteNumber(record.x);
    const y = finiteNumber(record.y);
    const width = finiteNumber(record.width);
    const height = finiteNumber(record.height);
    if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
        return null;
    }
    return { x, y, width, height };
}
function normalizeObject(raw, fallbackIndex) {
    const label = stringValue(raw.label) ?? stringValue(raw.normalizedLabel);
    if (!label) {
        return null;
    }
    const normalizedLabel = normalizeObjectLabel(stringValue(raw.normalizedLabel) ?? label);
    if (!normalizedLabel) {
        return null;
    }
    const rawAttributes = Array.isArray(raw.attributes) ? raw.attributes : [];
    const attributes = [...new Set(rawAttributes
            .map((attribute) => stringValue(attribute))
            .filter((attribute) => Boolean(attribute))
            .map((attribute) => normalizedText(attribute))
            .filter((attribute) => attribute && !isHumanObjectLabel(attribute)))]
        .slice(0, 8);
    const count = finiteNumber(raw.count);
    return {
        id: stringValue(raw.id) ?? `object-${fallbackIndex + 1}`,
        label,
        normalizedLabel,
        category: normalizeObjectCategory(normalizedLabel, raw.category),
        boundingBox: normalizedBoundingBox(raw.boundingBox),
        confidence: finiteNumber(raw.confidence),
        salience: clamp01(raw.salience, 0.5),
        attributes,
        ...(count !== null && count > 1 ? { count: Math.round(count) } : {})
    };
}
function relationshipKey(relationship) {
    return `${relationship.subjectObjectId}|${relationship.predicate}|${relationship.objectObjectId}`;
}
export function validateObjectAnalysis(raw, provider = "normalized-object-analysis") {
    const record = asRecord(raw);
    if (!record) {
        return {
            objects: [],
            relationships: [],
            provider,
            warnings: ["Object analysis output was malformed."]
        };
    }
    const warnings = Array.isArray(record.warnings)
        ? record.warnings
            .map((warning) => stringValue(warning))
            .filter((warning) => Boolean(warning))
        : [];
    const rawObjects = Array.isArray(record.objects) ? record.objects : [];
    const rawRelationships = Array.isArray(record.relationships) ? record.relationships : [];
    const objectByOriginalId = new Map();
    const objectByNormalizedLabel = new Map();
    const omittedObjects = [];
    rawObjects.forEach((entry, index) => {
        const objectRecord = asRecord(entry);
        if (!objectRecord) {
            warnings.push("Discarded malformed object record.");
            return;
        }
        const object = normalizeObject(objectRecord, index);
        if (!object) {
            const label = stringValue(objectRecord.label) ?? "unknown";
            if (isHumanObjectLabel(label)) {
                warnings.push(`Discarded human-like object label: ${label}.`);
            }
            else {
                warnings.push(`Discarded invalid object label: ${label}.`);
            }
            return;
        }
        const existing = objectByNormalizedLabel.get(object.normalizedLabel);
        const kept = existing && existing.salience >= object.salience ? existing : object;
        if (existing && kept === object) {
            omittedObjects.push({
                label: existing.label,
                normalizedLabel: existing.normalizedLabel,
                reason: "duplicate lower-salience object replaced"
            });
        }
        else if (existing) {
            omittedObjects.push({
                label: object.label,
                normalizedLabel: object.normalizedLabel,
                reason: "duplicate lower-salience object omitted"
            });
        }
        objectByNormalizedLabel.set(object.normalizedLabel, kept);
        objectByOriginalId.set(object.id, kept);
    });
    const dedupedObjects = [...objectByNormalizedLabel.values()];
    const relationships = [];
    const seenRelationships = new Set();
    rawRelationships.forEach((entry) => {
        const relationshipRecord = asRecord(entry);
        if (!relationshipRecord) {
            warnings.push("Discarded malformed relationship record.");
            return;
        }
        const subjectId = stringValue(relationshipRecord.subjectObjectId) ?? stringValue(relationshipRecord.subject);
        const objectId = stringValue(relationshipRecord.objectObjectId) ?? stringValue(relationshipRecord.object);
        const predicateText = stringValue(relationshipRecord.predicate);
        const predicate = predicateText ? normalizePredicate(predicateText) : null;
        const confidence = finiteNumber(relationshipRecord.confidence);
        if (!subjectId || !objectId || !predicate) {
            warnings.push("Discarded malformed object relationship.");
            return;
        }
        if (subjectId === objectId) {
            warnings.push("Discarded self-referential object relationship.");
            return;
        }
        if (confidence !== null && confidence < 0.15) {
            warnings.push("Discarded very low confidence object relationship.");
            return;
        }
        const subject = objectByOriginalId.get(subjectId);
        const object = objectByOriginalId.get(objectId);
        if (!subject || !object || subject.id === object.id) {
            warnings.push("Discarded relationship referencing an omitted object.");
            return;
        }
        const normalizedRelationship = {
            subjectObjectId: subject.id,
            predicate,
            objectObjectId: object.id,
            confidence
        };
        const key = relationshipKey(normalizedRelationship);
        if (seenRelationships.has(key)) {
            return;
        }
        seenRelationships.add(key);
        relationships.push(normalizedRelationship);
    });
    const relationshipCriticalIds = new Set();
    relationships.forEach((relationship) => {
        relationshipCriticalIds.add(relationship.subjectObjectId);
        relationshipCriticalIds.add(relationship.objectObjectId);
    });
    const retainedObjects = dedupedObjects
        .sort((a, b) => {
        const criticalDelta = Number(relationshipCriticalIds.has(b.id)) - Number(relationshipCriticalIds.has(a.id));
        if (criticalDelta !== 0) {
            return criticalDelta;
        }
        return b.salience - a.salience;
    })
        .slice(0, MAX_PRESERVED_OBJECTS);
    const retainedIds = new Set(retainedObjects.map((object) => object.id));
    dedupedObjects.forEach((object) => {
        if (!retainedIds.has(object.id)) {
            omittedObjects.push({
                label: object.label,
                normalizedLabel: object.normalizedLabel,
                reason: "omitted by salience limit"
            });
        }
    });
    const retainedRelationships = relationships
        .filter((relationship) => retainedIds.has(relationship.subjectObjectId) && retainedIds.has(relationship.objectObjectId))
        .slice(0, MAX_PRESERVED_RELATIONSHIPS);
    return {
        objects: retainedObjects,
        relationships: retainedRelationships,
        provider: stringValue(record.provider) ?? provider,
        warnings,
        ...(omittedObjects.length > 0 ? { omittedObjects } : {})
    };
}
export function toPersistedObjectMetadata(analysis) {
    const byId = new Map(analysis.objects.map((object) => [object.id, object]));
    const recognizedObjects = analysis.objects.map((object) => ({
        label: object.normalizedLabel,
        normalizedLabel: object.normalizedLabel,
        category: object.category,
        ...(object.attributes.length > 0 ? { attributes: object.attributes } : {}),
        ...(object.count !== undefined ? { count: object.count } : {})
    }));
    const objectRelationships = analysis.relationships.flatMap((relationship) => {
        const subject = byId.get(relationship.subjectObjectId);
        const object = byId.get(relationship.objectObjectId);
        if (!subject || !object) {
            return [];
        }
        return [{
                subject: subject.normalizedLabel,
                predicate: relationship.predicate,
                object: object.normalizedLabel
            }];
    });
    return {
        recognizedObjects,
        objectRelationships,
        warnings: analysis.warnings,
        ...(analysis.omittedObjects && analysis.omittedObjects.length > 0 ? { omittedObjects: analysis.omittedObjects } : {})
    };
}
