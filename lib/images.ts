import type { ImageRef } from "./types";
import { UserError } from "./plan";

const OK_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// The server only fetches files from the providers' storage hosts, so it cannot be
// used to fetch arbitrary addresses.
const ALLOWED_HOST_SUFFIXES = [
  "googleapis.com",
  "googleusercontent.com",
  "leonardo.ai",
  "elevenlabs.io",
  "cloudfront.net",
  "amazonaws.com",
];

export function isAllowedHost(host: string) {
  const h = host.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((s) => h === s || h.endsWith("." + s));
}

export function assertProviderUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UserError("Bad link");
  }
  if (u.protocol !== "https:" || !isAllowedHost(u.hostname)) throw new UserError("Link is not from a supported provider");
  return u;
}

export async function resolveImage(ref: ImageRef): Promise<{ bytes: Buffer; mime: string }> {
  if ("dataUrl" in ref) {
    const m = /^data:([\w/+.-]+);base64,([\s\S]+)$/.exec(ref.dataUrl);
    if (!m || !OK_MIME.includes(m[1])) throw new UserError("Use a JPG, PNG or WebP image");
    return { bytes: Buffer.from(m[2], "base64"), mime: m[1] };
  }
  const res = await fetch(assertProviderUrl(ref.url));
  if (!res.ok) throw new UserError(`Could not load an image (${res.status}). It may have expired; upload it again.`);
  const mime = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0];
  return { bytes: Buffer.from(await res.arrayBuffer()), mime: OK_MIME.includes(mime) ? mime : "image/jpeg" };
}
