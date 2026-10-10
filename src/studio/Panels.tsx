import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Engine } from "./engine";
import Icon from "./icons";
import { downloadBlob } from "./media";
import { balanceLevels, clamp, uid, clipDuration, formatTime, layoutMain, mainEnd, makeText, parseSubtitles, projectDuration, removeSilences, toSrt, type TextPreset } from "./model";
import { ASSET_MIME, Waveform } from "./Timeline";
import type { Asset, Aspect, AudioClip, Project, Selection, TextClip, TextStyle, VisualClip } from "./types";

export type StudioTab = "media" | "text" | "captions" | "smart";

export interface PanelProps {
  project: Project;
  assets: Map<string, Asset>;
  set: (next: Project | ((p: Project) => Project), opts?: { record?: boolean }) => void;
  checkpoint: () => Project;
  settle: (snap: Project) => void;
  selected: Selection;
  setSelected: (s: Selection) => void;
  engine: Engine | null;
  notify: (text: string, tone?: "info" | "error") => void;
  importFiles: (files: File[], autoAdd: boolean) => Promise<Asset[]>;
  removeAsset: (id: string) => void;
  addToTimeline: (asset: Asset) => void;
  loadSample: () => void;
  importing: string[];
  doSplit: () => void;
  doDelete: () => void;
  doDuplicate: () => void;
  setTab: (t: StudioTab) => void;
}

const SWATCHES = ["#ffffff", "#111210", "#cdfc82", "#e9e1ff", "#ffeadc", "#e0efff", "#ff5a5f", "#ffd400"];

/** Groups a burst of slider/typing changes into one undo step. */
function useLive({ set, checkpoint, settle }: PanelProps) {
  const snap = useRef<Project | null>(null);
  const begin = () => { if (!snap.current) snap.current = checkpoint(); };
  const end = () => { if (snap.current) { settle(snap.current); snap.current = null; } };
  const edit = (fn: (p: Project) => Project) => set(fn, { record: !snap.current });
  return { begin, end, edit };
}
type Live = ReturnType<typeof useLive>;

function Slider({ label, value, min, max, step, format, onChange, live }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void; live: Live }) {
  return (
    <label className="ks-field">
      <span className="ks-field-head">{label}<output>{format(value)}</output></span>
      <input type="range" min={min} max={max} step={step} value={value} onPointerDown={live.begin} onPointerUp={live.end} onBlur={live.end} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="ks-seg">
      {options.map(([v, l]) => <button key={String(v)} className={v === value ? "on" : ""} onClick={() => onChange(v)} aria-pressed={v === value}>{l}</button>)}
    </div>
  );
}

function Colors({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="ks-field">
      <span className="ks-field-head">{label}</span>
      <div className="ks-swatches">
        {SWATCHES.map((c) => <button key={c} style={{ background: c }} className={value.slice(0, 7).toLowerCase() === c ? "on" : ""} onClick={() => onChange(c)} aria-label={`Colour ${c}`} />)}
        <input type="color" value={value.slice(0, 7)} onChange={(e) => onChange(e.target.value)} aria-label={`Custom ${label.toLowerCase()}`} />
      </div>
    </div>
  );
}

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="ks-section">
      <h4>{title}</h4>
      {hint && <p className="ks-hint">{hint}</p>}
      {children}
    </section>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const secs = (v: number) => `${v.toFixed(1)}s`;

/* ================= Media ================= */

