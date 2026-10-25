import { UserError } from "./plan";
import type { Provider } from "./models";

export type Keys = Partial<Record<Provider, string>>;

export const KEY_HEADERS: Record<Provider, string> = {
  elevenlabs: "x-elevenlabs-key",
  leonardo: "x-leonardo-key",
};

export const PROVIDER_NAMES: Record<Provider, string> = { elevenlabs: "ElevenLabs", leonardo: "Leonardo" };

// Keys live in the browser and travel with each request. The server never stores them.
export function keysFrom(headers: Headers): Keys {
  const keys: Keys = {};
  for (const p of Object.keys(KEY_HEADERS) as Provider[]) {
    const v = headers.get(KEY_HEADERS[p])?.trim();
    if (v && v.length <= 300 && /^[\x21-\x7e]+$/.test(v)) keys[p] = v;
  }
  return keys;
}

export function requireKey(keys: Keys, provider: Provider): string {
  const k = keys[provider];
  if (!k) throw new UserError(`${PROVIDER_NAMES[provider]} API key is missing. Add it in Settings.`);
  return k;
}
