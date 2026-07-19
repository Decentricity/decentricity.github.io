import type { ConCameraSettings, ObjectAnalysis, SourcePhotoReference } from "../types.js";

export interface ObjectAnalyzer {
  analyze(source: SourcePhotoReference, settings?: ConCameraSettings): Promise<ObjectAnalysis>;
}
