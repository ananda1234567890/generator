import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { BUCKET } from "./bucket";

export { BUCKET };

let client: SupabaseClient | null = null;

// Server-only client using the service role key. Never import this from a
// client component.
export function db() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are not set");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export async function signedUrls(paths: string[], seconds = 3600) {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return map;
  const { data } = await db().storage.from(BUCKET).createSignedUrls(unique, seconds);
  for (const row of data ?? []) if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  return map;
}

export async function loadFile(path: string) {
  const { data, error } = await db().storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Could not read ${path}: ${error?.message ?? "missing"}`);
  return { bytes: Buffer.from(await data.arrayBuffer()), mime: data.type || "image/jpeg" };
}
