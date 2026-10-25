import { ElevenLabsClient, type ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { requireKey, type Keys } from "../keys";
import type { PollResult, SubmitArgs } from "./types";

const api = (keys: Keys) => new ElevenLabsClient({ apiKey: requireKey(keys, "elevenlabs") });

type Mime = ElevenLabs.InlineImageReferenceMimeType;
const MIMES: string[] = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

async function inline(path: string, load: SubmitArgs["load"]): Promise<ElevenLabs.ImageReference> {
  const { bytes, mime } = await load(path);
  const m = MIMES.includes(mime) ? mime : "image/jpeg";
  return { type: "inline_base64", contentBase64: bytes.toString("base64"), mimeType: m as Mime };
}

export async function submit({ model, prompt, params, load, keys }: SubmitArgs): Promise<string> {
  const c = api(keys);
  const refs = await Promise.all(params.refs.map((p) => inline(p, load)));

  if (model.kind === "image") {
    const req: Record<string, unknown> = {
      modelId: model.providerModel,
      prompt,
      aspectRatio: params.aspectRatio,
    };
    if (refs.length) req.images = refs;
    if (model.providerModel === "gemini-3-pro-image") req.resolution = params.resolution;
    if (model.providerModel === "gpt-image-2") req.quality = params.resolution;
    const res = await c.flows.image.create(req as unknown as ElevenLabs.ImageGenerationRequest);
    return res.id;
  }

  const isVeo = model.providerModel.startsWith("veo-");
  const req: Record<string, unknown> = {
    modelId: model.providerModel,
    prompt,
    durationSecs: params.duration,
    resolution: params.resolution,
    generateAudio: params.audio ?? true,
  };
  if (params.startFrame) {
    req.startFrame = await inline(params.startFrame, load);
    // Aspect ratio comes from the start frame.
    if (isVeo) req.aspectRatio = params.aspectRatio;
  } else {
    req.aspectRatio = params.aspectRatio;
  }
  if (params.endFrame) req.endFrame = await inline(params.endFrame, load);
  if (refs.length && !params.startFrame && !params.endFrame && !isVeo) req.images = refs;
  const res = await c.flows.video.create(req as unknown as ElevenLabs.VideoGenerationRequest);
  return res.id;
}

export async function poll(kind: "video" | "image", id: string, keys: Keys): Promise<PollResult> {
  const c = api(keys);
  const res = kind === "video" ? await c.flows.video.get(id) : await c.flows.image.get(id);
  if (res.status === "completed") return { state: "done", url: res.contentUrl, mime: res.contentMimeType };
  if (res.status === "failed") {
    return { state: "failed", error: `${res.failureReason}: ${res.errorMessage}` };
  }
  return { state: "running" };
}
