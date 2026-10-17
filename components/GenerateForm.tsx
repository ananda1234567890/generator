"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MODELS, type Kind, type ModelDef } from "@/lib/models";
import type { HeadshotView } from "@/lib/types";
import { ImagePicker } from "./ImagePicker";

const field = "space-y-1 text-sm";
const labelCls = "text-xs text-muted";

export function GenerateForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [kind, setKind] = useState<Kind>("video");
  const models = useMemo(() => MODELS.filter((m) => m.kind === kind), [kind]);
  const [modelId, setModelId] = useState(models[0].id);
  const model = (models.find((m) => m.id === modelId) ?? models[0]) as ModelDef;

  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(1);
  const [resolution, setResolution] = useState(model.defaultResolution);
  const [aspect, setAspect] = useState(model.defaultAspect);
  const [duration, setDuration] = useState(model.durations?.includes(5) ? 5 : (model.durations?.[0] ?? 5));
  const [audio, setAudio] = useState(true);
  const [startFrame, setStartFrame] = useState<string[]>([]);
  const [endFrame, setEndFrame] = useState<string[]>([]);
  const [heads, setHeads] = useState<HeadshotView[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/headshots")
      .then((r) => r.json())
      .then((b) => setHeads(b.headshots ?? []))
      .catch(() => {});
  }, []);

  function pickModel(id: string) {
    const m = MODELS.find((x) => x.id === id)!;
    setModelId(id);
    setResolution(m.defaultResolution);
    setAspect(m.defaultAspect);
    if (m.durations) setDuration(m.durations.includes(duration) ? duration : m.durations.includes(5) ? 5 : m.durations[0]);
    setStartFrame([]);
    setEndFrame([]);
  }

  function pickKind(k: Kind) {
    setKind(k);
    pickModel(MODELS.find((m) => m.kind === k)!.id);
  }

  function tag(name: string) {
    const el = promptRef.current;
    const at = el?.selectionStart ?? prompt.length;
    const next = `${prompt.slice(0, at)}${at && !/\s$/.test(prompt.slice(0, at)) ? " " : ""}@${name} ${prompt.slice(at)}`;
    setPrompt(next);
    el?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          modelId: model.id,
          prompt,
          count,
          resolution,
          aspectRatio: aspect,
          duration: model.durations ? duration : undefined,
          audio: model.audio ? audio : undefined,
          startFrame: startFrame[0],
          endFrame: endFrame[0],
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed");
      const warn = body.warnings?.length ? ` Note: ${body.warnings.join(" ")}` : "";
      setMsg({ ok: true, text: `Queued ${body.count}.${warn}` });
      onSubmitted();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  const select = "w-full";
  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-panel p-4">
      <div className="flex gap-1 rounded-lg bg-black/30 p-1 text-sm">
        {(["video", "image"] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => pickKind(k)}
            className={`flex-1 rounded-md px-3 py-1.5 capitalize ${kind === k ? "bg-accent" : "text-muted hover:text-foreground"}`}
          >
            {k}
          </button>
        ))}
      </div>

      <label className={field}>
        <span className={labelCls}>Model</span>
        <select className={select} value={model.id} onChange={(e) => pickModel(e.target.value)}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        {model.note && <p className="text-xs text-amber-400">{model.note}</p>}
      </label>

      <label className={field}>
        <span className={labelCls}>Prompt — tag a headshot with @name</span>
        <textarea
          ref={promptRef}
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the shot…"
          maxLength={1500}
        />
      </label>

      {heads.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {heads.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => tag(h.name)}
              className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-xs hover:border-accent"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {h.url && <img src={h.url} alt="" className="h-6 w-6 rounded-full object-cover" />}@{h.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          <span className={labelCls}>How many</span>
          <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        {model.durations && (
          <label className={field}>
            <span className={labelCls}>Length (seconds)</span>
            <select className={select} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {model.durations.map((d) => (
                <option key={d} value={d}>
                  {d}s
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={field}>
          <span className={labelCls}>{kind === "video" ? "Quality" : model.providerModel === "gpt-image-2" ? "Quality" : "Resolution"}</span>
          <select className={select} value={resolution} onChange={(e) => setResolution(e.target.value)}>
            {model.resolutions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className={field}>
          <span className={labelCls}>Aspect ratio</span>
          <select className={select} value={aspect} onChange={(e) => setAspect(e.target.value)}>
            {model.aspectRatios.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>

      {model.audio && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} />
          Generate audio
        </label>
      )}

      {model.startFrame && (
        <div className={field}>
          <span className={labelCls}>Start image {model.startFrame === "required" ? "(required unless you tag a headshot)" : "(optional)"}</span>
          <ImagePicker label="+ Add start image" paths={startFrame} onChange={setStartFrame} />
        </div>
      )}
      {model.endFrame && startFrame.length > 0 && (
        <div className={field}>
          <span className={labelCls}>End image (optional)</span>
          <ImagePicker label="+ Add end image" paths={endFrame} onChange={setEndFrame} />
        </div>
      )}

      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      <button disabled={busy || !prompt.trim()} className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium disabled:opacity-50">
        {busy ? "Queuing…" : `Generate ${count > 1 ? count : ""} ${kind}${count > 1 ? "s" : ""}`}
      </button>
    </form>
  );
}
