"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/client/image";

// Pick images; they are shrunk in the browser and held as data URLs (nothing is uploaded or stored).
export function ImagePicker({
  label,
  multiple = false,
  max = 5,
  images,
  onChange,
}: {
  label: string;
  multiple?: boolean;
  max?: number;
  images: string[];
  onChange: (images: string[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    try {
      const added: string[] = [];
      for (const f of Array.from(files)) added.push(await compressImage(f));
      onChange(multiple ? [...images, ...added].slice(0, max) : added.slice(0, 1));
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
        {images.map((src, i) => (
          <div key={i} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, j) => j !== i))}
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-black/80 text-xs"
              aria-label="Remove"
            >
              ×
            </button>
          </div>
        ))}
        {(multiple ? images.length < max : images.length === 0) && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-60"
          >
            {busy ? "Reading…" : label}
          </button>
        )}
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
