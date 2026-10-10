import type { Asset, AudioClip, Aspect, Project, Selection, TextClip, VisualClip } from "./types";

export const FPS = 30;
/** Seconds of source audio per entry in Asset.levels. */
export const LEVEL_STEP = 0.05;
export const MIN_CLIP = 0.2;
export const IMAGE_DEFAULT = 3;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function newProject(): Project {
  return { version: 1, name: "Untitled edit", aspect: "9:16", fit: "fill", background: "#000000", masterVolume: 1, safeArea: true, main: [], audio: [], texts: [] };
}

export function aspectSize(aspect: Aspect, short: number): { w: number; h: number } {
  const even = (n: number) => Math.round(n / 2) * 2;
  switch (aspect) {
    case "9:16": return { w: short, h: even((short * 16) / 9) };
    case "1:1": return { w: short, h: short };
    case "4:5": return { w: short, h: even((short * 5) / 4) };
    case "16:9": return { w: even((short * 16) / 9), h: short };
  }
}

export const clipDuration = (c: VisualClip) => (c.out - c.in) / c.speed;

export interface Placed { clip: VisualClip; start: number; end: number; index: number }

export function layoutMain(main: VisualClip[]): Placed[] {
  let t = 0;
  return main.map((clip, index) => {
    const start = t;
    t += clipDuration(clip);
    return { clip, start, end: t, index };
  });
}

export const mainEnd = (p: Project) => p.main.reduce((s, c) => s + clipDuration(c), 0);

export function projectDuration(p: Project): number {
  let d = mainEnd(p);
  for (const a of p.audio) d = Math.max(d, a.start + (a.out - a.in));
  for (const t of p.texts) d = Math.max(d, t.start + t.duration);
  return d;
}

/** Source-media time shown by a main clip at timeline time t. */
export const sourceTime = (pl: Placed, t: number) => clamp(pl.clip.in + (t - pl.start) * pl.clip.speed, pl.clip.in, pl.clip.out);

export function formatTime(t: number, withFrames = false): string {
  const safe = Math.max(0, t);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const base = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  if (!withFrames) return base;
  return `${base}.${String(Math.floor((safe % 1) * FPS)).padStart(2, "0")}`;
}

export function makeVisualClip(asset: Asset): VisualClip {
  const isImage = asset.kind === "image";
  return {
    id: uid(), kind: isImage ? "image" : "video", assetId: asset.id, in: 0, out: isImage ? IMAGE_DEFAULT : asset.duration, speed: 1,
    volume: 1, muted: false, fadeIn: 0, fadeOut: 0, scale: 1, x: 0, y: 0, brightness: 1, contrast: 1, saturation: 1,
  };
}

export function makeAudioClip(asset: Asset, start: number): AudioClip {
  return { id: uid(), assetId: asset.id, start, in: 0, out: asset.duration, volume: 0.8, fadeIn: 0, fadeOut: 0 };
}

export type TextPreset = "title" | "hook" | "subtitle" | "cta" | "caption";

export function makeText(preset: TextPreset, start: number): TextClip {
  const base: TextClip = { id: uid(), kind: "title", start, duration: 3, text: "Your text", size: 72, weight: 800, color: "#ffffff", style: "shadow", boxColor: "#111210", y: 0.3, anim: "pop" };
  switch (preset) {
    case "hook": return { ...base, text: "Wait for it…", size: 96, y: 0.22, style: "box", color: "#111210", boxColor: "#cdfc82" };
    case "subtitle": return { ...base, text: "Add a supporting line", size: 52, weight: 500, y: 0.5, anim: "fade" };
    case "cta": return { ...base, text: "Link in bio →", size: 60, weight: 700, y: 0.7, style: "box", color: "#111210", boxColor: "#ffffff" };
    case "caption": return { ...base, kind: "caption", text: "Caption text", size: 54, weight: 700, y: 0.72, duration: 2, style: "box", color: "#ffffff", boxColor: "#111210cc", anim: "none" };
    default: return base;
  }
}

