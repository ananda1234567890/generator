"use client";

import { useSyncExternalStore } from "react";
import { KEY_HEADERS, PROVIDER_NAMES, type Keys } from "../keys";
import { HEADSHOT_MODEL_ID, getModel, type Provider } from "../models";
import { shrinkDataUrl } from "./image";
import type { ImageRef, JobKind, JobStatus, PollResponse, SubmitBody, SubmitResult } from "../types";

// Two kinds of state:
//  - Saved in this browser (localStorage), kept until you remove it: API keys and headshots.
//  - This tab only (plain memory): jobs and generated results. Videos and images are copied into
//    the tab as soon as they finish, so they stay downloadable (even after the provider link
//    expires) until the tab is refreshed or closed.

export interface ClientJob {
  id: string;
  kind: JobKind;
  modelId: string;
  provider: "elevenlabs" | "leonardo";
  prompt: string;
  status: JobStatus;
  providerJobId?: string;
  error?: string;
  warning?: string;
  url?: string; // provider link (expires)
  localUrl?: string; // copy held in this tab's memory (blob: URL), lasts until refresh/close
  copyError?: string; // set if the copy into the tab failed
  dataUrl?: string; // inline copy for small images
  mime?: string;
  meta: { resolution: string; aspectRatio: string; duration?: number };
  headshotName?: string;
  body?: SubmitBody; // kept until success so Retry works
  createdAt: number;
  lastPoll?: number;
  notBefore?: number;
  pollErrors?: number;
}

export interface ClientHeadshot {
  id: string;
  name: string;
  image: ImageRef;
  preview: string;
  source: "upload" | "generated";
}

interface State {
  jobs: ClientJob[];
  headshots: ClientHeadshot[];
  keys: Keys;
}

const SAVED_KEY = "generator_saved_v1";
const EMPTY: State = { jobs: [], headshots: [], keys: {} };
let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

// Returns false if the browser refused to save (storage full).
function persistSaved(): boolean {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify({ keys: state.keys, headshots: state.headshots }));
    return true;
  } catch {
    return false;
  }
}

function readSaved(): { keys: Keys; headshots: ClientHeadshot[] } {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVED_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { keys: saved.keys ?? {}, headshots: saved.headshots ?? [] };
    }
  } catch {
    // Unreadable data: keep a copy instead of letting the next save overwrite it.
    try {
      if (raw) localStorage.setItem(SAVED_KEY + "_unreadable_backup", raw);
    } catch {}
  }
  return { keys: {}, headshots: [] };
}

// Ask the browser not to clear our saved data when it is low on space.
export function requestPersistentStorage() {
  try {
    void navigator.storage?.persist?.();
  } catch {}
}

function load() {
  if (loaded) return;
  loaded = true;
  state = { jobs: [], ...readSaved() };
  // Pick up changes made in another tab.
  window.addEventListener("storage", (e) => {
    if (e.key === SAVED_KEY) {
      state = { ...state, ...readSaved() };
      emit();
    }
  });
}

function set(next: State) {
  state = next;
  emit();
}

function update(id: string, patch: Partial<ClientJob>) {
  set({ ...state, jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) });
}

export function useStore() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      if (!loaded) queueMicrotask(() => (load(), emit()));
      return () => listeners.delete(cb);
    },
    () => state,
    () => EMPTY,
  );
}

// ---------- actions ----------

const uid = () => crypto.randomUUID();

export function enqueue(items: { body: SubmitBody; headshotName?: string }[]) {
  const now = Date.now();
  const jobs: ClientJob[] = items.map(({ body, headshotName }, i) => {
    const model = getModel(body.kind === "headshot" ? HEADSHOT_MODEL_ID : body.modelId)!;
    return {
      id: uid(),
      kind: body.kind,
      modelId: model.id,
      provider: model.provider,
      prompt: body.prompt,
      status: "queued",
      meta: { resolution: body.resolution, aspectRatio: body.aspectRatio, duration: body.duration },
      headshotName,
      body,
      createdAt: now + i,
    };
  });
  set({ ...state, jobs: [...jobs, ...state.jobs] });
}

export function retryJob(id: string) {
  update(id, { status: "queued", error: undefined, providerJobId: undefined, notBefore: undefined, pollErrors: 0 });
}

// Ask the provider for a fresh link and try copying the finished file into the tab again.
export function retryCopy(id: string) {
  update(id, { status: "running", copyError: undefined, lastPoll: 0 });
}

