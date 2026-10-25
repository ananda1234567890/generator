import type { NextRequest } from "next/server";
import { isAuthed } from "@/lib/auth";
import { assertPublicHttps } from "@/lib/images";

export const maxDuration = 60;

// Streams a result through our server so the browser saves it as a file
// instead of just opening the provider link.
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) return new Response("Not signed in", { status: 401 });
  const url = req.nextUrl.searchParams.get("url") ?? "";
  const name = (req.nextUrl.searchParams.get("name") ?? "download").replace(/[^\w.-]+/g, "_").slice(0, 80);
  try {
    const upstream = await fetch(assertPublicHttps(url));
    if (!upstream.ok || !upstream.body) return new Response("Could not fetch the file (link may have expired)", { status: 502 });
    return new Response(upstream.body, {
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "content-disposition": `attachment; filename="${name}"`,
        ...(upstream.headers.get("content-length") ? { "content-length": upstream.headers.get("content-length")! } : {}),
      },
    });
  } catch {
    return new Response("Bad link", { status: 400 });
  }
}
