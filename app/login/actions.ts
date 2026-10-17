"use server";

import { redirect } from "next/navigation";
import { checkPassword, endSession, startSession } from "@/lib/auth";

export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const pw = String(form.get("password") ?? "");
  if (!checkPassword(pw)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return { error: "Wrong password" };
  }
  await startSession();
  redirect("/generate");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
