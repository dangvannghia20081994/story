"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { storyDetailHref } from "@/lib/storyPath";

export function CreateStoryForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const created = await apiFetch<{ id: number; slug: string }>("/api/stories", {
        method: "POST",
        body: JSON.stringify({ title, content }),
      });
      setTitle("");
      setContent("");
      router.push(storyDetailHref(created));
      router.refresh();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Tạo truyện</h2>
      <input
        className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        placeholder="Tiêu đề"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        className="min-h-[120px] w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        placeholder="Nội dung (sẽ đưa vào hàng đợi TTS)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
      />
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {busy ? "Đang gửi…" : "Lưu"}
      </button>
    </form>
  );
}
