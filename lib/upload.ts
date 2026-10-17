"use client";

import { createClient } from "@supabase/supabase-js";
import { BUCKET } from "./bucket";

// Upload a file straight to Supabase storage using a one-time signed URL from
// our API. Returns the storage path to send in later requests.
export async function uploadFile(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ext }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Upload failed");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { error } = await sb.storage.from(BUCKET).uploadToSignedUrl(body.path, body.token, file, {
    contentType: file.type || "image/jpeg",
  });
  if (error) throw new Error(error.message);
  return body.path as string;
}
