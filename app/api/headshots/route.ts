import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { listHeadshots, UserError } from "@/lib/jobs";
import { db, signedUrls } from "@/lib/supabase";
import { NAME_RE } from "@/lib/tags";

export async function GET() {
  return handle(async () => {
    const heads = await listHeadshots();
    const urls = await signedUrls(heads.map((h) => h.storage_path));
    return { headshots: heads.map((h) => ({ ...h, url: urls.get(h.storage_path) ?? null })) };
  });
}

// Save an already-uploaded photo (see /api/uploads) as a named headshot.
export async function POST(req: NextRequest) {
  const { name, path } = (await req.json()) as { name: string; path: string };
  return handle(async () => {
    if (!NAME_RE.test(name ?? "")) throw new UserError("Name can use letters, numbers, - and _ (no spaces)");
    if (!path?.startsWith("uploads/")) throw new UserError("Upload a photo first");
    const { error } = await db().from("headshots").insert({ name, storage_path: path, source: "upload" });
    if (error) throw new UserError(error.code === "23505" ? `A headshot named ${name} already exists` : error.message);
    return { ok: true };
  });
}

// Removes the headshot from the list. The image file itself stays in storage.
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  return handle(async () => {
    if (!id) throw new UserError("Missing id");
    const { error } = await db().from("headshots").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
}
