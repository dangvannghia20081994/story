"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface QueueChapterTtsButtonProps {
  storyId: number;
  chapterId: number;
}

export function QueueChapterTtsButton({ storyId, chapterId }: QueueChapterTtsButtonProps) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function queue() {
    setMsg(null);
    setBusy(true);
    try {
      await apiFetch(`/api/stories/${storyId}/chapters/${chapterId}/queue-tts`, {
        method: "POST",
        body: "{}",
      });
      setMsg("Đã xếp hàng!");
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={queue}
        disabled={busy}
        className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
      >
        {busy ? "..." : "Render"}
      </button>
      {msg && <span className="text-xs text-green-600">{msg}</span>}
    </div>
  );
}