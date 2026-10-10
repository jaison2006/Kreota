import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as RPointerEvent } from "react";
import { Engine, pickExportMime } from "./engine";
import Icon from "./icons";
import { deleteStoredAsset, downloadBlob, importFile, ImportError, loadSession, saveAsset, saveProject, setStorageUser } from "./media";
import { aspectSize, clamp, deleteSelection, duplicateSelection, FPS, formatTime, makeAudioClip, makeText, makeVisualClip, newProject, projectDuration, splitAt } from "./model";
import { CaptionsPanel, MediaPanel, PropertiesPanel, SmartPanel, TextPanel, type PanelProps } from "./Panels";
import Timeline from "./Timeline";
import type { Asset, Project, Selection } from "./types";
import useHistory from "./useHistory";
import "./studio.css";

type Tab = "media" | "text" | "captions" | "smart";
const TABS: [Tab, string, string][] = [["media", "media", "Media"], ["text", "text", "Text"], ["captions", "captions", "Captions"], ["smart", "spark", "Smart tools"]];

const SAMPLE_PHOTOS = [
  ["https://images.unsplash.com/photo-1544168190-79c17527004f?auto=format&fit=crop&w=1080&q=80", "Morning light"],
  ["https://images.unsplash.com/photo-1648662199460-34b7597ba771?auto=format&fit=crop&w=1080&q=80", "Product detail"],
  ["https://images.unsplash.com/photo-1753164597539-af93605a9178?auto=format&fit=crop&w=1080&q=80", "Lifestyle"],
] as const;

type ExportState =
  | { phase: "setup" }
  | { phase: "running"; progress: number }
  | { phase: "done"; url: string; blob: Blob; ext: string }
  | { phase: "error"; message: string };

