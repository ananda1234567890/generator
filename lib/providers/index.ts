import * as elevenlabs from "./elevenlabs";
import * as leonardo from "./leonardo";
import type { Keys } from "../keys";
import type { Provider } from "../models";
import type { PollResult, SubmitArgs } from "./types";

export type { FileLoader, PollResult, SubmitArgs } from "./types";

export function submit(args: SubmitArgs): Promise<string> {
  return args.model.provider === "elevenlabs" ? elevenlabs.submit(args) : leonardo.submit(args);
}

export function poll(provider: Provider, kind: "video" | "image", id: string, keys: Keys): Promise<PollResult> {
  return provider === "elevenlabs" ? elevenlabs.poll(kind, id, keys) : leonardo.poll(id, keys);
}
