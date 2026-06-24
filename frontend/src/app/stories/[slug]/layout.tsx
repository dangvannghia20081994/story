import type { ReactNode } from "react";

import { LexiconProvider } from "@/contexts/LexiconContext";
import { fetchLexiconRowsForStory } from "@/lib/lexiconApi";

export default async function StorySlugLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const initialEntries = await fetchLexiconRowsForStory(slug).catch(() => []);

  return <LexiconProvider initialEntries={initialEntries}>{children}</LexiconProvider>;
}
