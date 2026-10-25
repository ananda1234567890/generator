"use client";

import { useRef, useState } from "react";
import { ImagePicker } from "@/components/ImagePicker";
import { JobList } from "@/components/JobList";
import { addHeadshot, enqueue, exportHeadshots, headshotNameTaken, importHeadshots, removeHeadshot, useStore } from "@/lib/client/store";
import { HEADSHOT_MODEL_ID } from "@/lib/models";
import { NAME_RE } from "@/lib/tags";
import type { SubmitBody } from "@/lib/types";

type Mode = "upload" | "generate";
const DEFAULT_PROMPT =
  "Professional studio headshot of the person in the reference photos. Keep their face, features and skin tone exactly the same. Soft natural light, neutral background, looking at the camera, sharp focus.";

export default function HeadshotsPage() {
  const { headshots, jobs, keys } = useStore();
  const [mode, setMode] = useState<Mode>("generate");
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(1);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [backupMsg, setBackupMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!NAME_RE.test(n)) return setMsg({ ok: false, text: "Name can use letters, numbers, - and _ (no spaces)" });
    if (headshotNameTaken(n)) return setMsg({ ok: false, text: `@${n} already exists` });

    if (mode === "upload") {
      const ok = await addHeadshot({ name: n, image: { dataUrl: photos[0] }, preview: photos[0], source: "upload" });
      if (!ok) return setMsg({ ok: false, text: "Your browser's storage is full. Remove a headshot first." });
      setMsg({ ok: true, text: `Saved @${n}` });
    } else {
      if (!keys.elevenlabs) return setMsg({ ok: false, text: "Add your ElevenLabs API key in Settings first." });
      const taken = new Set(headshots.map((h) => h.name.toLowerCase()));
      const items = Array.from({ length: count }, (_, i) => {
        let candidate = i === 0 ? n : `${n}${i + 1}`;
        for (let k = i + 2; taken.has(candidate.toLowerCase()); k++) candidate = `${n}${k}`;
        taken.add(candidate.toLowerCase());
        const body: SubmitBody = {
          kind: "headshot",
          modelId: HEADSHOT_MODEL_ID,
          prompt: prompt.trim() || DEFAULT_PROMPT,
          resolution: "1K",
          aspectRatio: "3:4",
          tagged: [],
          sources: photos.map((dataUrl) => ({ dataUrl })),
        };
        return { body, headshotName: candidate };
      });
      enqueue(items);
      setMsg({ ok: true, text: `Generating ${items.map((i) => "@" + i.headshotName).join(", ")}…` });
    }
    setPhotos([]);
    setName("");
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    try {
      const { added, skipped } = await importHeadshots(file);
      setBackupMsg({ ok: true, text: `Restored ${added} headshot${added === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} (name already exists or invalid)` : ""}.` });
    } catch (e) {
      setBackupMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    if (restoreInput.current) restoreInput.current.value = "";
  }

  function remove(id: string, name: string) {
    if (confirm(`Remove @${name} for good? This can't be undone.\n\nTip: use "Back up headshots" first if you might want it back.`)) removeHeadshot(id);
  }

  const pending = jobs.filter((j) => j.kind === "headshot" && j.status !== "done");
  const ready = name.trim() && (mode === "upload" ? photos.length === 1 : photos.length >= 1);
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-panel p-4">
        <div className="flex gap-1 rounded-lg bg-black/30 p-1 text-sm">
          {(["generate", "upload"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setPhotos([]);
              }}
              className={`flex-1 rounded-md px-3 py-1.5 ${mode === m ? "bg-accent" : "text-muted hover:text-foreground"}`}
            >
              {m === "generate" ? "Generate headshot" : "Upload headshot"}
            </button>
          ))}
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-xs text-muted">Name (used as @name in prompts)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Randy" maxLength={32} />
        </label>

        <div className="space-y-1 text-sm">
          <span className="text-xs text-muted">{mode === "generate" ? "Photos of the person (1-5, 3-4 works best)" : "Headshot image"}</span>
          <ImagePicker
            label={mode === "generate" ? "+ Add photos" : "+ Add headshot"}
            multiple={mode === "generate"}
            max={5}
            images={photos}
            onChange={setPhotos}
          />
        </div>

        {mode === "generate" && (
          <>
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-muted">Prompt (optional)</span>
              <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Default: clean studio headshot, same face" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-muted">How many versions</span>
              <input type="number" min={1} max={4} value={count} onChange={(e) => setCount(Math.min(4, Math.max(1, Number(e.target.value) || 1)))} />
            </label>
          </>
        )}

        {msg && <p className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
        <button disabled={!ready} className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium disabled:opacity-50">
          {mode === "generate" ? "Generate headshot" : "Save headshot"}
        </button>
      </form>

      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted">Your headshots (saved in this browser)</h2>
          {headshots.length === 0 ? (
            <p className="text-sm text-muted">None yet. Headshots you save stay here when you close the tab.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {headshots.map((h) => (
                <div key={h.id} className="overflow-hidden rounded-xl border border-line bg-panel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={h.preview} alt={h.name} className="aspect-[3/4] w-full object-cover" />
                  <div className="flex items-center justify-between p-2 text-sm">
                    <span>@{h.name}</span>
                    <div className="flex gap-3 text-xs">
                      <a href={h.preview} download={`${h.name}.jpg`} className="text-accent hover:underline">
                        Save
                      </a>
                      <button onClick={() => remove(h.id, h.name)} className="text-muted hover:text-red-400">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2 rounded-xl border border-line bg-panel p-4 text-sm">
          <p className="font-medium">Keep your headshots safe</p>
          <p className="text-xs text-muted">
            Headshots are saved in this browser for this web address only. Always open the app from the same link. A different link
            (including a new Vercel project or a per-deployment preview link) has its own empty storage, and clearing browser data wipes
            them. A backup file lets you restore them anywhere.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setBackupMsg({ ok: true, text: `Backed up ${exportHeadshots()} headshots. Keep the downloaded file somewhere safe.` })}
              disabled={headshots.length === 0}
              className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-50"
            >
              Back up headshots
            </button>
            <button onClick={() => restoreInput.current?.click()} className="rounded-lg border border-line px-3 py-1.5">
              Restore from backup
            </button>
            <input ref={restoreInput} type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
            {backupMsg && <span className={`text-xs ${backupMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{backupMsg.text}</span>}
          </div>
        </div>
        {pending.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted">In progress</h2>
            <JobList jobs={pending} />
          </div>
        )}
      </section>
    </div>
  );
}
