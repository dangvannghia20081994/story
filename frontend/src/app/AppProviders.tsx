"use client";

import type { ReactNode } from "react";

import { AudioReadSleepProvider } from "@/contexts/AudioReadSleepContext";
import { LexiconProvider } from "@/contexts/LexiconContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LexiconProvider>
      <AudioReadSleepProvider>{children}</AudioReadSleepProvider>
    </LexiconProvider>
  );
}
