import { aspectSize, clamp, layoutMain, projectDuration, sourceTime, type Placed } from "./model";
import type { Asset, Project, TextClip, VisualClip } from "./types";

interface Slot {
  el: HTMLMediaElement;
  assetId: string;
  clipId: string | null;
  source?: MediaElementAudioSourceNode;
  gain?: GainNode;
  playPending: boolean;
}

interface Want {
  clipId: string;
  assetId: string;
  kind: "video" | "audio";
  /** Source time the element should be showing. */
  src: number;
  active: boolean;
  speed: number;
  gain: number;
}

const MAX_SLOTS_PER_ASSET = 6;
const STALL_LIMIT_MS = 2000;

type Listener<T> = (v: T) => void;

export interface ExportOptions {
  short: number;
  fps: number;
  onProgress: (fraction: number) => void;
  signal: AbortSignal;
}

export function pickExportMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["video/mp4;codecs=avc1.42E01F,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

const fadeFactor = (local: number, length: number, fadeIn: number, fadeOut: number) => {
  let f = 1;
  if (fadeIn > 0) f = Math.min(f, local / fadeIn);
  if (fadeOut > 0) f = Math.min(f, (length - local) / fadeOut);
  return clamp(f, 0, 1);
};

export class Engine {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private project: Project | null = null;
  private assets = new Map<string, Asset>();
  private layout: Placed[] = [];
  duration = 0;

  time = 0;
  playing = false;
  private anchorWall = 0;
  private anchorTime = 0;
  private stallSince = 0;
  private dirty = true;
  private raf = 0;
  private short = 720;

  private host: HTMLDivElement;
  private pools = new Map<string, Slot[]>();
  private assigned = new Map<string, Slot>();
  private images = new Map<string, HTMLImageElement>();

  private audioCtx: AudioContext | null = null;
  private master: GainNode | null = null;

  private timeListeners = new Set<Listener<number>>();
  private playListeners = new Set<Listener<boolean>>();
  private stallListeners = new Set<Listener<boolean>>();
  /** True while playback holds the clock waiting for a video to start rolling. */
  stalled = false;
  private lastEmitted = -1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.host = document.createElement("div");
    this.host.setAttribute("aria-hidden", "true");
    this.host.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";
    document.body.appendChild(this.host);
    document.fonts?.ready.then(() => { this.dirty = true; });
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    for (const pool of this.pools.values()) for (const s of pool) this.disposeSlot(s);
    this.pools.clear();
    this.assigned.clear();
    this.host.remove();
    this.audioCtx?.close().catch(() => {});
  }

  /* ---------- public API ---------- */

  onTime(fn: Listener<number>) { this.timeListeners.add(fn); return () => { this.timeListeners.delete(fn); }; }
  onPlayState(fn: Listener<boolean>) { this.playListeners.add(fn); return () => { this.playListeners.delete(fn); }; }
  onStall(fn: Listener<boolean>) { this.stallListeners.add(fn); return () => { this.stallListeners.delete(fn); }; }

  private setStalled(v: boolean) {
    if (v === this.stalled) return;
    this.stalled = v;
    this.stallListeners.forEach((f) => f(v));
  }

  setProject(project: Project, assets: Map<string, Asset>) {
    this.project = project;
    this.assets = assets;
    this.layout = layoutMain(project.main);
    this.duration = projectDuration(project);
    for (const [id, pool] of this.pools) {
      if (!assets.has(id)) {
        for (const s of pool) { if (s.clipId) this.assigned.delete(s.clipId); this.disposeSlot(s); }
        this.pools.delete(id);
      }
    }
    for (const a of assets.values()) {
      if (a.kind === "image" && !this.images.has(a.id)) {
        const img = new Image();
        img.onload = () => { this.dirty = true; };
        img.src = a.url;
        this.images.set(a.id, img);
      }
    }
    this.resize();
    if (this.time > this.duration) this.seek(this.duration);
    this.dirty = true;
  }

  /** Short side of the render resolution in px. */
  setResolution(short: number) {
    this.short = short;
    this.resize();
  }

  play() {
    if (!this.project || this.duration <= 0) return;
    this.ensureAudio();
    if (this.time >= this.duration - 0.01) this.time = 0;
    this.anchor(this.time);
    this.stallSince = 0;
    this.playing = true;
    this.playListeners.forEach((f) => f(true));
  }

  pause() {
    if (!this.playing) return;
    this.time = this.clock();
    this.playing = false;
    this.setStalled(false);
    for (const pool of this.pools.values()) for (const s of pool) { s.el.pause(); s.playPending = false; }
    this.dirty = true;
    this.playListeners.forEach((f) => f(false));
  }

  toggle() { if (this.playing) this.pause(); else this.play(); }

  seek(t: number) {
    this.time = clamp(t, 0, this.duration);
    this.anchor(this.time);
    this.stallSince = 0;
    this.dirty = true;
    this.emitTime(true);
  }

  /** Renders the whole timeline in real time into a video file. */
  async exportVideo(opts: ExportOptions): Promise<Blob> {
    const mime = pickExportMime();
    if (!mime) throw new Error("This browser can't record video. Use a recent Chrome, Edge or Firefox.");
    if (this.duration <= 0) throw new Error("Add something to the timeline first.");
    this.pause();
    this.ensureAudio();
    const ctx = this.audioCtx!;
    const master = this.master!;
    await ctx.resume();
    const previousShort = this.short;
    this.setResolution(opts.short);

    const dest = ctx.createMediaStreamDestination();
    master.connect(dest);
    master.disconnect(ctx.destination);
    const videoStream = this.canvas.captureStream(opts.fps);
    const stream = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const pixels = this.canvas.width * this.canvas.height;
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: pixels >= 1920 * 1080 ? 10_000_000 : 6_000_000, audioBitsPerSecond: 160_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

    const cleanup = () => {
      try { master.disconnect(dest); } catch { /* already gone */ }
      master.connect(ctx.destination);
      stream.getTracks().forEach((t) => t.stop());
      this.setResolution(previousShort);
    };

    try {
      this.seek(0);
      await this.waitUntilReady(4000);
      const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
      // The recorder only runs while the timeline is actually moving, so waits for a
      // video to start rolling don't turn into frozen frames in the file.
      recorder.start(500);
      recorder.pause();
      const offStall = this.onStall((s) => {
        if (s && recorder.state === "recording") recorder.pause();
        if (!s && recorder.state === "paused" && this.playing) recorder.resume();
      });
      this.play();
      await new Promise<void>((resolve) => {
        let started = false;
        const offTime = this.onTime((t) => {
          if (!started && !this.stalled && this.playing) { started = true; if (recorder.state === "paused") recorder.resume(); }
          opts.onProgress(this.duration ? t / this.duration : 1);
        });
        const offPlay = this.onPlayState((p) => { if (!p) { offTime(); offPlay(); resolve(); } });
        opts.signal.addEventListener("abort", () => this.pause(), { once: true });
      });
      offStall();
      // One more frame interval so the encoder takes the final frame.
      await new Promise((r) => setTimeout(r, 1000 / opts.fps));
      recorder.stop();
      await stopped;
    } finally {
      if (recorder.state !== "inactive") recorder.stop();
      cleanup();
    }
    if (opts.signal.aborted) throw new DOMException("Export cancelled", "AbortError");
    return new Blob(chunks, { type: mime.split(";")[0] });
  }

  /* ---------- internals ---------- */

  private clock() {
    return this.playing ? this.anchorTime + (performance.now() - this.anchorWall) / 1000 : this.time;
  }

  private anchor(t: number) {
    this.anchorTime = t;
    this.anchorWall = performance.now();
  }

  private resize() {
    if (!this.project) return;
    const { w, h } = aspectSize(this.project.aspect, this.short);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.dirty = true;
    }
  }

  private emitTime(force = false) {
    if (!force && Math.abs(this.time - this.lastEmitted) < 1e-4) return;
    this.lastEmitted = this.time;
    this.timeListeners.forEach((f) => f(this.time));
  }

  private ensureAudio() {
    if (!this.audioCtx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new Ctx();
      this.master = this.audioCtx.createGain();
      this.master.connect(this.audioCtx.destination);
      for (const pool of this.pools.values()) for (const s of pool) this.connectSlot(s);
    }
    this.audioCtx.resume().catch(() => {});
  }

  private connectSlot(s: Slot) {
    if (!this.audioCtx || !this.master || s.source) return;
    s.source = this.audioCtx.createMediaElementSource(s.el);
    s.gain = this.audioCtx.createGain();
    s.gain.gain.value = 0;
    s.source.connect(s.gain).connect(this.master);
  }

  private disposeSlot(s: Slot) {
    s.el.pause();
    s.el.removeAttribute("src");
    s.el.load();
    s.el.remove();
    s.source?.disconnect();
    s.gain?.disconnect();
  }

  private createSlot(asset: Asset): Slot {
    const el = document.createElement(asset.kind === "video" ? "video" : "audio");
    el.preload = "auto";
    if (el instanceof HTMLVideoElement) el.playsInline = true;
    el.src = asset.url;
    const slot: Slot = { el, assetId: asset.id, clipId: null, playPending: false };
    const mark = () => { this.dirty = true; };
    el.addEventListener("seeked", mark);
    el.addEventListener("loadeddata", mark);
    el.addEventListener("canplay", mark);
    this.host.appendChild(el);
    this.connectSlot(slot);
    return slot;
  }

  private activeMain(t: number): Placed | undefined {
    return this.layout.find((pl) => t >= pl.start && t < pl.end);
  }

  private wanted(t: number): Want[] {
    const p = this.project!;
    const out: Want[] = [];
    const master = p.masterVolume;
    const idx = this.layout.findIndex((pl) => t >= pl.start && t < pl.end);
    for (const pl of [this.layout[idx], this.layout[idx + 1]]) {
      if (!pl || pl.clip.kind !== "video") continue;
      const active = pl === this.layout[idx];
      const c = pl.clip;
      const f = fadeFactor(t - pl.start, pl.end - pl.start, c.fadeIn, c.fadeOut);
      out.push({ clipId: c.id, assetId: c.assetId, kind: "video", src: active ? sourceTime(pl, t) : c.in, active, speed: c.speed, gain: active && !c.muted ? c.volume * f * master : 0 });
    }
    for (const a of p.audio) {
      const len = a.out - a.in;
      const active = t >= a.start && t < a.start + len;
      const soon = this.playing && a.start > t && a.start - t <= 2;
      if (!active && !soon) continue;
      const f = fadeFactor(t - a.start, len, a.fadeIn, a.fadeOut);
      out.push({ clipId: a.id, assetId: a.assetId, kind: "audio", src: active ? a.in + (t - a.start) : a.in, active, speed: 1, gain: active ? a.volume * f * master : 0 });
    }
    return out;
  }

  private sync(t: number) {
    const want = this.wanted(t);
    const ids = new Set(want.map((w) => w.clipId));
    for (const [clipId, slot] of this.assigned) {
      if (!ids.has(clipId)) {
        slot.clipId = null;
        this.assigned.delete(clipId);
        slot.el.pause();
        slot.playPending = false;
        if (slot.gain) slot.gain.gain.value = 0;
      }
    }
    for (const w of want) {
      let slot = this.assigned.get(w.clipId);
      if (!slot) {
        const asset = this.assets.get(w.assetId);
        if (!asset) continue;
        const pool = this.pools.get(w.assetId) ?? [];
        this.pools.set(w.assetId, pool);
        slot = pool.find((s) => s.clipId === null);
        if (!slot) {
          if (pool.length >= MAX_SLOTS_PER_ASSET) continue;
          slot = this.createSlot(asset);
          pool.push(slot);
        }
        slot.clipId = w.clipId;
        this.assigned.set(w.clipId, slot);
      }
      this.syncSlot(slot, w);
    }
  }

  private syncSlot(slot: Slot, w: Want) {
    const el = slot.el;
    const drift = Math.abs(el.currentTime - w.src);
    if (slot.gain && this.audioCtx) slot.gain.gain.setTargetAtTime(w.gain, this.audioCtx.currentTime, 0.012);
    if (el.playbackRate !== w.speed) el.playbackRate = w.speed;
    if (w.active && this.playing) {
      if (el.paused) {
        if (drift > 0.04 && !el.seeking) el.currentTime = w.src;
        if (!slot.playPending && !el.seeking) {
          slot.playPending = true;
          el.play().catch(() => {}).finally(() => { slot.playPending = false; });
        }
      } else if (drift > 0.5 && !el.seeking) {
        el.currentTime = w.src;
      }
      return;
    }
    if (!el.paused) el.pause();
    if (drift > 0.02 && !el.seeking) el.currentTime = w.src;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.project) return;
    if (this.playing) {
      let t = this.clock();
      let stalled = false;
      const pl = this.activeMain(this.time);
      if (pl && pl.clip.kind === "video") {
        const el = this.assigned.get(pl.clip.id)?.el;
        if (el && (el.ended || el.currentTime >= pl.clip.out - 0.005) && !el.seeking && el.readyState >= 2) {
          // Source reached its out point: move on to whatever is next.
          t = Math.max(t, pl.end);
          this.anchor(t);
          this.stallSince = 0;
        } else if (el && !el.paused && !el.seeking && el.readyState >= 3) {
          const vt = pl.start + (el.currentTime - pl.clip.in) / pl.clip.speed;
          if (Math.abs(vt - t) < 0.5) {
            t = Math.max(this.time, vt);
            this.anchor(t);
          }
          this.stallSince = 0;
        } else {
          // Hold the clock while the clip's video gets going, but never forever.
          const now = performance.now();
          if (!this.stallSince) this.stallSince = now;
          if (now - this.stallSince < STALL_LIMIT_MS) {
            t = this.time;
            this.anchor(t);
            stalled = true;
          }
        }
      }
      this.setStalled(stalled);
      this.time = Math.min(t, this.duration);
      if (this.time >= this.duration) {
        this.sync(this.frameTime());
        this.draw(this.frameTime());
        this.emitTime();
        this.pause();
        return;
      }
    }
    const tv = this.frameTime();
    this.sync(tv);
    if (this.playing || this.dirty) {
      this.dirty = false;
      this.draw(tv);
    }
    this.emitTime();
  };

  /** Time used for picture: the very end shows the last frame rather than an empty canvas. */
  private frameTime() {
    return this.duration > 0 && this.time >= this.duration ? Math.max(0, this.duration - 0.001) : this.time;
  }

  /** Resolves once the frame at the current time can be drawn. */
  private waitUntilReady(timeoutMs: number) {
    const started = performance.now();
    return new Promise<void>((resolve) => {
      const check = () => {
        const pl = this.activeMain(this.frameTime());
        const el = pl ? this.assigned.get(pl.clip.id)?.el : undefined;
        const ready = !pl || pl.clip.kind === "image" || (el && el.readyState >= 2 && !el.seeking);
        if (ready || performance.now() - started > timeoutMs) { this.dirty = true; setTimeout(resolve, 60); }
        else setTimeout(check, 40);
      };
      check();
    });
  }

  /* ---------- rendering ---------- */

  private draw(t: number) {
    const p = this.project!;
    const { width: W, height: H } = this.canvas;
    const ctx = this.ctx;
    const pl = this.activeMain(t);

    let source: CanvasImageSource | null = null;
    let sw = 0;
    let sh = 0;
    if (pl) {
      if (pl.clip.kind === "video") {
        const el = this.assigned.get(pl.clip.id)?.el as HTMLVideoElement | undefined;
        if (!el || el.readyState < 2) { this.dirty = true; return; }
        source = el; sw = el.videoWidth; sh = el.videoHeight;
      } else {
        const img = this.images.get(pl.clip.assetId);
        if (!img || !img.complete || !img.naturalWidth) { this.dirty = true; return; }
        source = img; sw = img.naturalWidth; sh = img.naturalHeight;
      }
    }

    ctx.save();
    ctx.fillStyle = p.background;
    ctx.fillRect(0, 0, W, H);
    if (pl && source && sw && sh) this.drawVisual(pl, t, source, sw, sh, W, H);
    ctx.restore();

    for (const tc of p.texts) {
      if (t >= tc.start && t < tc.start + tc.duration) this.drawText(tc, t, W, H);
    }
  }

  private drawVisual(pl: Placed, t: number, source: CanvasImageSource, sw: number, sh: number, W: number, H: number) {
    const c: VisualClip = pl.clip;
    const ctx = this.ctx;
    const base = this.project!.fit === "fill" ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
    const s = base * c.scale;
    const dw = sw * s;
    const dh = sh * s;
    const dx = (W - dw) / 2 + (c.x * W) / 2;
    const dy = (H - dh) / 2 + (c.y * H) / 2;
    ctx.globalAlpha = fadeFactor(t - pl.start, pl.end - pl.start, c.fadeIn, c.fadeOut);
    if (c.brightness !== 1 || c.contrast !== 1 || c.saturation !== 1) {
      ctx.filter = `brightness(${c.brightness}) contrast(${c.contrast}) saturate(${c.saturation})`;
    }
    ctx.drawImage(source, dx, dy, dw, dh);
  }

  private drawText(tc: TextClip, t: number, W: number, H: number) {
    const ctx = this.ctx;
    const k = Math.min(W, H) / 1080;
    const px = tc.size * k;
    const local = t - tc.start;
    let alpha = 1;
    let scale = 1;
    // Entrances only animate during playback, so paused frames always show the text for editing.
    if (this.playing && tc.anim === "fade") alpha = clamp(Math.min(local / 0.25, (tc.duration - local) / 0.25), 0, 1);
    if (this.playing && tc.anim === "pop") {
      const p = clamp(local / 0.22, 0, 1);
      scale = 0.7 + 0.3 * (1 - Math.pow(1 - p, 3)) + Math.sin(p * Math.PI) * 0.06;
      alpha = clamp(local / 0.1, 0, 1);
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${tc.weight} ${px}px Manrope, "DM Sans", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = wrapText(ctx, tc.text, W * 0.84);
    const lh = px * 1.2;
    const total = lines.length * lh;
    ctx.translate(W / 2, tc.y * H);
    ctx.scale(scale, scale);
    lines.forEach((line, i) => {
      const y = -total / 2 + lh * (i + 0.5);
      if (tc.style === "box" && line.trim()) {
        const w = ctx.measureText(line).width;
        const padX = px * 0.3;
        ctx.fillStyle = tc.boxColor;
        ctx.beginPath();
        const x0 = -w / 2 - padX;
        const y0 = y - lh / 2;
        if (ctx.roundRect) ctx.roundRect(x0, y0, w + padX * 2, lh, px * 0.16);
        else ctx.rect(x0, y0, w + padX * 2, lh);
        ctx.fill();
      }
      if (tc.style === "outline") {
        ctx.lineWidth = px * 0.14;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#000";
        ctx.strokeText(line, 0, y);
      }
      if (tc.style === "shadow") {
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = px * 0.3;
        ctx.shadowOffsetY = px * 0.05;
      }
      ctx.fillStyle = tc.color;
      ctx.fillText(line, 0, y);
      ctx.shadowColor = "transparent";
    });
    ctx.restore();
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); continue; }
    let line = words[0];
    for (const word of words.slice(1)) {
      const next = `${line} ${word}`;
      if (ctx.measureText(next).width > maxWidth) { out.push(line); line = word; }
      else line = next;
    }
    out.push(line);
  }
  return out;
}

