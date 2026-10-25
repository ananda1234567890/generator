import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { configured } from "@/lib/providers";

export const dynamic = "force-dynamic";

function Row({ name, ok, hint }: { name: string; ok: boolean; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-panel p-4">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs ${ok ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
        {ok ? "Connected" : "Missing"}
      </span>
    </div>
  );
}

export default async function SettingsPage() {
  if (!(await isAuthed())) redirect("/login");
  const keys = configured();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold">Settings</h1>
      <p className="text-sm text-muted">
        API keys live in environment variables (Vercel → Project → Settings → Environment Variables, or .env.local on your
        Mac), so they are never sent to the browser. Change a key there and redeploy. Nothing you generate is stored on the server; results live in this browser tab only.
      </p>
      <Row name="ElevenLabs" ok={keys.elevenlabs} hint="ELEVENLABS_API_KEY — Seedance, Veo, images and headshots. Needs a Pro plan or above." />
      <Row name="Leonardo" ok={keys.leonardo} hint="LEONARDO_API_KEY — Kling and Seedance." />
    </div>
  );
}
