import { ASPECT_DIMS } from "../models";
import type { PollResult, SubmitArgs } from "./types";

const BASE = "https://cloud.leonardo.ai/api/rest";

function headers() {
  const key = process.env.LEONARDO_API_KEY;
  if (!key) throw new Error("LEONARDO_API_KEY is not set");
  return {
    accept: "application/json",
    "content-type": "application/json",
    authorization: `Bearer ${key}`,
  };
}

async function call(method: "GET" | "POST", path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {}
  if (!res.ok) throw new Error(`Leonardo ${res.status}: ${text.slice(0, 400)}`);
  return json;
}

// Find the first value for `key` anywhere in a JSON tree. Leonardo's docs do not
// show full response schemas, so we search instead of hard-coding one path.
function findKey(node: unknown, key: string): unknown {
  if (!node || typeof node !== "object") return undefined;
  if (key in (node as Record<string, unknown>)) return (node as Record<string, unknown>)[key];
  for (const v of Object.values(node as Record<string, unknown>)) {
    const hit = findKey(v, key);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

function findVideoUrl(node: unknown): string | null {
  if (typeof node === "string") return /^https?:\/\/.+\.mp4(\?|$)/i.test(node) ? node : null;
  if (!node || typeof node !== "object") return null;
  const motion = (node as Record<string, unknown>).motionMP4URL;
  if (typeof motion === "string") return motion;
  for (const v of Object.values(node as Record<string, unknown>)) {
    const hit = findVideoUrl(v);
    if (hit) return hit;
  }
  return null;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function upload(path: string, load: SubmitArgs["load"]): Promise<string> {
  const { bytes, mime } = await load(path);
  const ext = EXT[mime] ?? "jpg";
  const init = (await call("POST", "/v1/init-image", { extension: ext })) as {
    uploadInitImage: { url: string; fields: string; id: string };
  };
  const { url, fields, id } = init.uploadInitImage;
  const form = new FormData();
  for (const [k, v] of Object.entries(JSON.parse(fields) as Record<string, string>)) form.append(k, v);
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), `upload.${ext}`);
  const up = await fetch(url, { method: "POST", body: form }); // no auth header on the presigned upload
  if (!up.ok) throw new Error(`Leonardo image upload failed (${up.status})`);
  return id;
}

export async function submit({ model, prompt, params, load }: SubmitArgs): Promise<string> {
  if (model.kind !== "video") throw new Error("Leonardo adapter only does video");
  const dims = ASPECT_DIMS[params.resolution]?.[params.aspectRatio];
  if (!dims) throw new Error(`No size for ${params.resolution} ${params.aspectRatio}`);
  const [width, height] = dims;
  const startId = params.startFrame ? await upload(params.startFrame, load) : null;
  const endId = params.endFrame ? await upload(params.endFrame, load) : null;
  const m = model.providerModel;

  // Kling 2.5 Turbo uses the older image-to-video endpoint.
  if (m === "Kling2_5") {
    if (!startId) throw new Error("Kling 2.5 Turbo needs a start image");
    const body: Record<string, unknown> = {
      prompt,
      imageId: startId,
      imageType: "UPLOADED",
      duration: params.duration,
      width,
      height,
      resolution: "RESOLUTION_1080",
      isPublic: false,
    };
    if (endId) body.endFrameImage = { id: endId, type: "UPLOADED" };
    // The docs spell the model id two ways; try both.
    let last: unknown;
    for (const id of ["Kling2_5", "KLING2_5"]) {
      try {
        const res = await call("POST", "/v1/generations-image-to-video", { ...body, model: id });
        return String(findKey(res, "generationId"));
      } catch (e) {
        last = e;
        if (!/model/i.test(String(e))) break;
      }
    }
    throw last;
  }

  const parameters: Record<string, unknown> = { prompt, duration: params.duration, width, height };
  if (m === "kling-3.0") parameters.mode = params.resolution === "720p" ? "RESOLUTION_720" : "RESOLUTION_1080";
  if (m === "seedance-2.0") parameters.mode = `RESOLUTION_${params.resolution.replace("p", "")}`;
  if (m.includes("seedance")) parameters.quantity = 1;
  if (model.audio) parameters.motion_has_audio = params.audio ?? true;

  const guidances: Record<string, unknown> = {};
  if (startId) guidances.start_frame = [{ image: { id: startId, type: "UPLOADED" } }];
  if (endId) guidances.end_frame = [{ image: { id: endId, type: "UPLOADED" } }];
  if (!startId && !endId && params.refs.length) {
    const ids = await Promise.all(params.refs.map((p) => upload(p, load)));
    guidances.image_reference = ids.map((id) => ({
      image: { id, type: "UPLOADED" },
      ...(m === "seedance-2.0" ? { strength: "MID" } : {}),
    }));
  }
  if (Object.keys(guidances).length) parameters.guidances = guidances;

  const res = await call("POST", "/v2/generations", { model: m, public: false, parameters });
  const id = findKey(res, "generationId");
  if (!id) throw new Error(`Leonardo did not return a generation id: ${JSON.stringify(res).slice(0, 300)}`);
  return String(id);
}

export async function poll(id: string): Promise<PollResult> {
  const res = await call("GET", `/v1/generations/${id}`);
  const status = String(findKey(res, "status") ?? "").toUpperCase();
  if (status === "FAILED") return { state: "failed", error: "Leonardo reported the generation failed" };
  const url = findVideoUrl(res);
  if (url) return { state: "done", url, mime: "video/mp4" };
  if (status === "COMPLETE") {
    return { state: "failed", error: `Finished but no video URL found: ${JSON.stringify(res).slice(0, 300)}` };
  }
  return { state: "running" };
}
