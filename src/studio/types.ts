export type AssetKind = "video" | "image" | "audio";

export interface Thumb {
  /** Source time in seconds that this frame was captured at. */
  t: number;
  url: string;
}

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  /** Object URL for the stored file. Recreated on every load, never persisted. */
  url: string;
  /** Seconds. Images have no natural duration and use 0. */
  duration: number;
  width: number;
  height: number;
  thumbs: Thumb[];
  /** RMS loudness per LEVEL_STEP seconds of source audio, 0..1. Missing when the file has no decodable audio. */
  levels?: number[];
  hasAudio: boolean;
  size: number;
}

/** A clip on the main (magnetic) video track. Clips play back-to-back in array order. */
export interface VisualClip {
  id: string;
  kind: "video" | "image";
  assetId: string;
  /** Source in/out points in seconds. For images, in is 0 and out is the display duration. */
  in: number;
  out: number;
  speed: number;
  volume: number;
  muted: boolean;
  fadeIn: number;
  fadeOut: number;
  scale: number;
  /** Pan offsets as a fraction of the frame, -1..1. */
  x: number;
  y: number;
  brightness: number;
  contrast: number;
  saturation: number;
}

export interface AudioClip {
  id: string;
  assetId: string;
  start: number;
  in: number;
  out: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export type TextStyle = "shadow" | "box" | "outline";
export type TextAnim = "none" | "fade" | "pop";

export interface TextClip {
  id: string;
  kind: "title" | "caption";
  start: number;
  duration: number;
  text: string;
  /** Font size in px relative to a 1080px short side. */
  size: number;
  weight: 500 | 700 | 800;
  color: string;
  style: TextStyle;
  boxColor: string;
  /** Vertical centre of the text block as a fraction of frame height. */
  y: number;
  anim: TextAnim;
}

export type Aspect = "9:16" | "1:1" | "4:5" | "16:9";

export interface Project {
  version: 1;
  name: string;
  aspect: Aspect;
  fit: "fill" | "fit";
  background: string;
  masterVolume: number;
  safeArea: boolean;
  main: VisualClip[];
  audio: AudioClip[];
  texts: TextClip[];
}

export type Selection =
  | { type: "main"; id: string }
  | { type: "audio"; id: string }
  | { type: "text"; id: string }
  | null;
