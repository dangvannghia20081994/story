"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";

import { LexiconProvider } from "@/contexts/LexiconContext";

export default function StorySlugLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const raw = params?.slug;
  const storySlug = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");

  return <LexiconProvider storyKey={storySlug}>{children}</LexiconProvider>;
}
