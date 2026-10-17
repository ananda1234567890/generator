import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { UserError } from "@/lib/jobs";
import { BUCKET, db } from "@/lib/supabase";

const EXTS = ["jpg", "jpeg", "png", "webp", "heic"];

// Hands the browser a one-time URL so it can upload straight to storage.
// (Vercel functions cap request bodies at ~4.5MB, too small for photos.)
export async function POST(req: NextRequest) {
  const { ext } = (await req.json()) as { ext: string };
  return handle(async () => {
    const e = (ext ?? "").toLowerCase();
    if (!EXTS.includes(e)) throw new UserError("Use a JPG, PNG, WebP or HEIC image");
    const path = `uploads/${randomUUID()}.${e}`;
    const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "Could not start upload");
    return { path, token: data.token };
  });
}