/** Splits whatever the selection points at (or the main clip under the playhead) at time t. */
export function splitAt(p: Project, t: number, sel: Selection): { project: Project; selected: Selection } | null {
  const margin = 0.05;
  if (sel?.type === "text") {
    const c = p.texts.find((x) => x.id === sel.id);
    if (!c || t <= c.start + margin || t >= c.start + c.duration - margin) return null;
    const right: TextClip = { ...c, id: uid(), start: t, duration: c.start + c.duration - t };
    return { project: { ...p, texts: p.texts.flatMap((x) => (x.id === c.id ? [{ ...x, duration: t - x.start }, right] : [x])) }, selected: { type: "text", id: right.id } };
  }
  if (sel?.type === "audio") {
    const c = p.audio.find((x) => x.id === sel.id);
    if (!c) return null;
    const end = c.start + (c.out - c.in);
    if (t <= c.start + margin || t >= end - margin) return null;
    const cut = c.in + (t - c.start);
    const right: AudioClip = { ...c, id: uid(), start: t, in: cut, fadeIn: 0 };
    return { project: { ...p, audio: p.audio.flatMap((x) => (x.id === c.id ? [{ ...x, out: cut, fadeOut: 0 }, right] : [x])) }, selected: { type: "audio", id: right.id } };
  }
  const placed = layoutMain(p.main);
  const target = sel?.type === "main" ? placed.find((pl) => pl.clip.id === sel.id && t > pl.start && t < pl.end) ?? placed.find((pl) => t > pl.start && t < pl.end) : placed.find((pl) => t > pl.start && t < pl.end);
  if (!target || t <= target.start + margin || t >= target.end - margin) return null;
  const cut = sourceTime(target, t);
  const right: VisualClip = { ...target.clip, id: uid(), in: cut, fadeIn: 0 };
  const left: VisualClip = { ...target.clip, out: cut, fadeOut: 0 };
  // An image's "source" range is just its display duration, so both halves start at 0.
  if (target.clip.kind === "image") {
    left.in = 0;
    left.out = cut - target.clip.in;
    right.in = 0;
    right.out = target.clip.out - cut;
  }
  const main = p.main.flatMap((c) => (c.id === target.clip.id ? [left, right] : [c]));
  return { project: { ...p, main }, selected: { type: "main", id: right.id } };
}

export function deleteSelection(p: Project, sel: Selection): Project {
  if (!sel) return p;
  if (sel.type === "main") return { ...p, main: p.main.filter((c) => c.id !== sel.id) };
  if (sel.type === "audio") return { ...p, audio: p.audio.filter((c) => c.id !== sel.id) };
  return { ...p, texts: p.texts.filter((c) => c.id !== sel.id) };
}

export function duplicateSelection(p: Project, sel: Selection): { project: Project; selected: Selection } | null {
  if (!sel) return null;
  const id = uid();
  if (sel.type === "main") {
    const i = p.main.findIndex((c) => c.id === sel.id);
    if (i < 0) return null;
    const main = [...p.main];
    main.splice(i + 1, 0, { ...p.main[i], id });
    return { project: { ...p, main }, selected: { type: "main", id } };
  }
  if (sel.type === "audio") {
    const c = p.audio.find((x) => x.id === sel.id);
    if (!c) return null;
    return { project: { ...p, audio: [...p.audio, { ...c, id, start: c.start + (c.out - c.in) }] }, selected: { type: "audio", id } };
  }
  const c = p.texts.find((x) => x.id === sel.id);
  if (!c) return null;
  return { project: { ...p, texts: [...p.texts, { ...c, id, start: c.start + c.duration }] }, selected: { type: "text", id } };
}