export function dismissJob(id: string) {
  const j = state.jobs.find((x) => x.id === id);
  if (j?.localUrl) URL.revokeObjectURL(j.localUrl);
  set({ ...state, jobs: state.jobs.filter((j) => j.id !== id) });
}

// Saves a headshot in this browser. Returns false if the browser's storage is full.
export async function addHeadshot(h: Omit<ClientHeadshot, "id">): Promise<boolean> {
  const small = "dataUrl" in h.image ? await shrinkDataUrl(h.image.dataUrl) : null;
  const entry: ClientHeadshot = small
    ? { ...h, id: uid(), image: { dataUrl: small }, preview: small }
    : { ...h, id: uid() };
  const before = state;
  state = { ...state, headshots: [entry, ...state.headshots] };
  if (!persistSaved()) {
    state = before;
    return false;
  }
  emit();
  requestPersistentStorage();
  return true;
}

// ---- backup / restore of headshots (a file you keep, in case browser data is ever cleared) ----

interface BackupFile {
  app: "generator-headshots";
  version: 1;
  headshots: { name: string; dataUrl: string; source: "upload" | "generated" }[];
}

export function exportHeadshots(): number {
  const list = state.headshots.flatMap((h) => ("dataUrl" in h.image ? [{ name: h.name, dataUrl: h.image.dataUrl, source: h.source }] : []));
  const file: BackupFile = { app: "generator-headshots", version: 1, headshots: list };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
  a.download = `headshots-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return list.length;
}

// Adds headshots from a backup file. Names you already have are left alone.
export async function importHeadshots(file: File): Promise<{ added: number; skipped: number }> {
  let data: BackupFile;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("That file is not a headshots backup.");
  }
  if (data?.app !== "generator-headshots" || !Array.isArray(data.headshots)) throw new Error("That file is not a headshots backup.");
  let added = 0;
  let skipped = 0;
  for (const h of data.headshots) {
    const ok = typeof h?.name === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(h.name) && typeof h.dataUrl === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(h.dataUrl);
    if (!ok || headshotNameTaken(h.name)) {
      skipped++;
      continue;
    }
    if (!(await addHeadshot({ name: h.name, image: { dataUrl: h.dataUrl }, preview: h.dataUrl, source: h.source === "generated" ? "generated" : "upload" }))) {
      throw new Error(`Your browser's storage is full after adding ${added}. Remove some headshots and try again.`);
    }
    added++;
  }
  return { added, skipped };
}

export function removeHeadshot(id: string) {
  state = { ...state, headshots: state.headshots.filter((h) => h.id !== id) };
  persistSaved();
  emit();
}

export function setKey(provider: Provider, value: string): boolean {
  const keys = { ...state.keys };
  if (value.trim()) keys[provider] = value.trim();
  else delete keys[provider];
  const before = state;
  state = { ...state, keys };
  if (!persistSaved()) {
    state = before;
    return false;
  }
  emit();
  return true;
}

export function headshotNameTaken(name: string) {
  return state.headshots.some((h) => h.name.toLowerCase() === name.toLowerCase());
}

// ---------- engine: submits queued jobs and polls running ones ----------

const MAX_SUBMITTING = 3;
const busy = new Set<string>();

async function api<T>(input: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  for (const p of Object.keys(KEY_HEADERS) as Provider[]) {
    const k = state.keys[p];
    if (k) headers.set(KEY_HEADERS[p], k);
  }
  const res = await fetch(input, { ...init, headers });
  const text = await res.text();
  let json: { error?: string } | null = null;
  try {
    json = JSON.parse(text);
  } catch {}
  if (!res.ok) {
    const tooBig = res.status === 413 || /entity too large|FUNCTION_PAYLOAD_TOO_LARGE/i.test(text);
    throw Object.assign(
      new Error(json?.error ?? (tooBig ? "Images are too large to send. Use fewer or smaller images." : `Server error (${res.status})`)),
      { status: res.status },
    );
  }
  return json as T;
}

