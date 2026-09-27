// LSB steganographic watermark carrier for PNG images (lossless — required for LSB survival).
// Bit positions are chosen by a deterministic, seeded shuffle of pixel indices rather than
// sequential order, so the payload isn't concentrated in a fixed, easily-diffed region.
// This is a demo-scoped implementation of a real technique; production hardening notes are
// in the README (transform-domain / spread-spectrum watermarking for JPEG & re-compression
// resistance).

import type { WatermarkPayload } from "../types";
import { payloadToBits, bitsToBytes, bitsToUint32 } from "./payload";
import { decodePayloadBytes } from "./payload";

const SPREAD_KEY = "netrayan-lsb-diffusion-v1";

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic pixel visiting order — same key + same pixel count => same order, every time. */
function pixelOrder(pixelCount: number): Uint32Array {
  const rnd = mulberry32(seedFromString(SPREAD_KEY));
  const arr = new Uint32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) arr[i] = i;
  for (let i = pixelCount - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

async function loadImageData(
  pngBytes: Uint8Array,
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; imageData: ImageData }> {
  const blob = new Blob([pngBytes as BlobPart], { type: "image/png" });
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { canvas, ctx, imageData };
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("Canvas toBlob failed"));
        return;
      }
      const buf = await blob.arrayBuffer();
      resolve(new Uint8Array(buf));
    }, "image/png");
  });
}

export function imageCapacityBits(width: number, height: number): number {
  return width * height * 3;
}

export async function embedImageWatermark(
  pngBytes: Uint8Array,
  payload: WatermarkPayload,
): Promise<Uint8Array> {
  const bits = await payloadToBits(payload);
  const { canvas, ctx, imageData } = await loadImageData(pngBytes);
  const data = imageData.data;
  const pixelCount = imageData.width * imageData.height;
  if (bits.length > imageCapacityBits(imageData.width, imageData.height)) {
    throw new Error(
      `Image too small to carry the watermark (${bits.length} bits needed, ${imageCapacityBits(
        imageData.width,
        imageData.height,
      )} available). Use an image of at least ${Math.ceil(bits.length / 3)} pixels.`,
    );
  }
  const order = pixelOrder(pixelCount);
  for (let bitIdx = 0; bitIdx < bits.length; bitIdx++) {
    const pixelIndex = Math.floor(bitIdx / 3);
    const channel = bitIdx % 3; // 0=R 1=G 2=B — alpha untouched
    const px = order[pixelIndex];
    const base = px * 4 + channel;
    data[base] = (data[base] & 0xfe) | bits[bitIdx];
  }
  ctx.putImageData(imageData, 0, 0);
  return canvasToPngBytes(canvas);
}

export async function extractImageWatermark(pngBytes: Uint8Array): Promise<WatermarkPayload | null> {
  try {
    const { imageData } = await loadImageData(pngBytes);
    const data = imageData.data;
    const pixelCount = imageData.width * imageData.height;
    const order = pixelOrder(pixelCount);

    const readBits = (count: number): Uint8Array => {
      const bits = new Uint8Array(count);
      for (let bitIdx = 0; bitIdx < count; bitIdx++) {
        const pixelIndex = Math.floor(bitIdx / 3);
        if (pixelIndex >= order.length) break;
        const channel = bitIdx % 3;
        const px = order[pixelIndex];
        const base = px * 4 + channel;
        bits[bitIdx] = data[base] & 1;
      }
      return bits;
    };

    const headerBits = readBits(32);
    const len = bitsToUint32(headerBits);
    if (len <= 0 || len > 4096) return null;
    const totalBits = (8 + len) * 8;
    if (totalBits > imageCapacityBits(imageData.width, imageData.height)) return null;
    const allBits = readBits(totalBits);
    const bytes = bitsToBytes(allBits);
    return await decodePayloadBytes(bytes);
  } catch {
    return null;
  }
}
