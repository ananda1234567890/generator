import type { ModelDef } from "./models";

export class UserError extends Error {}

export function validate(model: ModelDef, i: { resolution: string; aspectRatio: string; duration?: number }) {
  if (!model.resolutions.includes(i.resolution)) throw new UserError(`${model.label} does not support ${i.resolution}`);
  if (!model.aspectRatios.includes(i.aspectRatio)) throw new UserError(`${model.label} does not support ${i.aspectRatio}`);
  if (model.durations && !model.durations.includes(i.duration ?? -1)) {
    throw new UserError(`${model.label} does not support a duration of ${i.duration}s`);
  }
}

// Decide where tagged headshots and uploaded frames go, given what the model supports.
export function planInputs<T>(
  model: ModelDef,
  input: { startFrame?: T; endFrame?: T },
  tagged: { name: string; image: T }[],
) {
  const warnings: string[] = [];
  let startFrame = model.kind === "video" ? input.startFrame : undefined;
  let endFrame = model.kind === "video" && model.endFrame ? input.endFrame : undefined;
  if (input.startFrame && model.kind === "video" && !model.startFrame) {
    warnings.push(`${model.label} does not take a start image; it was ignored.`);
    startFrame = undefined;
  }
  if (endFrame && !startFrame) endFrame = undefined;
  let refs: T[] = [];

  if (tagged.length) {
    if (!startFrame && !endFrame && model.maxRefs > 0) {
      refs = tagged.slice(0, model.maxRefs).map((h) => h.image);
      if (tagged.length > model.maxRefs) warnings.push(`${model.label} takes ${model.maxRefs} references; extra tags were ignored.`);
    } else if (model.kind === "video" && !startFrame && model.startFrame) {
      startFrame = tagged[0].image;
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
