import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { resolveImage } from "@/lib/images";
import { keysFrom } from "@/lib/keys";
import { HEADSHOT_MODEL_ID, getModel } from "@/lib/models";
import { UserError, planInputs, validate } from "@/lib/plan";
import { submit } from "@/lib/providers";
import { parseTags } from "@/lib/tags";
import type { ImageRef, JobParams, SubmitBody, SubmitResult } from "@/lib/types";

export const maxDuration = 60;

// Starts one generation at the provider and returns its id. Nothing is stored.
export async function POST(req: NextRequest) {
  const keys = keysFrom(req.headers);
  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return handle(async () => {
      throw new UserError("Request was empty or too large. Try smaller or fewer images.");
    });
  }
  return handle(async (): Promise<SubmitResult> => {
    const isHeadshot = body.kind === "headshot";
    const model = getModel(isHeadshot ? HEADSHOT_MODEL_ID : body.modelId);
    if (!model || (!isHeadshot && model.kind !== body.kind)) throw new UserError("Unknown model");
    const raw = (body.prompt ?? "").trim();
    if (!raw) throw new UserError("Write a prompt first");
    if (raw.length > 1500) throw new UserError("Prompt is too long (max 1500 characters)");

    const tagged = body.tagged ?? [];
    const { prompt, names } = parseTags(raw, tagged.map((t) => t.name));
    let plan: { startFrame?: ImageRef; endFrame?: ImageRef; refs: ImageRef[]; warnings: string[] };
    let resolution = body.resolution;
    let aspectRatio = body.aspectRatio;
    if (isHeadshot) {
      if (!body.sources?.length || body.sources.length > 5) throw new UserError("Add 1-5 photos of the person");
      plan = { refs: body.sources, warnings: [] };
      resolution = "1K";
      aspectRatio = "3:4";
    } else {
      validate(model, body);
      plan = planInputs<ImageRef>(model, body, tagged.filter((t) => names.includes(t.name)));
    }

    // Give each image a key; the adapters ask for bytes by key.
    const files = new Map<string, { bytes: Buffer; mime: string }>();
    const keyFor = async (ref: ImageRef) => {
      const key = `img${files.size}`;
      files.set(key, await resolveImage(ref));
      return key;
    };
    const params: JobParams = {
      rawPrompt: raw,
      tags: names,
      resolution,
      aspectRatio,
      duration: model.kind === "video" ? body.duration : undefined,
      audio: model.audio ? !!body.audio : undefined,
      startFrame: plan.startFrame ? await keyFor(plan.startFrame) : undefined,
      endFrame: plan.endFrame ? await keyFor(plan.endFrame) : undefined,
      refs: await Promise.all(plan.refs.map(keyFor)),
    };
    const providerJobId = await submit({
      model,
      prompt: isHeadshot ? raw : prompt,
      params,
      load: async (key) => files.get(key)!,
      keys,
    });
    return { providerJobId, prompt: isHeadshot ? raw : prompt, warnings: plan.warnings };
  });
}
