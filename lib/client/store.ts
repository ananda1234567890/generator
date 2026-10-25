"use client";

import { useSyncExternalStore } from "react";
import { HEADSHOT_MODEL_ID, getModel } from "../models";
import type { ImageRef, JobKind, JobStatus, PollResponse, SubmitBody, SubmitResult } from "../types";

// Everything lives in this tab. State is kept in memory and mirrored to
// sessionStorage, which survives a refresh but is wiped when the tab closes.

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
  dataUrl?: string; // inline copy for images
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
}

const KEY = "generator_state_v1";
const EMPTY: State = { jobs: [], headshots: [] };
let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function persist() {
  const attempts = [
    () => state,
    () => ({ ...state, jobs: state.jobs.map((j) => ({ ...j, dataUrl: undefined })) }),
    () => ({ ...state, jobs: state.jobs.map((j) => ({ ...j, dataUrl: undefined, body: undefined })) }),
  ];
  for (const make of attempts) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(make()));
      return;
    } catch {}
  }
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as State;
      // A job that was mid-submit when the page reloaded may or may not have started; run it again.
      saved.jobs = saved.jobs.map((j) => (j.status === "submitting" ? { ...j, status: "queued" as const } : j));
      state = saved;
    }
  } catch {}
}

function set(next: State) {
  state = next;
  persist();
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

export function dismissJob(id: string) {
  set({ ...state, jobs: state.jobs.filter((j) => j.id !== id) });
}

export function addHeadshot(h: Omit<ClientHeadshot, "id">) {
  set({ ...state, headshots: [{ ...h, id: uid() }, ...state.headshots] });
}

export function removeHeadshot(id: string) {
  set({ ...state, headshots: state.headshots.filter((h) => h.id !== id) });
}

export function headshotNameTaken(name: string) {
  return state.headshots.some((h) => h.name.toLowerCase() === name.toLowerCase());
}

// ---------- engine: submits queued jobs and polls running ones ----------

const MAX_SUBMITTING = 3;
const busy = new Set<string>();

async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
    throw new Error("Signed out");
  }
  const text = await res.text();
  let json: { error?: string } | null = null;
  try {
    json = JSON.parse(text);
  } catch {}
  if (!res.ok) {
    const tooBig = res.status === 413 || /entity too large|FUNCTION_PAYLOAD_TOO_LARGE/i.test(text);
    throw new Error(json?.error ?? (tooBig ? "Images are too large to send. Use fewer or smaller images." : `Server error (${res.status})`));
  }
  return json as T;
}

async function submitJob(job: ClientJob) {
  try {
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

async function pollJob(job: ClientJob) {
  try {
    const q = new URLSearchParams({ provider: job.provider, kind: job.kind, id: job.providerJobId! });
    const res = await api<PollResponse>(`/api/poll?${q}`);
    if (res.state === "running") {
      update(job.id, { lastPoll: Date.now(), pollErrors: 0 });
    } else if (res.state === "failed") {
      update(job.id, { status: "failed", error: res.error ?? "Generation failed", lastPoll: Date.now() });
    } else {
      const keep = res.dataUrl ?? res.url;
      if (job.kind === "headshot" && keep && job.headshotName) {
        addHeadshot({
          name: job.headshotName,
          image: res.dataUrl ? { dataUrl: res.dataUrl } : { url: res.url! },
          preview: keep,
          source: "generated",
        });
      }
      update(job.id, { status: "done", url: res.url, dataUrl: res.dataUrl, mime: res.mime, body: undefined, lastPoll: Date.now() });
    }
  } catch (e) {
    // Network hiccup: look again next round. Give up after many in a row.
    const n = (job.pollErrors ?? 0) + 1;
    if (n >= 20) update(job.id, { status: "failed", error: e instanceof Error ? e.message : String(e) });
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
  const timer = setInterval(step, 2000);
  const warn = (e: BeforeUnloadEvent) => {
    // Results only exist in this tab, so warn before they are lost.
    if (state.jobs.some((j) => j.status !== "failed") || state.headshots.length) e.preventDefault();
  };
  window.addEventListener("beforeunload", warn);
  step();
  return () => {
    clearInterval(timer);
    window.removeEventListener("beforeunload", warn);
  };
}