export default function Studio({ userId }: { userId: string }) {
  setStorageUser(userId);
  const history = useHistory<Project>(newProject());
  const { value: project, set, checkpoint, settle, undo, redo, reset } = history;
  const [assets, setAssets] = useState<Map<string, Asset>>(new Map());
  const [selected, setSelected] = useState<Selection>(null);
  const [tab, setTab] = useState<Tab>("media");
  const [pps, setPps] = useState(48);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [importing, setImporting] = useState<string[]>([]);
  const [toast, setToast] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [fileDrag, setFileDrag] = useState(false);
  const [exporting, setExporting] = useState<ExportState | null>(null);
  const [showKeys, setShowKeys] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageWrapRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const abortRef = useRef<AbortController | null>(null);
  const nameSnap = useRef<Project | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  const notify = useCallback((text: string, tone: "info" | "error" = "info") => setToast({ text, tone }), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.tone === "error" ? 6000 : 3500);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------- engine ---------- */
  useEffect(() => {
    const e = new Engine(canvasRef.current!);
    setEngine(e);
    return () => e.destroy();
  }, []);

  useEffect(() => { engine?.setProject(project, assets); }, [engine, project, assets]);

  /* ---------- load + autosave ---------- */
  useEffect(() => {
    let cancelled = false;
    loadSession()
      .then(({ project: saved, assets: list }) => {
        if (cancelled) { list.forEach((a) => URL.revokeObjectURL(a.url)); return; }
        setAssets(new Map(list.map((a) => [a.id, a])));
        if (saved) reset(saved);
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) { setLoaded(true); setSaveState("error"); } });
    return () => { cancelled = true; };
  }, [reset]);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    const id = setTimeout(() => {
      saveProject(project).then(() => setSaveState("saved")).catch(() => setSaveState("error"));
    }, 600);
    return () => clearTimeout(id);
  }, [project, loaded]);

  /* ---------- stage sizing ---------- */
  useLayoutEffect(() => {
    const el = stageWrapRef.current;
    if (!el) return;
    const fit = () => {
      const { w, h } = aspectSize(projectRef.current.aspect, 1000);
      const cw = el.clientWidth - 24;
      const ch = el.clientHeight - 24;
      const s = Math.max(0, Math.min(cw / w, ch / h));
      setStage({ w: Math.floor(w * s), h: Math.floor(h * s) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project.aspect]);

  /* ---------- media ---------- */
  const addToTimeline = useCallback((asset: Asset, at?: { lane: "main"; index: number } | { lane: "audio"; start: number }) => {
    if (asset.kind === "audio") {
      const start = at?.lane === "audio" ? at.start : engine?.time ?? 0;
      const clip = makeAudioClip(asset, Math.max(0, start));
      set((p) => ({ ...p, audio: [...p.audio, clip] }));
      setSelected({ type: "audio", id: clip.id });
      return;
    }
    const clip = makeVisualClip(asset);
    set((p) => {
      const main = [...p.main];
      main.splice(at?.lane === "main" ? at.index : main.length, 0, clip);
      return { ...p, main };
    });
    setSelected({ type: "main", id: clip.id });
  }, [engine, set]);

  const importFiles = useCallback(async (files: File[], autoAdd: boolean) => {
    const imported: Asset[] = [];
    for (const file of files) {
      setImporting((l) => [...l, file.name]);
      try {
        const { asset } = await importFile(file);
        await saveAsset(asset, file).catch(() => notify("Imported, but couldn't save the file for next time (browser storage is full or blocked).", "error"));
        setAssets((m) => new Map(m).set(asset.id, asset));
        imported.push(asset);
        if (autoAdd) addToTimeline(asset);
      } catch (e) {
        notify(e instanceof ImportError ? e.message : `Couldn't import ${file.name}.`, "error");
      } finally {
        setImporting((l) => { const i = l.indexOf(file.name); return i < 0 ? l : [...l.slice(0, i), ...l.slice(i + 1)]; });
      }
    }
    if (imported.length) notify(`Imported ${imported.length} file${imported.length > 1 ? "s" : ""}.`);
    return imported;
  }, [addToTimeline, notify]);

  const removeAsset = useCallback((id: string) => {
    const p = projectRef.current;
    const used = p.main.some((c) => c.assetId === id) || p.audio.some((c) => c.assetId === id);
    if (used && !window.confirm("This file is used on the timeline. Remove it and its clips?")) return;
    set((q) => ({ ...q, main: q.main.filter((c) => c.assetId !== id), audio: q.audio.filter((c) => c.assetId !== id) }));
    const asset = assetsRef.current.get(id);
    setAssets((m) => { const n = new Map(m); n.delete(id); return n; });
    deleteStoredAsset(id).catch(() => {});
    if (asset) setTimeout(() => URL.revokeObjectURL(asset.url), 1000);
  }, [set]);

  const loadSample = useCallback(async () => {
    setImporting((l) => [...l, "Sample media"]);
    try {
      const files = await Promise.all(SAMPLE_PHOTOS.map(async ([url, name]) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        return new File([blob], `${name}.jpg`, { type: blob.type || "image/jpeg" });
      }));
      const added = await importFiles(files, true);
      if (added.length) {
        const hook = { ...makeText("hook", 0), text: "My 3pm reset looks like this", duration: 2.6 };
        const cta = { ...makeText("cta", Math.max(0, added.length * 3 - 2.5)), duration: 2.5 };
        set((p) => ({ ...p, name: p.name === "Untitled edit" ? "Summer Reset · First cut" : p.name, texts: [...p.texts, hook, cta] }));
      }
    } catch {
      notify("Couldn't download the sample media. Check your connection, or import your own files.", "error");
    } finally {
      setImporting((l) => l.filter((n) => n !== "Sample media"));
    }
  }, [importFiles, notify, set]);

  /* ---------- editing commands ---------- */
  const doSplit = useCallback(() => {
    if (!engine) return;
    const r = splitAt(projectRef.current, engine.time, selected);
    if (!r) { notify("Move the playhead over a clip to split it."); return; }
    set(r.project);
    setSelected(r.selected);
  }, [engine, selected, set, notify]);

  const doDelete = useCallback(() => {
    if (!selected) return;
    set((p) => deleteSelection(p, selected));
    setSelected(null);
  }, [selected, set]);

  const doDuplicate = useCallback(() => {
    const r = duplicateSelection(projectRef.current, selected);
    if (!r) return;
    set(r.project);
    setSelected(r.selected);
  }, [selected, set]);

  const fitZoom = useCallback(() => {
    const d = projectDuration(projectRef.current);
    const w = document.querySelector(".ks-tl-scroll")?.clientWidth ?? 800;
    setPps(clamp((w - 40) / Math.max(d, 5), 4, 300));
  }, []);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (exporting || t.closest("input, textarea, select, [contenteditable=true]")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (k === " ") { e.preventDefault(); engine?.toggle(); }
      else if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && k === "y") { e.preventDefault(); redo(); }
      else if (mod && k === "d") { e.preventDefault(); doDuplicate(); }
      else if (!mod && k === "s") { e.preventDefault(); doSplit(); }
      else if (k === "delete" || k === "backspace") { e.preventDefault(); doDelete(); }
      else if (k === "arrowleft" || k === "arrowright") {
        e.preventDefault();
        engine?.pause();
        const stepSize = e.shiftKey ? 1 : 1 / FPS;
        engine?.seek((engine?.time ?? 0) + (k === "arrowleft" ? -stepSize : stepSize));
      }
      else if (k === "home") { e.preventDefault(); engine?.seek(0); }
      else if (k === "end") { e.preventDefault(); engine?.seek(engine.duration); }
      else if (k === "escape") { setSelected(null); setShowKeys(false); }
      else if (k === "=" || k === "+") setPps((v) => clamp(v * 1.25, 4, 300));
      else if (k === "-") setPps((v) => clamp(v / 1.25, 4, 300));
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " && !(e.target as HTMLElement).closest("input, textarea, select")) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); };
  }, [engine, exporting, undo, redo, doSplit, doDelete, doDuplicate]);

  /* ---------- drag files in ---------- */
  const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const onRootDragOver = (e: DragEvent) => { if (!isFileDrag(e)) return; e.preventDefault(); setFileDrag(true); };
  const onRootDrop = (e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setFileDrag(false);
    importFiles(Array.from(e.dataTransfer.files), true);
  };

  /* ---------- preview interactions ---------- */
  const onStageDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!engine || e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fy = (e.clientY - rect.top) / rect.height;
    const t = engine.time;
    const { w, h } = aspectSize(project.aspect, 1080);
    const k = Math.min(w, h) / 1080;
    const hit = [...project.texts].reverse().find((tc) => t >= tc.start && t < tc.start + tc.duration && Math.abs(fy - tc.y) < (tc.size * k * 0.9) / h + 0.02);
    if (!hit) { engine.toggle(); return; }
    setSelected({ type: "text", id: hit.id });
    const snap = checkpoint();
    const offset = fy - hit.y;
    const move = (ev: PointerEvent) => {
      const y = clamp((ev.clientY - rect.top) / rect.height - offset, 0.04, 0.96);
      set((p) => ({ ...p, texts: p.texts.map((c) => (c.id === hit.id ? { ...c, y: Math.round(y * 1000) / 1000 } : c)) }), { record: false });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); settle(snap); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ---------- export ---------- */
  const startExport = async (short: number) => {
    if (!engine) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setExporting({ phase: "running", progress: 0 });
    try {
      const blob = await engine.exportVideo({ short, fps: FPS, signal: ctrl.signal, onProgress: (f) => setExporting({ phase: "running", progress: f }) });
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      setExporting({ phase: "done", blob, ext, url: URL.createObjectURL(blob) });
    } catch (e) {
      if ((e as DOMException).name === "AbortError") setExporting({ phase: "setup" });
      else setExporting({ phase: "error", message: (e as Error).message || "Export failed." });
    } finally {
      abortRef.current = null;
    }
  };
  const closeExport = () => {
    abortRef.current?.abort();
    if (exporting?.phase === "done") URL.revokeObjectURL(exporting.url);
    setExporting(null);
  };

  const duration = projectDuration(project);
  const exportMime = useMemo(() => pickExportMime(), []);
  const panelProps: PanelProps = { project, assets, set, checkpoint, settle, selected, setSelected, engine, notify, importFiles, removeAsset, addToTimeline, loadSample, importing, doSplit, doDelete, doDuplicate, setTab };

  return (
    <div className="ks-studio" onDragOver={onRootDragOver} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileDrag(false); }} onDrop={onRootDrop}>
      <header className="ks-topbar">
        <div className="ks-title">
          <span className="ks-badge"><Icon name="spark" size={13} /> Studio</span>
          <input
            className="ks-name"
            value={project.name}
            aria-label="Project name"
            onFocus={() => { nameSnap.current = checkpoint(); }}
            onBlur={() => { if (nameSnap.current) settle(nameSnap.current); nameSnap.current = null; }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            onChange={(e) => set((p) => ({ ...p, name: e.target.value }), { record: false })}
          />
          <span className={`ks-save ${saveState}`}>
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved on this device" : saveState === "error" ? "Not saved — browser storage unavailable" : ""}
          </span>
        </div>
        <div className="ks-top-actions">
          <button className="ks-icon" onClick={undo} disabled={!history.canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><Icon name="undo" /></button>
          <button className="ks-icon" onClick={redo} disabled={!history.canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Icon name="redo" /></button>
          <div className="ks-keys-wrap">
            <button className="ks-icon" onClick={() => setShowKeys((v) => !v)} title="Keyboard shortcuts" aria-label="Keyboard shortcuts" aria-expanded={showKeys}><Icon name="keyboard" /></button>
            {showKeys && (
              <div className="ks-keys" role="dialog" aria-label="Keyboard shortcuts">
                {[["Space", "Play / pause"], ["S", "Split at playhead"], ["Delete", "Delete selected"], ["Ctrl+D", "Duplicate"], ["Ctrl+Z", "Undo"], ["Ctrl+Shift+Z", "Redo"], ["← / →", "Step one frame"], ["Shift+← / →", "Step one second"], ["Home / End", "Jump to start / end"], ["+ / −", "Zoom timeline"]].map(([k, d]) => (
                  <div key={k}><kbd>{k}</kbd><span>{d}</span></div>
                ))}
              </div>
            )}
          </div>
          <button className="ks-btn primary" onClick={() => setExporting({ phase: "setup" })} disabled={duration <= 0}><Icon name="download" size={16} /> Export</button>
        </div>
      </header>

      <div className="ks-body">
        <nav className="ks-rail" aria-label="Studio tools">
          {TABS.map(([id, icon, label]) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)} aria-pressed={tab === id}>
              <Icon name={icon} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <aside className="ks-panel">
          {tab === "media" && <MediaPanel {...panelProps} />}
          {tab === "text" && <TextPanel {...panelProps} />}
          {tab === "captions" && <CaptionsPanel {...panelProps} />}
          {tab === "smart" && <SmartPanel {...panelProps} />}
        </aside>

        <section className="ks-preview">
          <div className="ks-stage-wrap" ref={stageWrapRef}>
            <div className="ks-stage" style={{ width: stage.w, height: stage.h }} onPointerDown={onStageDown}>
              <canvas ref={canvasRef} aria-label="Video preview" />
              {project.safeArea && <div className={`ks-safe a${project.aspect.replace(":", "x")}`} aria-hidden="true"><span>Safe zone</span></div>}
              {loaded && !project.main.length && !project.texts.length && (
                <div className="ks-stage-empty" onPointerDown={(e) => e.stopPropagation()}>
                  <Icon name="upload" size={26} />
                  <b>Start your edit</b>
                  <p>Drop videos, photos or music anywhere here.</p>
                  <label className="ks-btn primary">
                    Import media
                    <input type="file" multiple accept="video/*,image/*,audio/*" hidden onChange={(e) => { importFiles(Array.from(e.target.files ?? []), true); e.target.value = ""; }} />
                  </label>
                  <button className="ks-link" onClick={loadSample}>or try it with sample photos</button>
                </div>
              )}
            </div>
          </div>
          <Transport engine={engine} duration={duration} />
        </section>

        <aside className="ks-props">
          <PropertiesPanel {...panelProps} />
        </aside>
      </div>

      <div className="ks-tl-bar">
        <div className="ks-tl-tools">
          <button className="ks-tool" onClick={doSplit} title="Split at playhead (S)"><Icon name="split" size={16} /><span>Split</span></button>
          <button className="ks-tool" onClick={doDuplicate} disabled={!selected} title="Duplicate (Ctrl+D)"><Icon name="copy" size={16} /><span>Duplicate</span></button>
          <button className="ks-tool" onClick={doDelete} disabled={!selected} title="Delete (Del)"><Icon name="trash" size={16} /><span>Delete</span></button>
        </div>
        <div className="ks-zoom">
          <button className="ks-icon sm" onClick={() => setPps((v) => clamp(v / 1.25, 4, 300))} aria-label="Zoom out"><Icon name="zoomOut" size={16} /></button>
          <input type="range" min={0} max={100} value={Math.round((Math.log(pps / 4) / Math.log(75)) * 100)} onChange={(e) => setPps(4 * Math.pow(75, Number(e.target.value) / 100))} aria-label="Timeline zoom" />
          <button className="ks-icon sm" onClick={() => setPps((v) => clamp(v * 1.25, 4, 300))} aria-label="Zoom in"><Icon name="zoomIn" size={16} /></button>
          <button className="ks-icon sm" onClick={fitZoom} title="Fit timeline" aria-label="Fit timeline to view"><Icon name="fit" size={16} /></button>
        </div>
      </div>
      <Timeline project={project} assets={assets} engine={engine} pps={pps} selected={selected} onSelect={setSelected} set={set} checkpoint={checkpoint} settle={settle} onDropAsset={(id, at) => { const a = assets.get(id); if (a) addToTimeline(a, at); }} />

      {fileDrag && <div className="ks-dropzone"><Icon name="upload" size={30} /><b>Drop to add to your edit</b><span>Video, photos and music</span></div>}
      {toast && <div className={`ks-toast ${toast.tone}`} role="status">{toast.text}</div>}

      {exporting && (
        <div className="ks-modal-bg" onPointerDown={(e) => { if (e.target === e.currentTarget && exporting.phase !== "running") closeExport(); }}>
          <div className="ks-modal" role="dialog" aria-modal="true" aria-label="Export video">
            <header><h3>Export video</h3>{exporting.phase !== "running" && <button className="ks-icon sm" onClick={closeExport} aria-label="Close"><Icon name="close" size={16} /></button>}</header>
            {exporting.phase === "setup" && (
              <ExportSetup duration={duration} aspect={project.aspect} mime={exportMime} onStart={startExport} />
            )}
            {exporting.phase === "running" && (
              <div className="ks-export-run">
                <p>Rendering in real time — keep this tab open and visible.</p>
                <div className="ks-progress"><span style={{ width: `${Math.round(exporting.progress * 100)}%` }} /></div>
                <div className="ks-export-meta"><span>{Math.round(exporting.progress * 100)}%</span><span>{formatTime(exporting.progress * duration)} / {formatTime(duration)}</span></div>
                <button className="ks-btn" onClick={() => abortRef.current?.abort()}>Cancel</button>
              </div>
            )}
            {exporting.phase === "done" && (
              <div className="ks-export-done">
                <video src={exporting.url} controls playsInline />
                <div className="ks-export-meta"><span>{exporting.ext.toUpperCase()} · {(exporting.blob.size / 1048576).toFixed(1)} MB</span></div>
                <div className="ks-row">
                  <button className="ks-btn" onClick={() => { URL.revokeObjectURL(exporting.url); setExporting({ phase: "setup" }); }}>Export again</button>
                  <button className="ks-btn primary" onClick={() => downloadBlob(exporting.blob, `${slug(project.name)}.${exporting.ext}`)}><Icon name="download" size={16} /> Download</button>
                </div>
              </div>
            )}
            {exporting.phase === "error" && (
              <div className="ks-export-run">
                <p className="ks-error"><Icon name="alert" size={16} /> {exporting.message}</p>
                <button className="ks-btn" onClick={() => setExporting({ phase: "setup" })}>Try again</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kreota-edit";

function ExportSetup({ duration, aspect, mime, onStart }: { duration: number; aspect: Project["aspect"]; mime: string | null; onStart: (short: number) => void }) {
  const [short, setShort] = useState(1080);
  const size = aspectSize(aspect, short);
  if (!mime) return <p className="ks-error"><Icon name="alert" size={16} /> This browser can't record video. Use a recent Chrome, Edge or Firefox.</p>;
  return (
    <div className="ks-export-setup">
      <div className="ks-field" role="group" aria-label="Quality"><span className="ks-field-head">Quality</span>
        <div className="ks-seg">
          {[720, 1080].map((s) => <button key={s} className={short === s ? "on" : ""} onClick={() => setShort(s)}>{s}p</button>)}
        </div>
      </div>
      <dl className="ks-export-facts">
        <div><dt>Size</dt><dd>{size.w} × {size.h}</dd></div>
        <div><dt>Format</dt><dd>{mime.includes("mp4") ? "MP4" : "WebM"} · {FPS} fps</dd></div>
        <div><dt>Length</dt><dd>{formatTime(duration)}</dd></div>
        <div><dt>Render time</dt><dd>about {formatTime(duration)}</dd></div>
      </dl>
      <button className="ks-btn primary full" onClick={() => onStart(short)}><Icon name="download" size={16} /> Start export</button>
    </div>
  );
}

function Transport({ engine, duration }: { engine: Engine | null; duration: number }) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!engine) return;
    setTime(engine.time);
    const a = engine.onTime(setTime);
    const b = engine.onPlayState(setPlaying);
    return () => { a(); b(); };
  }, [engine]);
  const step = (d: number) => { engine?.pause(); engine?.seek((engine?.time ?? 0) + d); };
  return (
    <div className="ks-transport">
      <span className="ks-tc"><b>{formatTime(time, true)}</b> / {formatTime(duration, true)}</span>
      <div className="ks-transport-btns">
        <button className="ks-icon" onClick={() => engine?.seek(0)} aria-label="Go to start"><Icon name="start" /></button>
        <button className="ks-icon" onClick={() => step(-1 / FPS)} aria-label="Previous frame"><Icon name="prev" /></button>
        <button className="ks-play" onClick={() => engine?.toggle()} aria-label={playing ? "Pause" : "Play"} disabled={duration <= 0}><Icon name={playing ? "pause" : "play"} size={20} /></button>
        <button className="ks-icon" onClick={() => step(1 / FPS)} aria-label="Next frame"><Icon name="next" /></button>
        <button className="ks-icon" onClick={() => engine?.seek(duration)} aria-label="Go to end"><Icon name="end" /></button>
      </div>
      <span className="ks-tc right" />
    </div>
  );
}
