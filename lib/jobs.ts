import { randomUUID } from "node:crypto";
import { HEADSHOT_MODEL_ID, getModel, type ModelDef } from "./models";
import { parseTags, NAME_RE } from "./tags";
import { BUCKET, db, loadFile, signedUrls } from "./supabase";
import { poll, submit } from "./providers";
import type { Headshot, Job, JobKind, JobParams, JobView } from "./types";

const MAX_COUNT = 10;
const iso = (ms = 0) => new Date(Date.now() + ms).toISOString();

export interface GenerateInput {
  kind: "video" | "image";
  modelId: string;
  prompt: string;
  count: number;
  resolution: string;
  aspectRatio: string;
  duration?: number;
  audio?: boolean;
  startFrame?: string;
  endFrame?: string;
}

export class UserError extends Error {}

function validate(model: ModelDef, i: { resolution: string; aspectRatio: string; duration?: number }) {
  if (!model.resolutions.includes(i.resolution)) throw new UserError(`${model.label} does not support ${i.resolution}`);
  if (!model.aspectRatios.includes(i.aspectRatio)) throw new UserError(`${model.label} does not support ${i.aspectRatio}`);
  if (model.durations && !model.durations.includes(i.duration ?? -1)) {
    throw new UserError(`${model.label} does not support a duration of ${i.duration}s`);
  }
}

export async function listHeadshots(): Promise<Headshot[]> {
  const { data, error } = await db().from("headshots").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Headshot[];
}

// Decide where tagged headshots and uploaded frames go, given what the model supports.
export function planInputs(
  model: ModelDef,
  input: { startFrame?: string; endFrame?: string },
  tagged: { name: string; path: string }[],
) {
  const warnings: string[] = [];
  let startFrame = model.kind === "video" ? input.startFrame : undefined;
  let endFrame = model.kind === "video" && model.endFrame ? input.endFrame : undefined;
  if (input.startFrame && model.kind === "video" && !model.startFrame) {
    warnings.push(`${model.label} does not take a start image; it was ignored.`);
    startFrame = undefined;
  }
  if (endFrame && !startFrame) endFrame = undefined;
  let refs: string[] = [];

  if (tagged.length) {
    if (!startFrame && !endFrame && model.maxRefs > 0) {
      refs = tagged.slice(0, model.maxRefs).map((h) => h.path);
      if (tagged.length > model.maxRefs) warnings.push(`${model.label} takes ${model.maxRefs} references; extra tags were ignored.`);
    } else if (model.kind === "video" && !startFrame && model.startFrame) {
      startFrame = tagged[0].path;
      warnings.push(
        `${model.label} cannot take reference images, so ${tagged[0].name} is used as the start frame` +
          (tagged.length > 1 ? ` (other tags ignored).` : `.`),
      );
    } else {
      warnings.push(`Tagged headshots were ignored: ${model.label} cannot combine them with the start/end frame you set.`);
    }
  }
  if (model.startFrame === "required" && !startFrame) {
    throw new UserError(`${model.label} needs a start image. Upload one or tag a headshot with @name.`);
  }
  return { startFrame, endFrame, refs, warnings };
}

export async function createJobs(input: GenerateInput) {
  const model = getModel(input.modelId);
  if (!model || model.kind !== input.kind) throw new UserError("Unknown model");
  const raw = input.prompt.trim();
  if (!raw) throw new UserError("Write a prompt first");
  if (raw.length > 1500) throw new UserError("Prompt is too long (max 1500 characters)");
  const count = Math.floor(input.count);
  if (!(count >= 1 && count <= MAX_COUNT)) throw new UserError(`Count must be 1-${MAX_COUNT}`);
  validate(model, input);

  const heads = await listHeadshots();
  const { prompt, names } = parseTags(raw, heads.map((h) => h.name));
  const tagged = names.map((n) => heads.find((h) => h.name === n)!);
  const plan = planInputs(model, input, tagged.map((h) => ({ name: h.name, path: h.storage_path })));
  const { startFrame, endFrame, refs, warnings } = plan;

  const params: JobParams = {
    rawPrompt: raw,
    tags: names,
    resolution: input.resolution,
    aspectRatio: input.aspectRatio,
    duration: model.kind === "video" ? input.duration : undefined,
    audio: model.audio ? !!input.audio : undefined,
    startFrame,
    endFrame,
    refs,
  };
  const batch = randomUUID();
  const rows = Array.from({ length: count }, () => ({
    batch_id: batch,
    kind: model.kind as JobKind,
    model: model.id,
    provider: model.provider,
    prompt,
    params,
    warning: warnings.join(" ") || null,
  }));
  const { error } = await db().from("jobs").insert(rows);
  if (error) throw new Error(error.message);
  return { count, warnings };
}

