import type { ObjectAnalysis, SourcePhotoReference } from "../types.js";

export interface ObjectAnalyzer {
  analyze(source: SourcePhotoReference): Promise<ObjectAnalysis>;
}
