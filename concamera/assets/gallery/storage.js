const DB_NAME = "con-camera-db";
const STORE_NAME = "frames";
const STORAGE_KEY = "concamera.frames.v1";
export class FrameStorage {
    async loadFrames() {
        try {
            const db = await openDb();
            const frames = await getAll(db);
            return frames.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        }
        catch {
            return this.loadFallback();
        }
    }
    async saveFrame(frame) {
        try {
            const db = await openDb();
            await putFrame(db, frame);
        }
        catch {
            const frames = this.loadFallback();
            frames.unshift(frame);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(frames));
        }
    }
    exportMetadata(frames) {
        const metadata = frames.map((frame) => ({
            id: frame.id,
            timestamp: frame.timestamp,
            provider: frame.provider,
            generatedPrompt: frame.prompt,
            generationError: frame.generationError,
            context: frame.context
        }));
        return new Blob([JSON.stringify(metadata, null, 2)], {
            type: "application/json"
        });
    }
    loadFallback() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return [];
        }
        try {
            return JSON.parse(raw);
        }
        catch {
            return [];
        }
    }
}
function openDb() {
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
function getAll(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
function putFrame(db, frame) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(frame);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}
