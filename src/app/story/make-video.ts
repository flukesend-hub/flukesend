/*
  Client-only slideshow encoder. Turns a list of already-rendered card images (the
  same branded 1080x1920 story cards, one per chosen photo) into a single vertical
  MP4, using the device's own H.264 encoder (WebCodecs) and a small in-memory MP4
  muxer. It runs entirely on the phone: nothing hits the server beyond fetching the
  card images the operator is already previewing. Returns null when the browser has
  no usable H.264 video encoder (older Safari, Firefox), so the caller can fall back
  to something else instead of failing.

  WebCodecs types are not in the ambient TS lib here, so the encoder and frame are
  reached through window with narrow casts rather than pulling in extra types.
*/
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

export const SLIDE_W = 1080;
export const SLIDE_H = 1920;

// Profiles most phones can encode, most compatible first (high, main, baseline).
const H264_CANDIDATES = ["avc1.640028", "avc1.4d0028", "avc1.42e01f"];

type VideoEncoderCtor = new (init: {
  output: (chunk: unknown, meta: unknown) => void;
  error: (e: unknown) => void;
}) => {
  configure: (cfg: Record<string, unknown>) => void;
  encode: (frame: unknown, opts?: { keyFrame?: boolean }) => void;
  flush: () => Promise<void>;
  encodeQueueSize: number;
};

function encoderApi(): {
  VE: VideoEncoderCtor;
  VF: new (source: CanvasImageSource, init: { timestamp: number; duration?: number }) => { close: () => void };
  isSupported: (cfg: Record<string, unknown>) => Promise<{ supported?: boolean }>;
} | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  if (!w.VideoEncoder || !w.VideoFrame) return null;
  const VE = w.VideoEncoder as unknown as VideoEncoderCtor & { isConfigSupported: (cfg: Record<string, unknown>) => Promise<{ supported?: boolean }> };
  return {
    VE,
    VF: w.VideoFrame as never,
    isSupported: (cfg) => VE.isConfigSupported(cfg),
  };
}

export function videoSupported(): boolean {
  return encoderApi() !== null;
}

async function pickCodec(fps: number): Promise<string | null> {
  const api = encoderApi();
  if (!api) return null;
  for (const codec of H264_CANDIDATES) {
    try {
      const s = await api.isSupported({ codec, width: SLIDE_W, height: SLIDE_H, bitrate: 8_000_000, framerate: fps });
      if (s?.supported) return codec;
    } catch {
      // try the next profile
    }
  }
  return null;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("card image failed to load"));
    img.src = url;
  });
}

export type SlideshowOpts = {
  urls: string[]; // rendered card image URLs, in play order
  secondsPer?: number; // hold time per photo
  fps?: number;
  onProgress?: (done: number, total: number) => void;
};

// Returns an MP4 Blob, or null if this browser cannot encode H.264 video (the
// caller should then fall back). Throws only on an unexpected encode failure.
export async function makeSlideshow({ urls, secondsPer = 3, fps = 30, onProgress }: SlideshowOpts): Promise<Blob | null> {
  if (!urls.length) return null;
  const api = encoderApi();
  if (!api) return null;
  const codec = await pickCodec(fps);
  if (!codec) return null;

  const canvas = document.createElement("canvas");
  canvas.width = SLIDE_W;
  canvas.height = SLIDE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: SLIDE_W, height: SLIDE_H },
    fastStart: "in-memory",
  });
  let encErr: unknown = null;
  const encoder = new api.VE({
    output: (chunk, meta) => muxer.addVideoChunk(chunk as never, meta as never),
    error: (e) => {
      encErr = e;
    },
  });
  encoder.configure({ codec, width: SLIDE_W, height: SLIDE_H, bitrate: 8_000_000, framerate: fps });

  const usPer = Math.round(1_000_000 / fps);
  const framesPer = Math.max(1, Math.round(secondsPer * fps));
  let idx = 0;

  for (let i = 0; i < urls.length; i++) {
    const img = await loadImage(urls[i]);
    // The cards are already 1080x1920, but cover-fit defensively so an odd size
    // never letterboxes or distorts.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
    const scale = Math.max(SLIDE_W / img.width, SLIDE_H / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (SLIDE_W - w) / 2, (SLIDE_H - h) / 2, w, h);

    for (let f = 0; f < framesPer; f++) {
      const frame = new api.VF(canvas, { timestamp: idx * usPer, duration: usPer });
      encoder.encode(frame, { keyFrame: f === 0 });
      frame.close();
      idx++;
      if (encoder.encodeQueueSize > 8) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    onProgress?.(i + 1, urls.length);
    if (encErr) throw new Error(`encode failed: ${String(encErr)}`);
  }

  await encoder.flush();
  muxer.finalize();
  if (encErr) throw new Error(`encode failed: ${String(encErr)}`);
  return new Blob([muxer.target.buffer as ArrayBuffer], { type: "video/mp4" });
}
