import type { AntiCameraFrame } from "../types.js";

const DB_NAME = "con-camera-db";
const STORE_NAME = "frames";
const STORAGE_KEY = "concamera.frames.v1";

export class FrameStorage {
  async loadFrames(): Promise<AntiCameraFrame[]> {
    try {
      const db = await openDb();
      const frames = await getAll(db);
      return frames.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch {
      return this.loadFallback();
    }
  }

  async saveFrame(frame: AntiCameraFrame): Promise<void> {
    try {
      const db = await openDb();
      await putFrame(db, frame);
    } catch {
      const frames = this.loadFallback();
      frames.unshift(frame);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(frames));
    }
  }

  exportMetadata(frames: AntiCameraFrame[]): Blob {
    const metadata = frames.map((frame) => ({
      id: frame.id,
      timestamp: frame.timestamp,
      provider: frame.provider,
      sceneSummary: frame.sceneSummary ?? frame.context.conCamera?.sceneSummary,
      analysisError: frame.analysisError,
      renderVersion: frame.context.conCamera?.renderVersion,
      overlaySettings: frame.context.conCamera?.overlaySettings ?? frame.context.manualSettings,
      recognizedObjects: frame.context.conCamera?.recognizedObjects ?? [],
      objectRelationships: frame.context.conCamera?.objectRelationships ?? [],
      analysisProvider: frame.context.conCamera?.objectAnalysisProvider,
      analysisMetrics: frame.context.conCamera?.objectAnalysisMetrics,
      context: frame.context
    }));

    return new Blob([JSON.stringify(metadata, null, 2)], {
      type: "application/json"
    });
  }

  private loadFallback(): AntiCameraFrame[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as AntiCameraFrame[];
    } catch {
      return [];
    }
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll(db: IDBDatabase): Promise<AntiCameraFrame[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as AntiCameraFrame[]);
    request.onerror = () => reject(request.error);
  });
}

function putFrame(db: IDBDatabase, frame: AntiCameraFrame): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(frame);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
