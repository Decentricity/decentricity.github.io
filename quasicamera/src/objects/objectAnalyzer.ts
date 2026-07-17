import type { ObjectAnalysis, SourcePhotoReference } from "../types.js";
import { OpenAIKeyStore } from "../image/keyStore.js";
import { validateObjectAnalysis } from "./objectNormalization.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OBJECT_ANALYSIS_TIMEOUT_MS = 30_000;
const ANALYSIS_MAX_DIMENSION = 1280;
const ANALYSIS_JPEG_QUALITY = 0.82;

export interface ObjectAnalyzer {
  analyze(source: SourcePhotoReference): Promise<ObjectAnalysis>;
}

export class OpenAIObjectAnalyzer implements ObjectAnalyzer {
  constructor(
    private readonly keyStore = new OpenAIKeyStore(),
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly timeoutMs = OBJECT_ANALYSIS_TIMEOUT_MS
  ) {}

  async analyze(source: SourcePhotoReference): Promise<ObjectAnalysis> {
    const key = this.keyStore.getKey();
    const model = this.keyStore.getObjectAnalysisModel();
    const provider = `openai-responses:${model}`;

    if (!key) {
      return {
        objects: [],
        relationships: [],
        provider: "openai-vision-unavailable",
        warnings: ["OpenAI key unavailable; continuing without semantic object constraints."]
      };
    }

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const analysisImage = await createAnalysisDataUrl(source);
      const response = await this.fetchImpl(OPENAI_RESPONSES_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: objectAnalysisPrompt()
                },
                {
                  type: "input_image",
                  image_url: analysisImage
                }
              ]
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "quasicamera_object_analysis",
              strict: true,
              schema: objectAnalysisSchema()
            }
          },
          max_output_tokens: 1800,
          store: false
        })
      });
      const bodyText = await response.text();

      if (!response.ok) {
        return {
          objects: [],
          relationships: [],
          provider,
          warnings: [`Object analysis provider failed with HTTP ${response.status}: ${bodyText.slice(0, 240)}`]
        };
      }

      const data = safeJsonParse(bodyText);
      const outputText = extractResponseText(data);
      if (!outputText) {
        return {
          objects: [],
          relationships: [],
          provider,
          warnings: ["Object analysis provider returned no structured output."]
        };
      }

      const parsed = safeJsonParse(outputText);
      const analysis = validateObjectAnalysis(parsed, provider);
      return {
        ...analysis,
        provider,
        warnings: analysis.warnings
      };
    } catch (error) {
      return {
        objects: [],
        relationships: [],
        provider,
        warnings: [`Object analysis failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

function objectAnalysisPrompt(): string {
  return [
    "Analyze this single still photograph for QuasiCamera semantic-object preservation.",
    "Return strict JSON only.",
    "",
    "Identify only salient non-human objects that materially define the photograph.",
    "Do not emit humans as objects: no person, man, woman, child, face, head, or body records.",
    "Objects interacting with people, such as hats, coats, bicycles, chairs, umbrellas, and bags, may be emitted.",
    "Prioritize large, central, foreground, unusual, intentionally placed, or relationship-critical objects.",
    "Ignore tiny background clutter, unreadable signs, individual leaves, repeated low-importance items, and private identifiers.",
    "Do not request or infer brands, license plates, addresses, personal identity, ethnicity, age, attractiveness, emotion, or sensitive traits.",
    "Normalize labels conservatively: Toyota Avanza or red sedan -> car; hedgehog stuffed animal -> hedgehog plushie; MacBook Pro -> laptop; motorbike -> motorcycle.",
    "Preserve useful specificity when it changes the concept: wheelchair remains wheelchair, hedgehog plushie remains hedgehog plushie.",
    "Detect important object-to-object relationships such as plushie on top of car, cup on table, cat inside box, bicycle leaning against wall, plant beside window, bag attached to bicycle.",
    "Use only the supported relationship predicates in the schema.",
    "Return at most eight objects and ten relationships."
  ].join("\n");
}

function objectAnalysisSchema(): Record<string, unknown> {
  const categoryEnum = [
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
  const predicateEnum = [
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

  return {
    type: "object",
    additionalProperties: false,
    required: ["objects", "relationships", "warnings"],
    properties: {
      objects: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "label", "normalizedLabel", "category", "boundingBox", "confidence", "salience", "attributes", "count"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            normalizedLabel: { type: "string" },
            category: { type: "string", enum: categoryEnum },
            boundingBox: {
              anyOf: [
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["x", "y", "width", "height"],
                  properties: {
                    x: { type: "number" },
                    y: { type: "number" },
                    width: { type: "number" },
                    height: { type: "number" }
                  }
                },
                { type: "null" }
              ]
            },
            confidence: { anyOf: [{ type: "number" }, { type: "null" }] },
            salience: { type: "number" },
            attributes: { type: "array", items: { type: "string" } },
            count: { anyOf: [{ type: "number" }, { type: "null" }] }
          }
        }
      },
      relationships: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["subjectObjectId", "predicate", "objectObjectId", "confidence"],
          properties: {
            subjectObjectId: { type: "string" },
            predicate: { type: "string", enum: predicateEnum },
            objectObjectId: { type: "string" },
            confidence: { anyOf: [{ type: "number" }, { type: "null" }] }
          }
        }
      },
      warnings: {
        type: "array",
        items: { type: "string" }
      }
    }
  };
}

function safeJsonParse(value: string | null): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractResponseText(data: unknown): string | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const record = data as Record<string, unknown>;
  if (typeof record.output_text === "string") {
    return record.output_text;
  }

  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];
    for (const contentItem of content) {
      if (typeof contentItem !== "object" || contentItem === null) {
        continue;
      }
      const contentRecord = contentItem as Record<string, unknown>;
      if (typeof contentRecord.text === "string") {
        return contentRecord.text;
      }
    }
  }

  const choices = Array.isArray(record.choices) ? record.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  return typeof message?.content === "string" ? message.content : null;
}

async function createAnalysisDataUrl(source: SourcePhotoReference): Promise<string> {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return source.dataUrl;
  }

  const maxDimension = Math.max(source.width, source.height);
  if (maxDimension <= ANALYSIS_MAX_DIMENSION && source.dataUrl.length < 3_000_000) {
    return source.dataUrl;
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, ANALYSIS_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(source.dataUrl);
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", ANALYSIS_JPEG_QUALITY));
    };
    image.onerror = () => resolve(source.dataUrl);
    image.src = source.dataUrl;
  });
}
