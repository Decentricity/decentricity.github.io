const DB_NAME = "hedgeyfs";
const DB_VERSION = 2;
const STORE = "files";
const META = "meta";
const KEY_NAME = "cryptoKeyWrapped";
const NOTICE_KEY = "hedgey_encryption_notice_v1";
const DESKTOP_TAGS_ID = "desktopTags";

let dbPromise = null;
let cachedKey = null;
let unlockWait = null;
let unlockResolve = null;

function openDb(){
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("kind", "kind", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(req.error || new Error("Database upgrade blocked"));
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

function withStore(mode, fn){
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let req = null;
    try {
      req = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    if (req) req.onerror = () => reject(req.error);
  }));
}

function withMeta(mode, fn){
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(META, mode);
    const store = tx.objectStore(META);
    let req = null;
    try {
      req = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    if (req) req.onerror = () => reject(req.error);
  }));
}

function bytesToB64(bytes){
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk){
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function b64ToBytes(str){
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function ensureUnlockPromise(){
  if (!unlockWait) {
    unlockWait = new Promise((resolve) => { unlockResolve = resolve; });
  }
  return unlockWait;
}

async function getCryptoKey(){
  if (cachedKey) return cachedKey;
  const existing = await withMeta("readonly", store => store.get(KEY_NAME));
  if (existing && existing.jwk) {
    cachedKey = await crypto.subtle.importKey("jwk", existing.jwk, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
    return cachedKey;
  }
  if (existing && existing.wrapped) {
    return ensureUnlockPromise();
  }
  // First load: generate and store unwrapped key.
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  await withMeta("readwrite", store => store.put({ id: KEY_NAME, jwk }));
  cachedKey = key;
  if (unlockResolve) unlockResolve(key);
  return key;
}

async function deriveKey(passphrase, saltB64, iterations){
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase || ""),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const salt = b64ToBytes(saltB64);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    true,
    ["wrapKey", "unwrapKey"]
  );
}

async function storeWrappedKey(wrapped, saltB64, iterations, wrapIvB64){
  await withMeta("readwrite", store => store.put({
    id: KEY_NAME,
    wrapped,
    salt: saltB64,
    iterations,
    wrapIv: wrapIvB64,
  }));
}

export async function hasWrappedKey(){
  const existing = await withMeta("readonly", store => store.get(KEY_NAME));
  return !!(existing && existing.wrapped);
}

async function getOrCreateRawKey(){
  if (cachedKey) return cachedKey;
  const existing = await withMeta("readonly", store => store.get(KEY_NAME));
  if (existing && existing.jwk) {
    cachedKey = await crypto.subtle.importKey("jwk", existing.jwk, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
    return cachedKey;
  }
  return getCryptoKey();
}

export async function setPassphrase(passphrase){
  const key = await getOrCreateRawKey();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = bytesToB64(salt);
  const iterations = 250000;
  const wrapKey = await deriveKey(passphrase, saltB64, iterations);
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.wrapKey("jwk", key, wrapKey, { name: "AES-GCM", iv: wrapIv });
  await storeWrappedKey(bytesToB64(new Uint8Array(wrapped)), saltB64, iterations, bytesToB64(wrapIv));
  cachedKey = key;
  if (unlockResolve) unlockResolve(key);
  return true;
}

export async function unlockWithPassphrase(passphrase){
  const existing = await withMeta("readonly", store => store.get(KEY_NAME));
  if (!existing || !existing.wrapped || !existing.wrapIv) return false;
  const wrapKey = await deriveKey(passphrase, existing.salt, existing.iterations);
  const wrappedBytes = b64ToBytes(existing.wrapped);
  const wrappedBuf = wrappedBytes.buffer.slice(wrappedBytes.byteOffset, wrappedBytes.byteOffset + wrappedBytes.byteLength);
  const iv = b64ToBytes(existing.wrapIv);
  const key = await crypto.subtle.unwrapKey(
    "jwk",
    wrappedBuf,
    wrapKey,
    { name: "AES-GCM", iv },
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
  cachedKey = key;
  if (unlockResolve) unlockResolve(key);
  return true;
}

function emitEncryptionNotice(){
  if (localStorage.getItem(NOTICE_KEY) === "1") return;
  localStorage.setItem(NOTICE_KEY, "1");
  try{
    if (window?.dispatchEvent) {
      window.dispatchEvent(new Event("hedgey:encryption-notice"));
    }
    if (window?.parent?.window && window.parent !== window) {
      window.parent.window.dispatchEvent(new Event("hedgey:encryption-notice"));
    }
  } catch {}
}

async function encryptBytes(bytes){
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return { iv: bytesToB64(iv), blob: new Blob([cipher]) };
}

async function decryptBlob(blob, ivB64){
  const key = await getCryptoKey();
  const iv = b64ToBytes(ivB64);
  const data = await blob.arrayBuffer();
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new Uint8Array(plain);
}

async function readDesktopTags(){
  const entry = await withMeta("readonly", store => store.get(DESKTOP_TAGS_ID));
  if (!entry || !entry.enc || !entry.blob || !entry.iv) return [];
  try {
    const bytes = await decryptBlob(entry.blob, entry.iv);
    const text = new TextDecoder().decode(bytes);
    const list = JSON.parse(text);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeDesktopTags(list){
  const payload = JSON.stringify(list || []);
  const bytes = new TextEncoder().encode(payload);
  const { iv, blob } = await encryptBytes(bytes);
  await withMeta("readwrite", store => store.put({
    id: DESKTOP_TAGS_ID,
    enc: true,
    iv,
    blob,
    updatedAt: Date.now(),
  }));
  emitEncryptionNotice();
}

export async function listFiles(){
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getFileById(id){
  if (!id) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function uniqueName(name, entries, excludeId){
  const base = (name || "").trim();
  if (!base) return "";
  const taken = new Set(entries.filter(x => x.id !== excludeId).map(x => (x.name || "").toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let i = 2;
  while (taken.has((base + " " + i).toLowerCase())) i++;
  return base + " " + i;
}

export async function saveNote({ id, name, content }){
  const entries = await listFiles();
  const finalName = uniqueName(name, entries, id || null);
  if (!finalName) return null;
  const now = Date.now();
  const encoder = new TextEncoder();
  const { iv, blob } = await encryptBytes(encoder.encode(content || ""));
  const record = {
    id: id || ("n" + Math.random().toString(36).slice(2, 10)),
    name: finalName,
    kind: "note",
    type: "text/plain",
    size: (content || "").length,
    enc: true,
    iv,
    blob,
    updatedAt: now,
  };
  await withStore("readwrite", (store) => store.put(record));
  emitEncryptionNotice();
  return record;
}

export async function saveUpload(file){
  if (!file) return null;
  const entries = await listFiles();
  const finalName = uniqueName(file.name || "Untitled", entries, null);
  if (!finalName) return null;
  const data = new Uint8Array(await file.arrayBuffer());
  const { iv, blob } = await encryptBytes(data);
  const record = {
    id: "f" + Math.random().toString(36).slice(2, 10),
    name: finalName,
    kind: "file",
    type: file.type || "application/octet-stream",
    size: file.size || 0,
    enc: true,
    iv,
    blob,
    updatedAt: Date.now(),
  };
  await withStore("readwrite", (store) => store.put(record));
  emitEncryptionNotice();
  return record;
}

export async function downloadFile(id){
  const record = await getFileById(id);
  if (!record) return false;
  let blob = null;
  if (record.enc && record.blob && record.iv) {
    const bytes = await decryptBlob(record.blob, record.iv);
    blob = new Blob([bytes], { type: record.type || "application/octet-stream" });
  } else if (record.kind === "note") {
    blob = new Blob([record.content || ""], { type: "text/plain" });
  } else {
    blob = record.blob;
  }
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = record.name || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function listNotes(){
  const entries = await listFiles();
  return entries.filter(x => x.kind === "note");
}

export async function listUploads(){
  const entries = await listFiles();
  return entries.filter(x => x.kind === "file");
}

export async function readNoteText(id){
  const record = await getFileById(id);
  if (!record || record.kind !== "note") return null;
  if (record.enc && record.blob && record.iv) {
    const bytes = await decryptBlob(record.blob, record.iv);
    return new TextDecoder().decode(bytes);
  }
  return record.content || "";
}

export async function readFileBlob(id){
  const record = await getFileById(id);
  if (!record) return null;
  if (record.enc && record.blob && record.iv) {
    const bytes = await decryptBlob(record.blob, record.iv);
    return { record, blob: new Blob([bytes], { type: record.type || "application/octet-stream" }) };
  }
  return { record, blob: record.blob || null };
}

export async function listDesktopTags(){
  return readDesktopTags();
}

export async function addDesktopTag(fileId){
  if (!fileId) return false;
  const list = await readDesktopTags();
  if (!list.includes(fileId)) {
    list.push(fileId);
    await writeDesktopTags(list);
  }
  return true;
}
