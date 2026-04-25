"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface QueueChapterTtsButtonProps {
  storySlug: string;
  chapterId: number;
  /** Trạng thái TTS chương — dùng để nhãn nút và gửi `regenerate` khi cần. */
  status: string;
}

function parseApiErrorMessage(raw: string): string {
  try {
    const j = JSON.parse(raw) as { message?: string };
    if (typeof j.message === "string" && j.message.trim() !== "") {
      return j.message;
    }
  } catch {
    /* not JSON */
  }
  return raw || "Lỗi không xác định";
}

export function QueueChapterTtsButton({ storySlug, chapterId, status }: QueueChapterTtsButtonProps) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isProcessing = status === "processing";
  /** Tạm ẩn UI TTS cho chương đã xong / lỗi — trước đây là nút "TTS lại" (`regenerate: true`). */
  const hideTtsForCompletedOrFailed = status === "completed" || status === "failed";
  const label = isProcessing ? "Đang TTS…" : "Xếp hàng TTS";

  async function queue() {
    setMsg(null);
    setErr(null);
    setBusy(true);
    try {
      await apiFetch(`/api/stories/${encodeURIComponent(storySlug)}/chapters/${chapterId}/queue-tts`, {
        method: "POST",
        body: JSON.stringify({ regenerate: false }),
      });
      setMsg("Đã xếp hàng!");
      router.refresh();
    } catch (e) {
      setErr(parseApiErrorMessage((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  if (hideTtsForCompletedOrFailed) {
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
      <button
        type="button"
        onClick={queue}
        disabled={busy || isProcessing}
        title={
          isProcessing
            ? "Chờ worker xử lý xong rồi mới xếp hàng tiếp."
            : "Đẩy job TTS lên hàng đợi."
        }
        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 transition hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800/80 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
      >
        {busy ? "Đang gửi…" : label}
      </button>
      {msg ? (
        <span className="max-w-[14rem] text-right text-xs text-emerald-700 dark:text-emerald-400">{msg}</span>
      ) : null}
      {err ? (
        <span className="max-w-[14rem] text-right text-xs text-red-700 dark:text-red-400">{err}</span>
      ) : null}
    </div>
  );
}