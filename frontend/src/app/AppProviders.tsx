"use client";

import type { ReactNode } from "react";

import { AudioReadSleepProvider } from "@/contexts/AudioReadSleepContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return <AudioReadSleepProvider>{children}</AudioReadSleepProvider>;
}
