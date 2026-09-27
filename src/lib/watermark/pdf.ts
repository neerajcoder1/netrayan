// Invisible watermark carrier for PDFs. The payload is drawn as real text content
// (zero fill-opacity, so nothing renders or prints) on every page, then recovered by
// decompressing the page content stream directly from the raw file bytes — no reliance
// on the file having been produced by this app; any PDF viewer/consumer sees an
// unchanged document.

import { PDFDocument, StandardFonts, PDFArray, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import type { WatermarkPayload } from "../types";

const MARK = "NTRYWM";

function payloadToMarkerString(payload: WatermarkPayload): string {
  const json = JSON.stringify(payload);
  const b64url = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${MARK}:${b64url}:${MARK}`;
}

function markerStringToPayload(b64url: string): WatermarkPayload | null {
  try {
    let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const obj = JSON.parse(atob(b64));
    if (obj && obj.v === 1 && obj.wid && obj.sid && obj.did && obj.rid) return obj as WatermarkPayload;
    return null;
  } catch {
    return null;
  }
}

export async function embedPdfWatermark(pdfBytes: Uint8Array, payload: WatermarkPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const marker = payloadToMarkerString(payload);
  for (const page of doc.getPages()) {
    // Invisible: opacity 0 makes the glyphs transparent — present in content stream,
    // absent from every rendering (screen, print, screenshot).
    page.drawText(marker, { x: 1, y: 1, size: 1, font, opacity: 0 });
  }
  return doc.save();
}

async function decodedPageText(doc: PDFDocument): Promise<string> {
  let out = "";
  for (const page of doc.getPages()) {
    const node = page.node.Contents();
    const streams: PDFRawStream[] = [];
    if (node instanceof PDFArray) {
      for (let i = 0; i < node.size(); i++) {
        const looked = doc.context.lookup(node.get(i));
        if (looked instanceof PDFRawStream) streams.push(looked);
      }
    } else if (node instanceof PDFRawStream) {
      streams.push(node);
    }
    for (const rs of streams) {
      const decoded = decodePDFRawStream(rs).decode();
      const raw = new TextDecoder("latin1").decode(decoded);
      // PDF hex-strings <...> — decode each to recover the literal characters.
      const hexTokens = raw.match(/<([0-9A-Fa-f]+)>/g) || [];
      for (const tok of hexTokens) {
        const hex = tok.slice(1, -1);
        let s = "";
        for (let i = 0; i + 1 < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        out += s;
      }
      out += raw; // also scan raw operators, in case a viewer used literal (...) strings
    }
  }
  return out;
}

export async function extractPdfWatermark(pdfBytes: Uint8Array): Promise<WatermarkPayload | null> {
  try {
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
    const text = await decodedPageText(doc);
    const re = new RegExp(`${MARK}:([A-Za-z0-9_-]+):${MARK}`);
    const m = text.match(re);
    if (!m) return null;
    return markerStringToPayload(m[1]);
  } catch {
    return null;
  }
}
