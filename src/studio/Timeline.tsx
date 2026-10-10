import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type DragEvent } from "react";
import type { Engine } from "./engine";
import Icon from "./icons";
import { clamp, clipDuration, formatTime, layoutMain, LEVEL_STEP, MIN_CLIP, projectDuration } from "./model";
import type { Asset, AudioClip, Project, Selection, TextClip, VisualClip } from "./types";

export const ASSET_MIME = { video: "application/x-kreota-video", image: "application/x-kreota-image", audio: "application/x-kreota-audio" } as const;
const MAX_IMAGE_SECONDS = 600;
const SNAP_PX = 8;

interface Props {
  project: Project;
  assets: Map<string, Asset>;
  engine: Engine | null;
  pps: number;
  selected: Selection;
  onSelect: (s: Selection) => void;
  set: (next: Project | ((p: Project) => Project), opts?: { record?: boolean }) => void;
  checkpoint: () => Project;
  settle: (snap: Project) => void;
  onDropAsset: (assetId: string, target: { lane: "main"; index: number } | { lane: "audio"; start: number }) => void;
}

function drag(e: RPointerEvent, onMove: (dx: number, ev: PointerEvent) => void, onEnd?: (moved: boolean, ev: PointerEvent) => void) {
  const x0 = e.clientX;
  let moved = false;
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - x0;
    if (!moved && Math.abs(dx) < 3) return;
    moved = true;
    onMove(dx, ev);
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    onEnd?.(moved, ev);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

/** Greedily stacks overlapping clips into rows so none hide each other. */
function packRows<T extends { id: string }>(items: T[], start: (c: T) => number, end: (c: T) => number) {
  const rows = new Map<string, number>();
  const ends: number[] = [];
  for (const c of [...items].sort((a, b) => start(a) - start(b))) {
    let r = ends.findIndex((e) => e <= start(c) + 1e-3);
    if (r < 0) { r = ends.length; ends.push(0); }
    ends[r] = end(c);
    rows.set(c.id, r);
  }
  return { rows, count: Math.max(1, ends.length) };
}

const TEXT_ROW = 28;
const AUDIO_ROW = 40;
const ROW_GAP = 2;
const laneHeight = (rows: number, row: number) => rows * row + (rows - 1) * ROW_GAP;

function rulerStep(pps: number) {
  return [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find((s) => s * pps >= 64) ?? 600;
}

export default function Timeline({ project, assets, engine, pps, selected, onSelect, set, checkpoint, settle, onDropAsset }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const ppsRef = useRef(pps);
  ppsRef.current = pps;
  const [viewW, setViewW] = useState(800);
  const [reorder, setReorder] = useState<{ id: string; dx: number; index: number } | null>(null);
  const [dropMark, setDropMark] = useState<{ lane: "main" | "audio"; x: number } | null>(null);

  const placed = useMemo(() => layoutMain(project.main), [project.main]);
  const textRows = useMemo(() => packRows(project.texts, (c) => c.start, (c) => c.start + c.duration), [project.texts]);
  const audioRows = useMemo(() => packRows(project.audio, (c) => c.start, (c) => c.start + c.out - c.in), [project.audio]);
  const textH = laneHeight(textRows.count, TEXT_ROW);
  const audioH = laneHeight(audioRows.count, AUDIO_ROW);
  const duration = projectDuration(project);
  const contentSeconds = Math.max(duration + 8, viewW / pps);
  const width = contentSeconds * pps;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The playhead moves every frame, so it is positioned directly rather than through React state.
  useEffect(() => {
    if (!engine) return;
    const place = (t: number) => {
      const x = t * ppsRef.current;
      if (playheadRef.current) playheadRef.current.style.transform = `translateX(${x}px)`;
      const sc = scrollRef.current;
      if (sc && engine.playing && (x > sc.scrollLeft + sc.clientWidth - 40 || x < sc.scrollLeft)) sc.scrollLeft = Math.max(0, x - 80);
    };
    place(engine.time);
    return engine.onTime(place);
  }, [engine]);

  useEffect(() => {
    if (engine && playheadRef.current) playheadRef.current.style.transform = `translateX(${engine.time * pps}px)`;
  }, [pps, engine]);

  const timeAt = (clientX: number) => {
    const r = innerRef.current!.getBoundingClientRect();
    return Math.max(0, (clientX - r.left) / ppsRef.current);
  };

  const scrub = (e: RPointerEvent) => {
    if (!engine || e.button !== 0) return;
    engine.pause();
    engine.seek(timeAt(e.clientX));
    drag(e, (_dx, ev) => engine.seek(timeAt(ev.clientX)));
  };

  const laneDown = (e: RPointerEvent) => {
    if (e.target !== e.currentTarget) return;
    onSelect(null);
    scrub(e);
  };

  /* ---------- snapping for free-positioned clips ---------- */
  const snapPoints = (excludeId: string) => {
    const pts = [0, engine?.time ?? 0, placed.length ? placed[placed.length - 1].end : 0];
    for (const pl of placed) pts.push(pl.start);
    for (const a of project.audio) if (a.id !== excludeId) pts.push(a.start, a.start + a.out - a.in);
    for (const t of project.texts) if (t.id !== excludeId) pts.push(t.start, t.start + t.duration);
    return pts;
  };
  const snap = (t: number, len: number, pts: number[]) => {
    const tol = SNAP_PX / ppsRef.current;
    let best = t;
    let bestD = tol;
    // Snap either the clip's start or its end onto each point.
    for (const p of pts) {
      for (const cand of [p, p - len]) {
        const d = Math.abs(t - cand);
        if (d < bestD) { bestD = d; best = cand; }
      }
    }
    return Math.max(0, best);
  };

  /* ---------- main track ---------- */
  const mainDown = (e: RPointerEvent, clip: VisualClip, index: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect({ type: "main", id: clip.id });
    const others = placed.filter((pl) => pl.clip.id !== clip.id);
    const targetIndex = (ev: PointerEvent) => {
      const t = timeAt(ev.clientX);
      let i = 0;
      let acc = 0;
      for (const pl of others) {
        const d = pl.end - pl.start;
        if (t > acc + d / 2) i++;
        acc += d;
      }
      return i;
    };
    drag(
      e,
      (dx, ev) => setReorder({ id: clip.id, dx, index: targetIndex(ev) }),
      (moved, ev) => {
        setReorder(null);
        if (!moved) return;
        const to = targetIndex(ev);
        if (to === index) return;
        set((p) => {
          const main = p.main.filter((c) => c.id !== clip.id);
          main.splice(to, 0, clip);
          return { ...p, main };
        });
      },
    );
  };

  const trimMain = (e: RPointerEvent, clip: VisualClip, side: "l" | "r") => {
    e.stopPropagation();
    onSelect({ type: "main", id: clip.id });
    const snapShot = checkpoint();
    const asset = assets.get(clip.assetId);
    const update = (fn: (c: VisualClip) => VisualClip) => set((p) => ({ ...p, main: p.main.map((c) => (c.id === clip.id ? fn(c) : c)) }), { record: false });
    drag(
      e,
      (dx) => {
        const d = (dx / ppsRef.current) * clip.speed;
        if (clip.kind === "image") {
          const out = clamp(clip.out + (side === "r" ? d : -d), MIN_CLIP, MAX_IMAGE_SECONDS);
          update((c) => ({ ...c, out }));
        } else if (side === "l") {
          const inn = clamp(clip.in + d, 0, clip.out - MIN_CLIP * clip.speed);
          update((c) => ({ ...c, in: inn }));
        } else {
          const out = clamp(clip.out + d, clip.in + MIN_CLIP * clip.speed, asset?.duration ?? clip.out);
          update((c) => ({ ...c, out }));
        }
      },
      () => settle(snapShot),
    );
  };

  /* ---------- audio + text tracks ---------- */
  const moveFree = (e: RPointerEvent, kind: "audio" | "text", id: string, start: number, len: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect({ type: kind, id });
    const snapShot = checkpoint();
    const pts = snapPoints(id);
    drag(
      e,
      (dx) => {
        const s = snap(start + dx / ppsRef.current, len, pts);
        if (kind === "audio") set((p) => ({ ...p, audio: p.audio.map((c) => (c.id === id ? { ...c, start: s } : c)) }), { record: false });
        else set((p) => ({ ...p, texts: p.texts.map((c) => (c.id === id ? { ...c, start: s } : c)) }), { record: false });
      },
      () => settle(snapShot),
    );
  };

  const trimAudio = (e: RPointerEvent, clip: AudioClip, side: "l" | "r") => {
    e.stopPropagation();
    onSelect({ type: "audio", id: clip.id });
    const snapShot = checkpoint();
    const max = assets.get(clip.assetId)?.duration ?? clip.out;
    drag(
      e,
      (dx) => {
        const d = dx / ppsRef.current;
        let next: AudioClip;
        if (side === "l") {
          const dd = clamp(d, Math.max(-clip.in, -clip.start), clip.out - clip.in - MIN_CLIP);
          next = { ...clip, in: clip.in + dd, start: clip.start + dd };
        } else {
          next = { ...clip, out: clamp(clip.out + d, clip.in + MIN_CLIP, max) };
        }
        set((p) => ({ ...p, audio: p.audio.map((c) => (c.id === clip.id ? next : c)) }), { record: false });
      },
      () => settle(snapShot),
    );
  };

  const trimText = (e: RPointerEvent, clip: TextClip, side: "l" | "r") => {
    e.stopPropagation();
    onSelect({ type: "text", id: clip.id });
    const snapShot = checkpoint();
    const pts = snapPoints(clip.id);
    const end = clip.start + clip.duration;
    drag(
      e,
      (dx) => {
        const d = dx / ppsRef.current;
        let next: TextClip;
        if (side === "l") {
          const s = clamp(snap(clip.start + d, 0, pts), 0, end - MIN_CLIP);
          next = { ...clip, start: s, duration: end - s };
        } else {
          const e2 = Math.max(clip.start + MIN_CLIP, snap(end + d, 0, pts));
          next = { ...clip, duration: e2 - clip.start };
        }
        set((p) => ({ ...p, texts: p.texts.map((c) => (c.id === clip.id ? next : c)) }), { record: false });
      },
      () => settle(snapShot),
    );
  };

  /* ---------- drops from the media bin ---------- */
  const acceptedKind = (e: DragEvent, lane: "main" | "audio") => {
    const types = Array.from(e.dataTransfer.types);
    if (lane === "main") return types.includes(ASSET_MIME.video) || types.includes(ASSET_MIME.image);
    return types.includes(ASSET_MIME.audio);
  };
  const mainIndexAt = (t: number) => {
    let i = 0;
    for (const pl of placed) if (t > (pl.start + pl.end) / 2) i++;
    return i;
  };
  const onDragOver = (e: DragEvent, lane: "main" | "audio") => {
    if (!acceptedKind(e, lane)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const t = timeAt(e.clientX);
    const x = lane === "main" ? (placed[mainIndexAt(t)]?.start ?? (placed.length ? placed[placed.length - 1].end : 0)) * pps : t * pps;
    setDropMark({ lane, x });
  };
  const onDrop = (e: DragEvent, lane: "main" | "audio") => {
    setDropMark(null);
    if (!acceptedKind(e, lane)) return;
    e.preventDefault();
    const id = e.dataTransfer.getData(lane === "main" ? (e.dataTransfer.types.includes(ASSET_MIME.video) ? ASSET_MIME.video : ASSET_MIME.image) : ASSET_MIME.audio);
    if (!id) return;
    const t = timeAt(e.clientX);
    onDropAsset(id, lane === "main" ? { lane: "main", index: mainIndexAt(t) } : { lane: "audio", start: t });
  };

  const step = rulerStep(pps);
  const ticks = Math.ceil(contentSeconds / step);
  const reorderX = reorder ? (() => {
    const others = placed.filter((pl) => pl.clip.id !== reorder.id);
    let acc = 0;
    for (let i = 0; i < reorder.index && i < others.length; i++) acc += others[i].end - others[i].start;
    return acc * pps;
  })() : 0;

  return (
    <div className="ks-timeline">
      <div className="ks-tl-labels" aria-hidden="true">
        <div className="ks-tl-label ruler" />
        <div className="ks-tl-label text" style={{ height: textH }}><Icon name="text" size={14} />Text</div>
        <div className="ks-tl-label main"><Icon name="video" size={14} />Video</div>
        <div className="ks-tl-label audio" style={{ height: audioH }}><Icon name="music" size={14} />Audio</div>
      </div>
      <div className="ks-tl-scroll" ref={scrollRef}>
        <div className="ks-tl-inner" ref={innerRef} style={{ width }}>
          <div className="ks-ruler" onPointerDown={scrub} role="slider" aria-label="Timeline position" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={0}>
            {Array.from({ length: ticks + 1 }, (_, i) => (
              <span key={i} className="ks-tick" style={{ left: i * step * pps }}>
                {formatTime(i * step)}
              </span>
            ))}
          </div>

          <div className="ks-lane text" style={{ height: textH }} onPointerDown={laneDown}>
            {project.texts.map((c) => (
              <div
                key={c.id}
                className={`ks-clip text ${c.kind}${selected?.id === c.id ? " selected" : ""}`}
                style={{ left: c.start * pps, width: Math.max(4, c.duration * pps), top: textRows.rows.get(c.id)! * (TEXT_ROW + ROW_GAP), height: TEXT_ROW }}
                onPointerDown={(e) => moveFree(e, "text", c.id, c.start, c.duration)}
                title={c.text}
              >
                <i className="ks-handle l" onPointerDown={(e) => trimText(e, c, "l")} />
                <span className="ks-clip-label">{c.kind === "caption" ? "CC · " : ""}{c.text || "Empty text"}</span>
                <i className="ks-handle r" onPointerDown={(e) => trimText(e, c, "r")} />
              </div>
            ))}
          </div>

          <div className="ks-lane main" onPointerDown={laneDown} onDragOver={(e) => onDragOver(e, "main")} onDragLeave={() => setDropMark(null)} onDrop={(e) => onDrop(e, "main")}>
            {!placed.length && <div className="ks-lane-empty">Drag clips here from your media, or press + on a file</div>}
            {placed.map((pl) => {
              const c = pl.clip;
              const asset = assets.get(c.assetId);
              const w = Math.max(4, clipDuration(c) * pps);
              const dragging = reorder?.id === c.id;
              return (
                <div
                  key={c.id}
                  className={`ks-clip main${selected?.id === c.id ? " selected" : ""}${dragging ? " dragging" : ""}`}
                  style={{ left: pl.start * pps, width: w, transform: dragging ? `translateX(${reorder!.dx}px)` : undefined }}
                  onPointerDown={(e) => mainDown(e, c, pl.index)}
                  title={asset?.name}
                >
                  <Filmstrip asset={asset} clip={c} width={w} pps={pps} />
                  {asset?.levels && c.kind === "video" && <Waveform levels={asset.levels} from={c.in} to={c.out} width={w} height={14} className="ks-clip-wave" muted={c.muted} />}
                  <span className="ks-clip-label">
                    {c.muted && <Icon name="mute" size={11} />}
                    {c.speed !== 1 && <b>{c.speed}×</b>}
                    {asset?.name ?? "Missing media"}
                  </span>
                  <span className="ks-clip-dur">{clipDuration(c).toFixed(1)}s</span>
                  {(c.fadeIn > 0 || c.fadeOut > 0) && <span className="ks-fades" style={{ ["--fi" as string]: `${c.fadeIn * pps}px`, ["--fo" as string]: `${c.fadeOut * pps}px` }} />}
                  <i className="ks-handle l" onPointerDown={(e) => trimMain(e, c, "l")} />
                  <i className="ks-handle r" onPointerDown={(e) => trimMain(e, c, "r")} />
                </div>
              );
            })}
            {reorder && <div className="ks-insert" style={{ left: reorderX }} />}
            {dropMark?.lane === "main" && <div className="ks-insert" style={{ left: dropMark.x }} />}
          </div>

          <div className="ks-lane audio" style={{ height: audioH }} onPointerDown={laneDown} onDragOver={(e) => onDragOver(e, "audio")} onDragLeave={() => setDropMark(null)} onDrop={(e) => onDrop(e, "audio")}>
            {project.audio.map((c) => {
              const asset = assets.get(c.assetId);
              const w = Math.max(4, (c.out - c.in) * pps);
              return (
                <div
                  key={c.id}
                  className={`ks-clip audio${selected?.id === c.id ? " selected" : ""}`}
                  style={{ left: c.start * pps, width: w, top: audioRows.rows.get(c.id)! * (AUDIO_ROW + ROW_GAP), height: AUDIO_ROW }}
                  onPointerDown={(e) => moveFree(e, "audio", c.id, c.start, c.out - c.in)}
                  title={asset?.name}
                >
                  {asset?.levels && <Waveform levels={asset.levels} from={c.in} to={c.out} width={w} height={AUDIO_ROW - 2} className="ks-clip-wave full" />}
                  <span className="ks-clip-label"><Icon name="music" size={11} />{asset?.name ?? "Missing audio"}</span>
                  <i className="ks-handle l" onPointerDown={(e) => trimAudio(e, c, "l")} />
                  <i className="ks-handle r" onPointerDown={(e) => trimAudio(e, c, "r")} />
                </div>
              );
            })}
            {dropMark?.lane === "audio" && <div className="ks-insert" style={{ left: dropMark.x }} />}
          </div>

          <div className="ks-playhead" ref={playheadRef} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function Filmstrip({ asset, clip, width, pps }: { asset?: Asset; clip: VisualClip; width: number; pps: number }) {
  if (!asset?.thumbs.length) return <div className="ks-filmstrip empty" />;
  const ratio = asset.width && asset.height ? asset.width / asset.height : 16 / 9;
  const tileW = clamp(ratio * 56, 28, 100);
  const count = Math.min(150, Math.ceil(width / tileW));
  const tiles = Array.from({ length: count }, (_, i) => {
    if (asset.kind === "image") return asset.thumbs[0].url;
    const t = clip.in + ((i + 0.5) * tileW / pps) * clip.speed;
    let best = asset.thumbs[0];
    for (const th of asset.thumbs) if (Math.abs(th.t - t) < Math.abs(best.t - t)) best = th;
    return best.url;
  });
  return (
    <div className="ks-filmstrip">
      {tiles.map((url, i) => <span key={i} style={{ width: tileW, backgroundImage: `url(${url})` }} />)}
    </div>
  );
}

export function Waveform({ levels, from, to, width, height, className, muted }: { levels: number[]; from: number; to: number; width: number; height: number; className?: string; muted?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = Math.min(4000, Math.max(1, Math.round(width)));
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr;
    c.height = height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, height);
    ctx.fillStyle = muted ? "rgba(255,255,255,.25)" : "rgba(205,252,130,.85)";
    const a = Math.floor(from / LEVEL_STEP);
    const b = Math.max(a + 1, Math.ceil(to / LEVEL_STEP));
    const bar = 2;
    for (let x = 0; x < w; x += bar + 1) {
      const i0 = a + Math.floor((x / w) * (b - a));
      const i1 = Math.max(i0 + 1, a + Math.floor(((x + bar) / w) * (b - a)));
      let peak = 0;
      for (let i = i0; i < i1 && i < levels.length; i++) peak = Math.max(peak, levels[i]);
      // Perceptual scaling so quiet speech is still visible.
      const v = Math.min(1, Math.sqrt(peak) * 1.6);
      const h = Math.max(1, v * height);
      ctx.fillRect(x, (height - h) / 2, bar, h);
    }
  }, [levels, from, to, w, height, muted]);
  return <canvas ref={ref} className={className} style={{ width: w, height }} />;
}