export function MediaPanel({ assets, importFiles, removeAsset, addToTimeline, loadSample, importing }: PanelProps) {
  const list = [...assets.values()];
  return (
    <div className="ks-panel-inner">
      <div className="ks-panel-head">
        <h3>Media</h3>
        <label className="ks-btn sm">
          <Icon name="upload" size={15} /> Import
          <input type="file" multiple accept="video/*,image/*,audio/*" hidden onChange={(e) => { importFiles(Array.from(e.target.files ?? []), false); e.target.value = ""; }} />
        </label>
      </div>
      {importing.length > 0 && (
        <div className="ks-importing">
          {importing.map((n, i) => <div key={n + i}><span className="ks-spinner" />Processing {n}…</div>)}
        </div>
      )}
      {!list.length && !importing.length && (
        <div className="ks-empty">
          <Icon name="media" size={24} />
          <b>No media yet</b>
          <p>Import MP4, MOV or WebM video, photos, and music. Everything stays on this device.</p>
          <button className="ks-link" onClick={loadSample}>Load sample photos</button>
        </div>
      )}
      {list.length > 0 && <p className="ks-hint">Drag onto the timeline, or press + to add to the end.</p>}
      <div className="ks-assets">
        {list.map((a) => (
          <div
            key={a.id}
            className="ks-asset"
            draggable
            onDragStart={(e) => { e.dataTransfer.setData(ASSET_MIME[a.kind], a.id); e.dataTransfer.effectAllowed = "copy"; }}
          >
            <div className="ks-asset-thumb" style={a.thumbs[0] ? { backgroundImage: `url(${a.thumbs[Math.floor(a.thumbs.length / 2)].url})` } : undefined}>
              {a.kind === "audio" && (a.levels ? <Waveform levels={a.levels} from={0} to={a.duration} width={120} height={40} className="ks-asset-wave" /> : <Icon name="music" size={22} />)}
              <span className="ks-asset-dur">{a.kind === "image" ? "Photo" : formatTime(a.duration)}</span>
              <button className="ks-asset-add" onClick={() => addToTimeline(a)} aria-label={`Add ${a.name} to timeline`} title="Add to timeline"><Icon name="plus" size={15} /></button>
            </div>
            <div className="ks-asset-name">
              <Icon name={a.kind === "audio" ? "music" : a.kind} size={12} />
              <span title={a.name}>{a.name}</span>
              <button onClick={() => removeAsset(a.id)} aria-label={`Remove ${a.name}`} title="Remove from project"><Icon name="close" size={12} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= Text ================= */

const PRESETS: [TextPreset, string, string][] = [
  ["hook", "Hook", "Bold opener for the first 3 seconds"],
  ["title", "Title", "Big headline with soft shadow"],
  ["subtitle", "Subtitle", "Lighter supporting line"],
  ["cta", "Call to action", "“Link in bio” style ending"],
];

export function TextPanel(props: PanelProps) {
  const { set, setSelected, engine } = props;
  const add = (preset: TextPreset) => {
    const clip = makeText(preset, engine?.time ?? 0);
    set((p) => ({ ...p, texts: [...p.texts, clip] }));
    setSelected({ type: "text", id: clip.id });
  };
  return (
    <div className="ks-panel-inner">
      <div className="ks-panel-head"><h3>Text</h3></div>
      <p className="ks-hint">Adds at the playhead. Drag text on the preview to move it up or down.</p>
      <div className="ks-presets">
        {PRESETS.map(([id, name, desc]) => (
          <button key={id} className={`ks-preset ${id}`} onClick={() => add(id)}>
            <span className="ks-preset-sample">{name}</span>
            <small>{desc}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================= Captions ================= */

const CAPTION_LOOKS: [string, Partial<TextClip>][] = [
  ["Dark box", { style: "box", color: "#ffffff", boxColor: "#111210cc" }],
  ["Light box", { style: "box", color: "#111210", boxColor: "#ffffff" }],
  ["Outline", { style: "outline", color: "#ffffff" }],
  ["Lime", { style: "box", color: "#111210", boxColor: "#cdfc82" }],
];

export function CaptionsPanel(props: PanelProps) {
  const { project, set, setSelected, engine, notify, selected } = props;
  const live = useLive(props);
  const captions = project.texts.filter((t) => t.kind === "caption").sort((a, b) => a.start - b.start);
  const [activeId, setActiveId] = useState<string | null>(null);
  const capsRef = useRef(captions);
  capsRef.current = captions;

  useEffect(() => {
    if (!engine) return;
    return engine.onTime((t) => {
      const hit = capsRef.current.find((c) => t >= c.start && t < c.start + c.duration);
      setActiveId(hit?.id ?? null);
    });
  }, [engine]);

  const template = (): TextClip => {
    const last = captions[captions.length - 1];
    return last ? { ...last } : makeText("caption", 0);
  };

  const addAtPlayhead = () => {
    const t = engine?.time ?? 0;
    const next = captions.find((c) => c.start > t + 0.05);
    const duration = clamp((next ? next.start : t + 2) - t, 0.4, 2);
    const clip: TextClip = { ...template(), id: uid(), start: t, duration, text: "" };
    set((p) => ({ ...p, texts: [...p.texts, clip] }));
    setSelected({ type: "text", id: clip.id });
    setTimeout(() => document.querySelector<HTMLTextAreaElement>(`[data-caption="${clip.id}"]`)?.focus(), 30);
  };

  const importSubs = async (file: File) => {
    const parsed = parseSubtitles(await file.text(), template());
    if (!parsed.length) { notify("No captions found in that file. Use .srt or .vtt.", "error"); return; }
    set((p) => ({ ...p, texts: [...p.texts.filter((t) => t.kind !== "caption"), ...parsed] }));
    notify(`Imported ${parsed.length} captions.`);
  };

  const applyAll = (patch: Partial<TextClip>) => live.edit((p) => ({ ...p, texts: p.texts.map((t) => (t.kind === "caption" ? { ...t, ...patch } : t)) }));
  const sample = captions[0] ?? makeText("caption", 0);

  return (
    <div className="ks-panel-inner">
      <div className="ks-panel-head"><h3>Captions</h3><button className="ks-btn sm" onClick={addAtPlayhead}><Icon name="plus" size={15} /> Add</button></div>
      <p className="ks-hint">Most viewers watch muted. Type captions at the playhead, or import an .srt from your recording or transcription app.</p>
      <div className="ks-row">
        <label className="ks-btn sm ghost">
          <Icon name="upload" size={14} /> Import .srt / .vtt
          <input type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importSubs(f); e.target.value = ""; }} />
        </label>
        <button className="ks-btn sm ghost" disabled={!captions.length} onClick={() => downloadBlob(new Blob([toSrt(project.texts)], { type: "application/x-subrip" }), "captions.srt")}><Icon name="download" size={14} /> .srt</button>
      </div>

      {captions.length > 0 && (
        <Section title="Caption style">
          <div className="ks-chips">
            {CAPTION_LOOKS.map(([name, patch]) => <button key={name} onClick={() => props.set((p) => ({ ...p, texts: p.texts.map((t) => (t.kind === "caption" ? { ...t, ...patch } : t)) }))}>{name}</button>)}
          </div>
          <Slider label="Size" value={sample.size} min={28} max={110} step={1} format={(v) => `${v}`} onChange={(v) => applyAll({ size: v })} live={live} />
          <Slider label="Position" value={sample.y} min={0.1} max={0.9} step={0.01} format={(v) => (v < 0.4 ? "Top" : v > 0.6 ? "Bottom" : "Middle")} onChange={(v) => applyAll({ y: v })} live={live} />
        </Section>
      )}

      <div className="ks-captions">
        {!captions.length && <div className="ks-empty small"><Icon name="captions" size={22} /><p>No captions yet.</p></div>}
        {captions.map((c) => (
          <div key={c.id} className={`ks-caption${activeId === c.id ? " live" : ""}${selected?.id === c.id ? " selected" : ""}`}>
            <button className="ks-caption-time" onClick={() => { engine?.pause(); engine?.seek(c.start + 0.001); setSelected({ type: "text", id: c.id }); }}>
              {formatTime(c.start, true)}
            </button>
            <textarea
              data-caption={c.id}
              rows={2}
              value={c.text}
              placeholder="Type what's said…"
              onFocus={() => { live.begin(); setSelected({ type: "text", id: c.id }); }}
              onBlur={live.end}
              onChange={(e) => live.edit((p) => ({ ...p, texts: p.texts.map((t) => (t.id === c.id ? { ...t, text: e.target.value } : t)) }))}
            />
            <button className="ks-icon sm" onClick={() => set((p) => ({ ...p, texts: p.texts.filter((t) => t.id !== c.id) }))} aria-label="Delete caption"><Icon name="trash" size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= Smart tools ================= */

interface Check { id: string; ok: boolean; warn?: boolean; title: string; detail: string; fix?: [string, () => void] }

export function SmartPanel(props: PanelProps) {
  const { project, assets, set, notify, setSelected, setTab } = props;
  const [threshold, setThreshold] = useState(-40);
  const [minPause, setMinPause] = useState(0.6);
  const live = useLive(props);
  const hasLevels = project.main.some((c) => c.kind === "video" && assets.get(c.assetId)?.levels);

  const cutSilences = () => {
    const r = removeSilences(project, assets, threshold, minPause);
    if (!r.cuts) { notify("No pauses found at this sensitivity. Try raising the threshold."); return; }
    set(r.project);
    setSelected(null);
    notify(`Removed ${r.cuts} pause${r.cuts > 1 ? "s" : ""} · ${r.removed.toFixed(1)}s shorter. Undo with Ctrl+Z.`);
  };

  const balance = () => {
    const r = balanceLevels(project, assets);
    if (!r.changed) { notify("No clips with audio to balance."); return; }
    set(r.project);
    notify(`Balanced ${r.changed} clip${r.changed > 1 ? "s" : ""}. Music now sits under speech.`);
  };

  const duration = projectDuration(project);
  const end = mainEnd(project);
  const vertical = project.aspect === "9:16";
  const anyAudio = project.main.some((c) => c.kind === "video" && assets.get(c.assetId)?.hasAudio);
  const captionCount = project.texts.filter((t) => t.kind === "caption").length;
  const outOfSafe = project.texts.filter((t) => vertical && (t.y < 0.12 || t.y > 0.78));
  const lowRes = project.main.filter((c) => { const a = assets.get(c.assetId); return a && Math.min(a.width, a.height) < 720; });

  const checks: Check[] = [
    project.main.length
      ? { id: "video", ok: true, title: "Video on the timeline", detail: `${project.main.length} clip${project.main.length > 1 ? "s" : ""} · ${formatTime(end)}` }
      : { id: "video", ok: false, title: "No video yet", detail: "Add clips or photos to the main track.", fix: ["Open media", () => setTab("media")] },
    project.texts.some((t) => t.start < 3)
      ? { id: "hook", ok: true, title: "Hook in the first 3 seconds", detail: "Text appears early to stop the scroll." }
      : { id: "hook", ok: false, warn: true, title: "No hook in the first 3 seconds", detail: "On-screen text at the start lifts retention.", fix: ["Add hook", () => { const c = makeText("hook", 0); set((p) => ({ ...p, texts: [...p.texts, c] })); setSelected({ type: "text", id: c.id }); }] },
    !anyAudio || captionCount
      ? { id: "captions", ok: true, title: "Captions", detail: anyAudio ? `${captionCount} caption${captionCount === 1 ? "" : "s"}` : "No speech audio on the timeline." }
      : { id: "captions", ok: false, warn: true, title: "No captions", detail: "Your clips have sound but no captions.", fix: ["Add captions", () => setTab("captions")] },
    !outOfSafe.length
      ? { id: "safe", ok: true, title: "Text inside the safe zone", detail: vertical ? "Clear of app buttons and captions UI." : "Checked for vertical formats only." }
      : { id: "safe", ok: false, warn: true, title: `${outOfSafe.length} text item${outOfSafe.length > 1 ? "s" : ""} near the edges`, detail: "App UI may cover it on TikTok and Reels.", fix: ["Move inside", () => set((p) => ({ ...p, texts: p.texts.map((t) => ({ ...t, y: clamp(t.y, 0.14, 0.76) })) }))] },
    duration <= end + 0.05 || !project.main.length
      ? { id: "tail", ok: true, title: "No blank frames", detail: "Everything ends with the video." }
      : { id: "tail", ok: false, warn: true, title: `${(duration - end).toFixed(1)}s of blank video at the end`, detail: "Text or music runs past the last clip.", fix: ["Trim to video", () => set((p) => ({ ...p, texts: p.texts.filter((t) => t.start < end - 0.05).map((t) => ({ ...t, duration: Math.min(t.duration, end - t.start) })), audio: p.audio.filter((a) => a.start < end - 0.05).map((a) => ({ ...a, out: Math.min(a.out, a.in + end - a.start) })) }))] },
    vertical && duration > 60
      ? { id: "length", ok: false, warn: true, title: `${formatTime(duration)} long`, detail: "Over 60s: fine for Reels and TikTok, too long for YouTube Shorts." }
      : { id: "length", ok: true, title: "Length fits the format", detail: duration ? formatTime(duration) : "Nothing to measure yet." },
    lowRes.length
      ? { id: "res", ok: false, warn: true, title: `${lowRes.length} low-resolution clip${lowRes.length > 1 ? "s" : ""}`, detail: "Under 720p will look soft when exported." }
      : { id: "res", ok: true, title: "Source quality", detail: "All media is 720p or better." },
  ];
  const passed = checks.filter((c) => c.ok).length;

  return (
    <div className="ks-panel-inner">
      <div className="ks-panel-head"><h3>Smart tools</h3></div>

      <Section title="Smart cut · remove pauses" hint="Finds quiet stretches in your clips' audio and cuts them out. Runs on this device.">
        {hasLevels ? (
          <>
            <Slider label="Silence below" value={threshold} min={-60} max={-20} step={1} format={(v) => `${v} dB`} onChange={setThreshold} live={live} />
            <Slider label="Shortest pause" value={minPause} min={0.3} max={2} step={0.1} format={secs} onChange={setMinPause} live={live} />
            <button className="ks-btn accent full" onClick={cutSilences}><Icon name="spark" size={15} /> Remove pauses</button>
          </>
        ) : <p className="ks-note">Add a video clip with sound to use smart cut.</p>}
      </Section>

      <Section title="Balance audio" hint="Evens out loudness between clips and tucks music under speech.">
        <button className="ks-btn full" onClick={balance} disabled={!project.main.length && !project.audio.length}><Icon name="wave" size={15} /> Balance levels</button>
      </Section>

      <Section title={`Pre-flight checks · ${passed}/${checks.length}`}>
        <ul className="ks-checks">
          {checks.map((c) => (
            <li key={c.id} className={c.ok ? "ok" : c.warn ? "warn" : "bad"}>
              <Icon name={c.ok ? "check" : "alert"} size={14} />
              <div><b>{c.title}</b><span>{c.detail}</span></div>
              {c.fix && <button className="ks-btn xs" onClick={c.fix[1]}>{c.fix[0]}</button>}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/* ================= Properties ================= */

const ASPECTS: [Aspect, string, string][] = [
  ["9:16", "9:16", "Reels · TikTok · Shorts"],
  ["1:1", "1:1", "Square post"],
  ["4:5", "4:5", "Feed portrait"],
  ["16:9", "16:9", "YouTube · web"],
];

export function PropertiesPanel(props: PanelProps) {
  const { project, selected } = props;
  const live = useLive(props);
  if (selected?.type === "main") {
    const c = project.main.find((x) => x.id === selected.id);
    if (c) return <VisualProps {...props} clip={c} live={live} />;
  }
  if (selected?.type === "audio") {
    const c = project.audio.find((x) => x.id === selected.id);
    if (c) return <AudioProps {...props} clip={c} live={live} />;
  }
  if (selected?.type === "text") {
    const c = project.texts.find((x) => x.id === selected.id);
    if (c) return <TextProps {...props} clip={c} live={live} />;
  }
  return <ProjectProps {...props} live={live} />;
}

function PropsHead({ kind, title, onClose }: { kind: string; title: string; onClose?: () => void }) {
  return (
    <div className="ks-props-head">
      <div><span>{kind}</span><h3 title={title}>{title}</h3></div>
      {onClose && <button className="ks-icon sm" onClick={onClose} aria-label="Deselect"><Icon name="close" size={14} /></button>}
    </div>
  );
}

function ClipActions({ doSplit, doDuplicate, doDelete }: PanelProps) {
  return (
    <div className="ks-row ks-clip-actions">
      <button className="ks-btn sm ghost" onClick={doSplit}><Icon name="split" size={14} /> Split</button>
      <button className="ks-btn sm ghost" onClick={doDuplicate}><Icon name="copy" size={14} /> Copy</button>
      <button className="ks-btn sm ghost danger" onClick={doDelete} aria-label="Delete clip"><Icon name="trash" size={14} /></button>
    </div>
  );
}

function ProjectProps(props: PanelProps & { live: Live }) {
  const { project, live, set } = props;
  const edit = (patch: Partial<Project>) => live.edit((p) => ({ ...p, ...patch }));
  const duration = projectDuration(project);
  return (
    <div className="ks-panel-inner">
      <PropsHead kind="PROJECT" title="Format & canvas" />
      <div className="ks-field">
        <span className="ks-field-head">Format</span>
        <div className="ks-aspects">
          {ASPECTS.map(([id, label, desc]) => (
            <button key={id} className={project.aspect === id ? "on" : ""} onClick={() => set((p) => ({ ...p, aspect: id }))} aria-pressed={project.aspect === id}>
              <i className={`ks-ar a${id.replace(":", "x")}`} />
              <b>{label}</b><small>{desc}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="ks-field" role="group" aria-label="Framing"><span className="ks-field-head">Framing</span>
        <Seg value={project.fit} options={[["fill", "Fill frame"], ["fit", "Fit whole"]]} onChange={(v) => set((p) => ({ ...p, fit: v }))} />
      </div>
      <Colors label="Background" value={project.background} onChange={(v) => set((p) => ({ ...p, background: v }))} />
      <Slider label="Master volume" value={project.masterVolume} min={0} max={1.5} step={0.01} format={pct} onChange={(v) => edit({ masterVolume: v })} live={live} />
      <label className="ks-toggle">
        <span>Show safe zone<small>Areas covered by app buttons</small></span>
        <input type="checkbox" checked={project.safeArea} onChange={(e) => set((p) => ({ ...p, safeArea: e.target.checked }))} />
      </label>
      <dl className="ks-stats">
        <div><dt>Length</dt><dd>{formatTime(duration, true)}</dd></div>
        <div><dt>Clips</dt><dd>{project.main.length + project.audio.length}</dd></div>
        <div><dt>Text</dt><dd>{project.texts.length}</dd></div>
      </dl>
      <p className="ks-hint">Select a clip or text on the timeline to edit it.</p>
    </div>
  );
}

function VisualProps(props: PanelProps & { clip: VisualClip; live: Live }) {
  const { clip: c, assets, live, set, setSelected, project } = props;
  const asset = assets.get(c.assetId);
  const edit = (patch: Partial<VisualClip>) => live.edit((p) => ({ ...p, main: p.main.map((x) => (x.id === c.id ? { ...x, ...patch } : x)) }));
  const setNow = (patch: Partial<VisualClip>) => set((p) => ({ ...p, main: p.main.map((x) => (x.id === c.id ? { ...x, ...patch } : x)) }));
  const dur = clipDuration(c);
  const start = layoutMain(project.main).find((pl) => pl.clip.id === c.id)?.start ?? 0;
  return (
    <div className="ks-panel-inner">
      <PropsHead kind={c.kind === "video" ? "VIDEO CLIP" : "PHOTO"} title={asset?.name ?? "Missing media"} onClose={() => setSelected(null)} />
      <dl className="ks-stats">
        <div><dt>Starts</dt><dd>{formatTime(start, true)}</dd></div>
        <div><dt>Length</dt><dd>{dur.toFixed(2)}s</dd></div>
        {c.kind === "video" && <div><dt>Source</dt><dd>{formatTime(c.in)}–{formatTime(c.out)}</dd></div>}
      </dl>
      <ClipActions {...props} />

      {c.kind === "image" && (
        <Slider label="Duration" value={c.out} min={0.5} max={15} step={0.1} format={secs} onChange={(v) => edit({ out: v })} live={live} />
      )}
      {c.kind === "video" && (
        <div className="ks-field" role="group" aria-label="Speed"><span className="ks-field-head">Speed</span>
          <Seg value={c.speed} options={[[0.5, "0.5×"], [1, "1×"], [1.5, "1.5×"], [2, "2×"]]} onChange={(v) => setNow({ speed: v })} />
        </div>
      )}
      {c.kind === "video" && asset?.hasAudio && (
        <Section title="Audio">
          <div className="ks-inline">
            <Slider label="Volume" value={c.volume} min={0} max={2} step={0.01} format={pct} onChange={(v) => edit({ volume: v })} live={live} />
            <button className={`ks-icon${c.muted ? " on" : ""}`} onClick={() => setNow({ muted: !c.muted })} aria-label={c.muted ? "Unmute clip" : "Mute clip"} aria-pressed={c.muted}><Icon name={c.muted ? "mute" : "volume"} /></button>
          </div>
        </Section>
      )}

      <Section title="Transitions">
        <Slider label="Fade in" value={c.fadeIn} min={0} max={Math.min(2, dur / 2)} step={0.05} format={secs} onChange={(v) => edit({ fadeIn: v })} live={live} />
        <Slider label="Fade out" value={c.fadeOut} min={0} max={Math.min(2, dur / 2)} step={0.05} format={secs} onChange={(v) => edit({ fadeOut: v })} live={live} />
      </Section>

      <Section title="Reframe">
        <Slider label="Zoom" value={c.scale} min={0.5} max={3} step={0.01} format={pct} onChange={(v) => edit({ scale: v })} live={live} />
        <Slider label="Move left / right" value={c.x} min={-1} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}`} onChange={(v) => edit({ x: v })} live={live} />
        <Slider label="Move up / down" value={c.y} min={-1} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}`} onChange={(v) => edit({ y: v })} live={live} />
        <button className="ks-link" onClick={() => setNow({ scale: 1, x: 0, y: 0 })}>Reset framing</button>
      </Section>

      <Section title="Adjust">
        <Slider label="Brightness" value={c.brightness} min={0.5} max={1.5} step={0.01} format={pct} onChange={(v) => edit({ brightness: v })} live={live} />
        <Slider label="Contrast" value={c.contrast} min={0.5} max={1.5} step={0.01} format={pct} onChange={(v) => edit({ contrast: v })} live={live} />
        <Slider label="Saturation" value={c.saturation} min={0} max={2} step={0.01} format={pct} onChange={(v) => edit({ saturation: v })} live={live} />
        <button className="ks-link" onClick={() => setNow({ brightness: 1, contrast: 1, saturation: 1 })}>Reset colour</button>
      </Section>
    </div>
  );
}

function AudioProps(props: PanelProps & { clip: AudioClip; live: Live }) {
  const { clip: c, assets, live, setSelected } = props;
  const edit = (patch: Partial<AudioClip>) => live.edit((p) => ({ ...p, audio: p.audio.map((x) => (x.id === c.id ? { ...x, ...patch } : x)) }));
  const len = c.out - c.in;
  return (
    <div className="ks-panel-inner">
      <PropsHead kind="AUDIO" title={assets.get(c.assetId)?.name ?? "Missing audio"} onClose={() => setSelected(null)} />
      <dl className="ks-stats">
        <div><dt>Starts</dt><dd>{formatTime(c.start, true)}</dd></div>
        <div><dt>Length</dt><dd>{len.toFixed(2)}s</dd></div>
      </dl>
      <ClipActions {...props} />
      <Slider label="Volume" value={c.volume} min={0} max={2} step={0.01} format={pct} onChange={(v) => edit({ volume: v })} live={live} />
      <Slider label="Fade in" value={c.fadeIn} min={0} max={Math.min(5, len / 2)} step={0.1} format={secs} onChange={(v) => edit({ fadeIn: v })} live={live} />
      <Slider label="Fade out" value={c.fadeOut} min={0} max={Math.min(5, len / 2)} step={0.1} format={secs} onChange={(v) => edit({ fadeOut: v })} live={live} />
    </div>
  );
}

function TextProps(props: PanelProps & { clip: TextClip; live: Live }) {
  const { clip: c, live, set, setSelected } = props;
  const edit = (patch: Partial<TextClip>) => live.edit((p) => ({ ...p, texts: p.texts.map((x) => (x.id === c.id ? { ...x, ...patch } : x)) }));
  const setNow = (patch: Partial<TextClip>) => set((p) => ({ ...p, texts: p.texts.map((x) => (x.id === c.id ? { ...x, ...patch } : x)) }));
  return (
    <div className="ks-panel-inner">
      <PropsHead kind={c.kind === "caption" ? "CAPTION" : "TEXT"} title={c.text.split("\n")[0] || "Empty text"} onClose={() => setSelected(null)} />
      <label className="ks-field"><span className="ks-field-head">Text</span>
        <textarea rows={3} value={c.text} onFocus={live.begin} onBlur={live.end} onChange={(e) => edit({ text: e.target.value })} />
      </label>
      <ClipActions {...props} />
      <div className="ks-two">
        <label className="ks-field"><span className="ks-field-head">Start (s)</span>
          <input type="number" min={0} step={0.1} value={Number(c.start.toFixed(2))} onChange={(e) => setNow({ start: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        <label className="ks-field"><span className="ks-field-head">Length (s)</span>
          <input type="number" min={0.2} step={0.1} value={Number(c.duration.toFixed(2))} onChange={(e) => setNow({ duration: Math.max(0.2, Number(e.target.value) || 0.2) })} />
        </label>
      </div>
      <Section title="Style">
        <Seg<TextStyle> value={c.style} options={[["shadow", "Shadow"], ["box", "Box"], ["outline", "Outline"]]} onChange={(v) => setNow({ style: v })} />
        <Slider label="Size" value={c.size} min={24} max={180} step={1} format={(v) => `${v}`} onChange={(v) => edit({ size: v })} live={live} />
        <div className="ks-field" role="group" aria-label="Weight"><span className="ks-field-head">Weight</span>
          <Seg<500 | 700 | 800> value={c.weight} options={[[500, "Regular"], [700, "Bold"], [800, "Heavy"]]} onChange={(v) => setNow({ weight: v })} />
        </div>
        <Colors label="Text colour" value={c.color} onChange={(v) => setNow({ color: v })} />
        {c.style === "box" && <Colors label="Box colour" value={c.boxColor} onChange={(v) => setNow({ boxColor: v })} />}
        <Slider label="Vertical position" value={c.y} min={0.04} max={0.96} step={0.005} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => edit({ y: v })} live={live} />
      </Section>
      <div className="ks-field" role="group" aria-label="Entrance"><span className="ks-field-head">Entrance</span>
        <Seg value={c.anim} options={[["none", "None"], ["fade", "Fade"], ["pop", "Pop"]]} onChange={(v) => setNow({ anim: v })} />
      </div>
    </div>
  );
}
