"use client";

import { useEffect } from "react";
import { startEngine } from "@/lib/client/store";

// Mounted once in the app layout: runs the submit/poll loop while the tab is open.
export function Engine() {
  useEffect(() => startEngine(), []);
  return null;
}
