"use client";

import { useRef, useState } from "react";
import { uploadFile } from "@/lib/upload";

// Pick one or more images, upload each to storage, report the storage paths.
export function ImagePicker({
  label,
  multiple = false,
  paths,
  onChange,
}: {
  label: string;
  multiple?: boolean;
  paths: string[];
  onChange: (paths: string[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    try {
      const added: string[] = [];
      for (const f of Array.from(files)) {
        const path = await uploadFile(f);
        setPreviews((p) => ({ ...p, [path]: URL.createObjectURL(f) }));
        added.push(path);
      }
      onChange(multiple ? [...paths, ...added] : added.slice(0, 1));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {paths.map((p) => (
          <div key={p} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previews[p]} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" />
            <button
              type="button"
              onClick={() => onChange(paths.filter((x) => x !== p))}
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-black/80 text-xs"
              aria-label="Remove"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-60"
        >
          {busy ? "Uploading…" : label}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple={multiple}
          hidden
          onChange={(e) => pick(e.target.files)}
        />
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}
