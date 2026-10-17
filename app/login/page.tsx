"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-panel p-6">
        <h1 className="text-xl font-semibold">Generator</h1>
        <input name="password" type="password" placeholder="Password" autoFocus required />
        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
        <button
          disabled={pending}
          className="w-full rounded-lg bg-accent px-4 py-2 font-medium disabled:opacity-60"
        >
          {pending ? "Checking…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