async function submitJob(job: ClientJob) {
  try {
    if (!state.keys[job.provider]) throw new Error(`${PROVIDER_NAMES[job.provider]} API key is missing. Add it in Settings, then retry.`);
    const out = await api<SubmitResult>("/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(job.body),
    });
    update(job.id, {
      status: "running",
      providerJobId: out.providerJobId,
      prompt: out.prompt,
      warning: out.warnings.join(" ") || undefined,
      lastPoll: Date.now(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/\b429\b|rate limit|too many/i.test(msg)) update(job.id, { status: "queued", notBefore: Date.now() + 15_000 });
    else update(job.id, { status: "failed", error: msg });
  } finally {
    busy.delete(job.id);
  }
}

// Pull a finished file into this tab's memory through our server (the provider's storage
// does not allow direct browser downloads). The link only has to be valid for this moment.
async function copyIntoTab(job: ClientJob, url: string, mime?: string) {
  try {
    const name = `${job.kind}-${job.id.slice(0, 8)}`;
    const res = await fetch(`/api/download?url=${encodeURIComponent(url)}&name=${name}`);
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const type = mime || blob.type || (job.kind === "video" ? "video/mp4" : "image/png");
    update(job.id, { status: "done", localUrl: URL.createObjectURL(new Blob([blob], { type })), body: undefined, copyError: undefined });
  } catch (e) {
    update(job.id, { status: "done", body: undefined, copyError: e instanceof Error ? e.message : "Could not copy" });
  }
}

async function pollJob(job: ClientJob) {
  try {
    const q = new URLSearchParams({ provider: job.provider, kind: job.kind, id: job.providerJobId! });
    const res = await api<PollResponse>(`/api/poll?${q}`);
    if (res.state === "running") {
      update(job.id, { lastPoll: Date.now(), pollErrors: 0 });
    } else if (res.state === "failed") {
      update(job.id, { status: "failed", error: res.error ?? "Generation failed", lastPoll: Date.now() });
    } else {
      if (job.kind === "headshot") {
        if (!res.dataUrl || !job.headshotName) {
          update(job.id, { status: "failed", error: "The headshot finished but could not be loaded. Try again." });
        } else if (await addHeadshot({ name: job.headshotName, image: { dataUrl: res.dataUrl }, preview: res.dataUrl, source: "generated" })) {
          update(job.id, { status: "done", url: res.url, dataUrl: res.dataUrl, mime: res.mime, body: undefined, lastPoll: Date.now() });
        } else {
          update(job.id, { status: "failed", error: "Your browser's storage is full. Remove a headshot, then retry." });
        }
      } else if (res.dataUrl) {
        update(job.id, { status: "done", url: res.url, dataUrl: res.dataUrl, mime: res.mime, body: undefined, lastPoll: Date.now() });
      } else {
        update(job.id, { status: "saving", url: res.url, mime: res.mime, lastPoll: Date.now() });
        await copyIntoTab(job, res.url!, res.mime);
      }
    }
  } catch (e) {
    // Network hiccup: look again next round. Give up after many in a row,
    // or straight away if the server says the request itself is wrong.
    const status = (e as { status?: number }).status ?? 0;
    const n = (job.pollErrors ?? 0) + 1;
    if (n >= 20 || (status >= 400 && status < 500 && status !== 429)) update(job.id, { status: "failed", error: e instanceof Error ? e.message : String(e) });
    else update(job.id, { pollErrors: n, lastPoll: Date.now() });
  } finally {
    busy.delete(job.id);
  }
}

function step() {
  const now = Date.now();
  const submitting = state.jobs.filter((j) => j.status === "submitting").length;
  let slots = MAX_SUBMITTING - submitting;
  // Oldest first.
  for (const job of [...state.jobs].sort((a, b) => a.createdAt - b.createdAt)) {
    if (busy.has(job.id)) continue;
    if (job.status === "queued" && slots > 0 && job.body && (job.notBefore ?? 0) <= now) {
      slots--;
      busy.add(job.id);
      update(job.id, { status: "submitting" });
      void submitJob(job);
    } else if (job.status === "running" && job.providerJobId) {
      const every = job.kind === "video" ? 10_000 : 3_000;
      if (now - (job.lastPoll ?? 0) >= every) {
        busy.add(job.id);
        void pollJob(job);
      }
    }
  }
}

export function startEngine() {
  load();
  emit();
  requestPersistentStorage();
  const timer = setInterval(step, 2000);
  const warn = (e: BeforeUnloadEvent) => {
    // Generated results only exist in this tab, so warn before they are lost.
    if (state.jobs.some((j) => j.status !== "failed")) e.preventDefault();
  };
  window.addEventListener("beforeunload", warn);
  step();
  return () => {
    clearInterval(timer);
    window.removeEventListener("beforeunload", warn);
  };
}
