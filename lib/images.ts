import type { ImageRef } from "./types";
import { UserError } from "./plan";

const OK_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Only fetch public https links, never internal addresses.
export function assertPublicHttps(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UserError("Bad image link");
  }
  const h = u.hostname.toLowerCase();
  const bad =
    u.protocol !== "https:" ||
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^[\d.]+$/.test(h) ||
    h.includes(":") ||
    h.startsWith("[");
  if (bad) throw new UserError("Image link is not allowed");
  return u;
}

export async function resolveImage(ref: ImageRef): Promise<{ bytes: Buffer; mime: string }> {
  if ("dataUrl" in ref) {
    const m = /^data:([\w/+.-]+);base64,([\s\S]+)$/.exec(ref.dataUrl);
    if (!m || !OK_MIME.includes(m[1])) throw new UserError("Use a JPG, PNG or WebP image");
    return { bytes: Buffer.from(m[2], "base64"), mime: m[1] };
  }
  const res = await fetch(assertPublicHttps(ref.url));
  if (!res.ok) throw new UserError(`Could not load an image (${res.status}). It may have expired; upload it again.`);
  const mime = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0];
  return { bytes: Buffer.from(await res.arrayBuffer()), mime: OK_MIME.includes(mime) ? mime : "image/jpeg" };
}
