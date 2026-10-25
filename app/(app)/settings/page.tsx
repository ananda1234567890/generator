"use client";

import { useState } from "react";
import { PROVIDER_NAMES } from "@/lib/keys";
import { setKey, useStore } from "@/lib/client/store";
import type { Provider } from "@/lib/models";

const PROVIDERS: { id: Provider; hint: string }[] = [
  { id: "elevenlabs", hint: "Seedance, Veo, images and headshots. Needs a Pro plan or above and a key with the Image & Video permission." },
  { id: "leonardo", hint: "Kling and Seedance. Create the key in Leonardo's API settings." },
];

function KeyRow({ id, hint, saved }: { id: Provider; hint: string; saved?: string }) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    const ok = setKey(id, value);
    setMsg(ok ? { ok: true, text: "Saved in this browser" } : { ok: false, text: "Your browser refused to save (storage full or blocked)" });
    if (ok) setValue("");
  }
  function remove() {
    setKey(id, "");
    setMsg({ ok: true, text: "Removed" });
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">{PROVIDER_NAMES[id]}</p>
          <p className="text-xs text-muted">{hint}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${saved ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
          {saved ? `Saved ····${saved.slice(-4)}` : "No key"}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={saved ? "Paste a new key to replace it" : "Paste your API key"}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="button" onClick={() => setShow(!show)} className="rounded-lg border border-line px-3 text-sm text-muted hover:text-foreground">
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <button onClick={save} disabled={!value.trim()} className="rounded-lg bg-accent px-4 py-1.5 font-medium disabled:opacity-50">
          Save key
        </button>
        {saved && (
          <button onClick={remove} className="text-muted hover:text-red-400">
            Remove
          </button>
        )}
        {msg && <span className={msg.ok ? "text-emerald-400" : "text-red-400"}>{msg.text}</span>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { keys } = useStore();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold">Settings</h1>
      <p className="text-sm text-muted">
        Your API keys are saved in this browser only and stay until you remove them. They are sent over HTTPS with each request so the
        server can call the provider for you, and the server never stores them. Anyone using this browser profile can use the keys, so
        don&apos;t save them on a shared computer.
      </p>
      {PROVIDERS.map((p) => (
        <KeyRow key={p.id} id={p.id} hint={p.hint} saved={keys[p.id]} />
      ))}
      <p className="text-xs text-muted">
        Saved in this browser: API keys and headshots. Not saved: generated videos and images (they disappear when you close the tab).
      </p>
    </div>
  );
}
