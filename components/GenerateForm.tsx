"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { enqueue, useStore } from "@/lib/client/store";
import { PROVIDER_NAMES } from "@/lib/keys";
import { MODELS, type Kind, type ModelDef } from "@/lib/models";
import { parseTags } from "@/lib/tags";
import type { SubmitBody } from "@/lib/types";
import { ImagePicker } from "./ImagePicker";
import { PromptBox } from "./PromptBox";

const field = "space-y-1 text-sm";
const labelCls = "text-xs text-muted";
const MAX_BODY_CHARS = 3_800_000; // Vercel rejects request bodies over about 4.5 MB

export function GenerateForm() {
  const { headshots, keys } = useStore();
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
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

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
    const before = prompt.slice(0, at);
    setPrompt(`${before}${before && !/\s$/.test(before) ? " " : ""}@${name} ${prompt.slice(at)}`);
    el?.focus();
  }

  const missingKey = !keys[model.provider];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (missingKey) return;
    const { names } = parseTags(prompt, headshots.map((h) => h.name));
    const body: SubmitBody = {
      kind,
      modelId: model.id,
      prompt,
      resolution,
      aspectRatio: aspect,
      duration: model.durations ? duration : undefined,
      audio: model.audio ? audio : undefined,
      startFrame: startFrame[0] ? { dataUrl: startFrame[0] } : undefined,
      endFrame: endFrame[0] ? { dataUrl: endFrame[0] } : undefined,
      tagged: names.map((n) => {
        const h = headshots.find((x) => x.name === n)!;
        return { name: n, image: h.image };
      }),
    };
    if (JSON.stringify(body).length > MAX_BODY_CHARS) {
      setMsg({ ok: false, text: "Those images are too large to send together. Use fewer images or tags." });
      return;
    }
    enqueue(Array.from({ length: count }, () => ({ body })));
    setMsg({ ok: true, text: `Queued ${count}. Watch the cards on the right.` });
  }

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
        <select value={model.id} onChange={(e) => pickModel(e.target.value)}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        {model.note && <p className="text-xs text-amber-400">{model.note}</p>}
      </label>

      <div className={field}>
        <span className={labelCls}>Prompt — type @ to pick a headshot</span>
        <PromptBox value={prompt} onChange={setPrompt} headshots={headshots} textareaRef={promptRef} />
      </div>

      {headshots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {headshots.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => tag(h.name)}
              className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-xs hover:border-accent"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={h.preview} alt="" className="h-6 w-6 rounded-full object-cover" />@{h.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          <span className={labelCls}>How many</span>
          <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} />
        </label>
        {model.durations && (
          <label className={field}>
            <span className={labelCls}>Length (seconds)</span>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {model.durations.map((d) => (
                <option key={d} value={d}>
                  {d}s
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={field}>
          <span className={labelCls}>{kind === "video" || model.providerModel === "gpt-image-2" ? "Quality" : "Resolution"}</span>
          <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
            {model.resolutions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className={field}>
          <span className={labelCls}>Aspect ratio</span>
          <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
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
          <ImagePicker label="+ Add start image" images={startFrame} onChange={setStartFrame} />
        </div>
      )}
      {model.endFrame && startFrame.length > 0 && (
        <div className={field}>
          <span className={labelCls}>End image (optional)</span>
          <ImagePicker label="+ Add end image" images={endFrame} onChange={setEndFrame} />
        </div>
      )}

      {missingKey && (
        <p className="text-sm text-amber-400">
          Add your {PROVIDER_NAMES[model.provider]} API key in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          to use this model.
        </p>
      )}
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      <button disabled={!prompt.trim() || missingKey} className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium disabled:opacity-50">
        {`Generate ${count > 1 ? count + " " : ""}${kind}${count > 1 ? "s" : ""}`}
      </button>
    </form>
  );
}