/** Removes quiet stretches from every main-track video clip that has audio levels. */
export function removeSilences(p: Project, assets: Map<string, Asset>, thresholdDb: number, minSilence: number, padding = 0.08): { project: Project; removed: number; cuts: number } {
  const threshold = Math.pow(10, thresholdDb / 20);
  let removed = 0;
  let cuts = 0;
  const main = p.main.flatMap((clip) => {
    const levels = assets.get(clip.assetId)?.levels;
    if (!levels || assets.get(clip.assetId)?.kind !== "video") return [clip];
    const first = Math.floor(clip.in / LEVEL_STEP);
    const last = Math.min(levels.length, Math.ceil(clip.out / LEVEL_STEP));
    const silences: [number, number][] = [];
    let runStart = -1;
    for (let i = first; i <= last; i++) {
      const quiet = i < last && levels[i] < threshold;
      if (quiet && runStart < 0) runStart = i;
      if (!quiet && runStart >= 0) {
        const a = Math.max(clip.in, runStart * LEVEL_STEP);
        const b = Math.min(clip.out, i * LEVEL_STEP);
        if (b - a >= minSilence) silences.push([a, b]);
        runStart = -1;
      }
    }
    if (!silences.length) return [clip];
    const keep: [number, number][] = [];
    let cursor = clip.in;
    for (const [a, b] of silences) {
      const segEnd = a === clip.in ? clip.in : a + padding;
      if (segEnd - cursor >= MIN_CLIP) keep.push([cursor, segEnd]);
      cursor = b === clip.out ? clip.out : b - padding;
    }
    if (clip.out - cursor >= MIN_CLIP) keep.push([cursor, clip.out]);
    if (!keep.length) return [clip];
    const kept = keep.reduce((s, [a, b]) => s + (b - a), 0);
    removed += (clip.out - clip.in - kept) / clip.speed;
    cuts += silences.length;
    return keep.map(([a, b], i) => ({ ...clip, id: i === 0 ? clip.id : uid(), in: a, out: b, fadeIn: i === 0 ? clip.fadeIn : 0, fadeOut: i === keep.length - 1 ? clip.fadeOut : 0 }));
  });
  return { project: { ...p, main }, removed, cuts };
}

function averageLevel(levels: number[], from: number, to: number, floor: number): number | null {
  let sum = 0;
  let n = 0;
  for (let i = Math.floor(from / LEVEL_STEP); i < Math.min(levels.length, Math.ceil(to / LEVEL_STEP)); i++) {
    if (levels[i] > floor) { sum += levels[i] * levels[i]; n++; }
  }
  return n ? Math.sqrt(sum / n) : null;
}

/** Sets each clip's volume so spoken parts land at a similar loudness. */
export function balanceLevels(p: Project, assets: Map<string, Asset>): { project: Project; changed: number } {
  const floor = Math.pow(10, -45 / 20);
  const target = Math.pow(10, -18 / 20);
  let changed = 0;
  const main = p.main.map((c) => {
    const a = assets.get(c.assetId);
    if (!a?.levels || a.kind !== "video") return c;
    const avg = averageLevel(a.levels, c.in, c.out, floor);
    if (!avg) return c;
    changed++;
    return { ...c, volume: Math.round(clamp(target / avg, 0.25, 2) * 100) / 100 };
  });
  const audio = p.audio.map((c) => {
    const a = assets.get(c.assetId);
    if (!a?.levels) return c;
    const avg = averageLevel(a.levels, c.in, c.out, floor);
    if (!avg) return c;
    changed++;
    // Background music sits well under speech.
    return { ...c, volume: Math.round(clamp((target * 0.35) / avg, 0.05, 2) * 100) / 100 };
  });
  return { project: { ...p, main, audio }, changed };
}

/* ---------- Captions: SRT / VTT ---------- */

const parseStamp = (s: string) => {
  const m = s.trim().match(/(?:(\d+):)?(\d+):(\d+)[,.](\d+)/);
  if (!m) return NaN;
  return (Number(m[1] ?? 0) * 3600) + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0").slice(0, 3)) / 1000;
};

export function parseSubtitles(src: string, template: TextClip): TextClip[] {
  const out: TextClip[] = [];
  for (const block of src.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const timing = lines.findIndex((l) => l.includes("-->"));
    if (timing < 0) continue;
    const [a, b] = lines[timing].split("-->");
    const start = parseStamp(a);
    const end = parseStamp(b);
    const text = lines.slice(timing + 1).join("\n").replace(/<[^>]+>/g, "").trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) continue;
    out.push({ ...template, id: uid(), kind: "caption", start, duration: end - start, text });
  }
  return out;
}

export function toSrt(texts: TextClip[]): string {
  const stamp = (t: number) => {
    const ms = Math.round(t * 1000);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  };
  return texts
    .filter((t) => t.kind === "caption")
    .sort((a, b) => a.start - b.start)
    .map((t, i) => `${i + 1}\n${stamp(t.start)} --> ${stamp(t.start + t.duration)}\n${t.text}\n`)
    .join("\n");
}
