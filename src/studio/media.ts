import { LEVEL_STEP, uid } from "./model";
import type { Asset, AssetKind, Project, Thumb } from "./types";

const THUMB_HEIGHT = 96;
/** Files larger than this skip waveform decoding to keep memory in check. */
const MAX_DECODE_BYTES = 400 * 1024 * 1024;

export class ImportError extends Error {}

export function kindOf(file: File): AssetKind | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "webm", "m4v", "mkv"].includes(ext)) return "video";
  if (["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext)) return "image";
  if (["mp3", "wav", "m4a", "aac", "ogg", "flac", "opus"].includes(ext)) return "audio";
  return null;
}

const once = (el: EventTarget, ok: string, timeoutMs = 15000) =>
  new Promise<void>((resolve, reject) => {
    const done = (fn: () => void) => { clearTimeout(timer); el.removeEventListener(ok, onOk); el.removeEventListener("error", onErr); fn(); };
    const onOk = () => done(resolve);
    const onErr = () => done(() => reject(new Error("media error")));
    const timer = setTimeout(() => done(() => reject(new Error("timeout"))), timeoutMs);
    el.addEventListener(ok, onOk);
    el.addEventListener("error", onErr);
  });

/** Browser-recorded WebM files report Infinity until the end is probed. */
async function resolveDuration(el: HTMLMediaElement): Promise<number> {
  if (Number.isFinite(el.duration)) return el.duration;
  el.currentTime = 1e101;
  try { await once(el, "durationchange", 5000); } catch { /* fall through */ }
  const d = el.duration;
  el.currentTime = 0;
  try { await once(el, "seeked", 5000); } catch { /* ignore */ }
  return d;
}

function snapshot(source: CanvasImageSource, w: number, h: number): string {
  const c = document.createElement("canvas");
  c.height = THUMB_HEIGHT;
  c.width = Math.max(1, Math.round((w / h) * THUMB_HEIGHT));
  c.getContext("2d")!.drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}

async function probeVideo(url: string): Promise<{ duration: number; width: number; height: number; thumbs: Thumb[] }> {
  const v = document.createElement("video");
  v.muted = true;
  v.preload = "auto";
  v.playsInline = true;
  v.src = url;
  try {
    await once(v, "loadeddata");
  } catch {
    throw new ImportError("This video format can't be played in your browser. Try MP4 (H.264) or WebM.");
  }
  const duration = await resolveDuration(v);
  if (!Number.isFinite(duration) || duration <= 0 || !v.videoWidth) throw new ImportError("Couldn't read this video's length or picture.");
  const count = Math.min(24, Math.max(1, Math.ceil(duration / 2)));
  const thumbs: Thumb[] = [];
  for (let i = 0; i < count; i++) {
    const t = Math.min(duration - 0.05, ((i + 0.5) * duration) / count);
    v.currentTime = t;
    try { await once(v, "seeked", 5000); } catch { break; }
    thumbs.push({ t, url: snapshot(v, v.videoWidth, v.videoHeight) });
  }
  const result = { duration, width: v.videoWidth, height: v.videoHeight, thumbs };
  v.removeAttribute("src");
  v.load();
  return result;
}

async function probeImage(url: string) {
  const img = new Image();
  img.src = url;
  try { await img.decode(); } catch { throw new ImportError("This image couldn't be opened."); }
  return { width: img.naturalWidth, height: img.naturalHeight, thumbs: [{ t: 0, url: snapshot(img, img.naturalWidth, img.naturalHeight) }] };
}

async function probeAudioDuration(url: string): Promise<number> {
  const a = document.createElement("audio");
  a.preload = "metadata";
  a.src = url;
  try { await once(a, "loadedmetadata"); } catch { throw new ImportError("This audio format can't be played in your browser."); }
  const d = await resolveDuration(a);
  if (!Number.isFinite(d) || d <= 0) throw new ImportError("Couldn't read this audio file's length.");
  return d;
}

/** RMS loudness per LEVEL_STEP seconds, or undefined if the file has no decodable audio. */
async function measureLevels(file: File): Promise<number[] | undefined> {
  if (file.size > MAX_DECODE_BYTES) return undefined;
  try {
    const rate = 16000;
    const ctx = new OfflineAudioContext(1, rate, rate);
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const step = Math.max(1, Math.round(buf.sampleRate * LEVEL_STEP));
    const chans = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
    const levels: number[] = [];
    for (let i = 0; i < buf.length; i += step) {
      let sum = 0;
      const end = Math.min(buf.length, i + step);
      for (let j = i; j < end; j++) {
        let s = 0;
        for (const ch of chans) s += ch[j];
        s /= chans.length;
        sum += s * s;
      }
      levels.push(Math.round(Math.sqrt(sum / (end - i)) * 10000) / 10000);
    }
    return levels;
  } catch {
    return undefined;
  }
}

export async function importFile(file: File): Promise<{ asset: Asset; file: File }> {
  const kind = kindOf(file);
  if (!kind) throw new ImportError(`${file.name} isn't a video, image or audio file.`);
  const url = URL.createObjectURL(file);
  try {
    const base = { id: uid(), kind, name: file.name, url, size: file.size };
    if (kind === "image") {
      const info = await probeImage(url);
      return { asset: { ...base, duration: 0, hasAudio: false, ...info }, file };
    }
    if (kind === "video") {
      const [info, levels] = await Promise.all([probeVideo(url), measureLevels(file)]);
      return { asset: { ...base, ...info, levels, hasAudio: !!levels }, file };
    }
    const [duration, levels] = await Promise.all([probeAudioDuration(url), measureLevels(file)]);
    return { asset: { ...base, duration, width: 0, height: 0, thumbs: [], levels, hasAudio: true }, file };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/* ---------- Persistence (IndexedDB) ---------- */

let dbName = "kreota-studio";
/** Keeps each signed-in account's projects separate on a shared device. */
export const setStorageUser = (uid: string) => { dbName = `kreota-studio-${uid}`; };
const ASSETS = "assets";
const META = "meta";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(ASSETS);
      req.result.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => { db.close(); resolve(req.result); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error); };
  }));
}

type StoredAsset = Omit<Asset, "url"> & { file: Blob };

export const saveAsset = (asset: Asset, file: Blob) => {
  const { url: _url, ...meta } = asset;
  return tx(ASSETS, "readwrite", (s) => s.put({ ...meta, file } satisfies StoredAsset, asset.id));
};

export const deleteStoredAsset = (id: string) => tx(ASSETS, "readwrite", (s) => s.delete(id));

export const saveProject = (p: Project) => tx(META, "readwrite", (s) => s.put(p, "project"));

export async function loadSession(): Promise<{ project: Project | null; assets: Asset[] }> {
  const [project, stored] = await Promise.all([
    tx<Project | undefined>(META, "readonly", (s) => s.get("project")),
    tx<StoredAsset[]>(ASSETS, "readonly", (s) => s.getAll()),
  ]);
  const assets = stored.map(({ file, ...meta }) => ({ ...meta, url: URL.createObjectURL(file) }));
  return { project: project ?? null, assets };
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