export async function createHeadshotJobs(input: {
  name: string;
  prompt: string;
  sources: string[];
  count: number;
}) {
  const name = input.name.trim();
  if (!NAME_RE.test(name)) throw new UserError("Name can use letters, numbers, - and _ (no spaces)");
  if (input.sources.length < 1 || input.sources.length > 5) throw new UserError("Add 1-5 photos of the person");
  const count = Math.floor(input.count);
  if (!(count >= 1 && count <= 4)) throw new UserError("Count must be 1-4");
  const existing = new Set((await listHeadshots()).map((h) => h.name.toLowerCase()));
  const model = getModel(HEADSHOT_MODEL_ID)!;
  const prompt =
    input.prompt.trim() ||
    "Professional studio headshot of the person in the reference photos. Keep their face, features and skin tone exactly the same. Soft natural light, neutral background, looking at the camera, sharp focus.";
  const batch = randomUUID();
  const rows = [];
  for (let n = 0; n < count; n++) {
    let candidate = n === 0 ? name : `${name}${n + 1}`;
    for (let k = n + 2; existing.has(candidate.toLowerCase()); k++) candidate = `${name}${k}`;
    existing.add(candidate.toLowerCase());
    const params: JobParams = {
      rawPrompt: prompt,
      tags: [],
      resolution: "2K",
      aspectRatio: "3:4",
      refs: input.sources,
      headshotName: candidate,
    };
    rows.push({ batch_id: batch, kind: "headshot", model: model.id, provider: model.provider, prompt, params });
  }
  const { error } = await db().from("jobs").insert(rows);
  if (error) throw new Error(error.message);
  return { names: rows.map((r) => r.params.headshotName) };
}

export async function retryJob(id: string) {
  const { error } = await db()
    .from("jobs")
    .update({ status: "queued", error: null, provider_job_id: null, updated_at: iso() })
    .eq("id", id)
    .eq("status", "failed");
  if (error) throw new Error(error.message);
}

export async function listJobs(limit = 60): Promise<JobView[]> {
  const { data, error } = await db().from("jobs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  const jobs = data as Job[];
  const urls = await signedUrls(jobs.map((j) => j.output_path ?? ""));
  return jobs.map((j) => ({ ...j, url: j.output_path ? (urls.get(j.output_path) ?? null) : null }));
}

// ---- Background work, driven by the dashboard calling tick() every few seconds ----

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function submitJob(job: Job) {
  const s = db();
  const { data: claimed } = await s
    .from("jobs")
    .update({ status: "submitting", updated_at: iso() })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("id");
  if (!claimed?.length) return; // another tick got it
  const model = getModel(job.model);
  try {
    if (!model) throw new Error(`Unknown model ${job.model}`);
    const providerId = await submit({ model, prompt: job.prompt, params: job.params, load: loadFile });
    await s
      .from("jobs")
      .update({ status: "running", provider_job_id: providerId, polled_at: iso(), updated_at: iso() })
      .eq("id", job.id);
  } catch (e) {
    const msg = errText(e);
    const busy = /\b429\b|rate limit|too many/i.test(msg);
    await s
      .from("jobs")
      .update({ status: busy ? "queued" : "failed", error: busy ? null : msg, updated_at: iso() })
      .eq("id", job.id);
  }
}

const EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

async function saveResult(job: Job, url: string, mime?: string) {
  const s = db();
  const { data: claimed } = await s
    .from("jobs")
    .update({ status: "saving", updated_at: iso() })
    .eq("id", job.id)
    .eq("status", "running")
    .select("id");
  if (!claimed?.length) return;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const type = mime || res.headers.get("content-type") || (job.kind === "video" ? "video/mp4" : "image/png");
    const path = `outputs/${job.id}.${EXT[type] ?? (job.kind === "video" ? "mp4" : "png")}`;
    const bytes = Buffer.from(await res.arrayBuffer());
    const up = await s.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: true });
    if (up.error) throw new Error(`Storage upload failed: ${up.error.message}`);
    if (job.kind === "headshot" && job.params.headshotName) {
      const ins = await s
        .from("headshots")
        .insert({ name: job.params.headshotName, storage_path: path, source: "generated" });
      if (ins.error) throw new Error(`Could not save headshot: ${ins.error.message}`);
    }
    await s
      .from("jobs")
      .update({ status: "done", output_path: path, mime: type, remote_url: url, error: null, updated_at: iso() })
      .eq("id", job.id);
  } catch (e) {
    const attempts = (job.params.saveAttempts ?? 0) + 1;
    // Go back to "running" so the next tick fetches a fresh URL and retries.
    await s
      .from("jobs")
      .update({
        status: attempts >= 5 ? "failed" : "running",
        error: attempts >= 5 ? `Finished but could not be saved: ${errText(e)}` : null,
        params: { ...job.params, saveAttempts: attempts },
        remote_url: url,
        updated_at: iso(),
      })
      .eq("id", job.id);
  }
}

async function pollJob(job: Job) {
  if (!job.provider_job_id) return;
  const s = db();
  if (job.polled_at && Date.now() - new Date(job.polled_at).getTime() < 9000) return;
  await s.from("jobs").update({ polled_at: iso() }).eq("id", job.id);
  try {
    const res = await poll(job.provider, job.kind === "video" ? "video" : "image", job.provider_job_id);
    if (res.state === "done") return saveResult(job, res.url, res.mime);
    if (res.state === "failed") {
      await s.from("jobs").update({ status: "failed", error: res.error, updated_at: iso() }).eq("id", job.id);
    }
  } catch (e) {
    // Transient network/API hiccup: keep the job running and look again next tick.
    console.error("poll error", job.id, errText(e));
  }
}

export async function tick() {
  const s = db();
  await s.from("jobs").update({ status: "queued", updated_at: iso() }).eq("status", "submitting").lt("updated_at", iso(-120_000));
  await s.from("jobs").update({ status: "running", updated_at: iso() }).eq("status", "saving").lt("updated_at", iso(-180_000));

  const { data: queued } = await s.from("jobs").select("*").eq("status", "queued").order("created_at").limit(3);
  const { data: running } = await s.from("jobs").select("*").eq("status", "running").order("created_at").limit(15);
  await Promise.all([
    ...((queued ?? []) as Job[]).map(submitJob),
    ...((running ?? []) as Job[]).map(pollJob),
  ]);
}
