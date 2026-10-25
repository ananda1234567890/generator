import type { NextRequest } from "next/server";
import sharp from "sharp";
import { handle } from "@/lib/api";
import { isAllowedHost } from "@/lib/images";
import { keysFrom } from "@/lib/keys";
import { UserError } from "@/lib/plan";
import { poll } from "@/lib/providers";
import type { PollResponse } from "@/lib/types";

export const maxDuration = 60;

const hostOk = (u: string) => {
  try {
    return isAllowedHost(new URL(u).hostname);
  } catch {
    return false;
  }
};

const INLINE_LIMIT = 2_500_000; // bytes; keeps the JSON reply under Vercel's 4.5 MB cap

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const provider = q.get("provider");
  const kind = q.get("kind");
  const id = q.get("id");
  const keys = keysFrom(req.headers);
  return handle(async (): Promise<PollResponse> => {
    if ((provider !== "elevenlabs" && provider !== "leonardo") || !id || !["video", "image", "headshot"].includes(kind ?? "")) {
      throw new UserError("Bad poll request");
    }
    const res = await poll(provider, kind === "video" ? "video" : "image", id, keys);
    if (res.state === "running") return { state: "running" };
    if (res.state === "failed") return { state: "failed", error: res.error };
    const out: PollResponse = { state: "done", url: res.url, mime: res.mime };
    // Images come back inline when small, so they never expire with the provider link.
    if (kind !== "video" && hostOk(res.url)) {
      try {
        const r = await fetch(res.url);
        if (r.ok) {
          let bytes = Buffer.from(await r.arrayBuffer());
          let mime = res.mime ?? r.headers.get("content-type") ?? "image/png";
          if (kind === "headshot") {
            bytes = await sharp(bytes).resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
            mime = "image/jpeg";
          }
          if (bytes.length <= INLINE_LIMIT) out.dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
        }
      } catch (e) {
        console.error("inline image failed", e);
      }
    }
    return out;
  });
}
