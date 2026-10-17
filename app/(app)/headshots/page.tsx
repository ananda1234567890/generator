"use client";

import { useEffect, useState } from "react";
import { ImagePicker } from "@/components/ImagePicker";
import { JobList } from "@/components/JobList";
import { useJobs } from "@/components/useJobs";
import type { HeadshotView } from "@/lib/types";

type Mode = "upload" | "generate";

export default function HeadshotsPage() {
  const [heads, setHeads] = useState<HeadshotView[]>([]);
  const [mode, setMode] = useState<Mode>("generate");
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { jobs, refresh } = useJobs();

  const [reloadTick, setReloadTick] = useState(0);
  const load = () => setReloadTick((t) => t + 1);

  // Re-read the headshot list on mount, after changes, and when a generated one finishes.
  const doneCount = jobs?.filter((j) => j.kind === "headshot" && j.status === "done").length ?? 0;
  useEffect(() => {
    let cancelled = false;
    fetch("/api/headshots")
      .then((r) => r.json())
      .then((b) => {
        if (!cancelled) setHeads(b.headshots ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doneCount, reloadTick]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res =
        mode === "upload"
          ? await fetch("/api/headshots", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name, path: photos[0] }),
            })
          : await fetch("/api/headshots/generate", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name, prompt, sources: photos, count }),
            });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed");
      setMsg({
        ok: true,
        text: mode === "upload" ? `Saved @${name}` : `Generating ${body.names.map((n: string) => "@" + n).join(", ")}…`,
      });
      setPhotos([]);
      setName("");
      load();
      refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(h: HeadshotView) {
    if (!confirm(`Remove @${h.name} from your headshots? (The image file stays in storage.)`)) return;
    await fetch(`/api/headshots?id=${h.id}`, { method: "DELETE" });
    load();
  }

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
          <span className="text-xs text-muted">
            {mode === "generate" ? "Photos of the person (1-5, 3-4 works best)" : "Headshot image"}
          </span>
          <ImagePicker
            label={mode === "generate" ? "+ Add photos" : "+ Add headshot"}
            multiple={mode === "generate"}
            paths={photos}
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
              <input type="number" min={1} max={4} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </label>
          </>
        )}

        {msg && <p className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
        <button disabled={busy || !ready} className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium disabled:opacity-50">
          {busy ? "Working…" : mode === "generate" ? "Generate headshot" : "Save headshot"}
        </button>
      </form>

      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted">Your headshots</h2>
          {heads.length === 0 ? (
            <p className="text-sm text-muted">None yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {heads.map((h) => (
                <div key={h.id} className="overflow-hidden rounded-xl border border-line bg-panel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {h.url && <img src={h.url} alt={h.name} className="aspect-[3/4] w-full object-cover" />}
                  <div className="flex items-center justify-between p-2 text-sm">
                    <span>@{h.name}</span>
                    <button onClick={() => remove(h)} className="text-xs text-muted hover:text-red-400">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {jobs && jobs.some((j) => j.kind === "headshot" && j.status !== "done") && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted">In progress</h2>
            <JobList jobs={jobs.filter((j) => j.kind === "headshot" && j.status !== "done")} onChanged={refresh} />
          </div>
        )}
      </section>
    </div>
  );
}
