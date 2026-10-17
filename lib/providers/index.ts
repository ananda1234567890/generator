import * as elevenlabs from "./elevenlabs";
import * as leonardo from "./leonardo";
import type { Provider } from "../models";
import type { PollResult, SubmitArgs } from "./types";

export type { FileLoader, PollResult, SubmitArgs } from "./types";

export function submit(args: SubmitArgs): Promise<string> {
  return args.model.provider === "elevenlabs" ? elevenlabs.submit(args) : leonardo.submit(args);
}

export function poll(provider: Provider, kind: "video" | "image", id: string): Promise<PollResult> {
  return provider === "elevenlabs" ? elevenlabs.poll(kind, id) : leonardo.poll(id);
}

export function configured() {
  return {
    elevenlabs: !!process.env.ELEVENLABS_API_KEY,
    leonardo: !!process.env.LEONARDO_API_KEY,
  };
}
