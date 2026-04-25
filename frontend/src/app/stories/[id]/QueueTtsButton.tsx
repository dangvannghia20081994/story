"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

export function QueueTtsButton({ storyId }: { storyId: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function queue() {
    setMsg(null);
    setBusy(true);
    try {
      await apiFetch(`/api/stories/${storyId}/queue-tts`, { method: "POST", body: "{}" });
      setMsg("Đã xếp hàng. Vài giây sau hãy tải lại trang nếu audio chưa có.");
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={queue}
        disabled={busy}
        className="w-fit rounded border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
      >
        {busy ? "Đang gửi…" : "Xếp hàng TTS"}
      </button>
      {msg ? <p className="text-xs text-zinc-600 dark:text-zinc-400">{msg}</p> : null}
    </div>
  );
}
