"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AddChapterModal } from "@/components/AddChapterModal";

type Props = {
  storyKey: string;
  storyTitle: string;
  /** secondary = viền; primary = đặc (trang trống chương) */
  variant?: "primary" | "secondary";
};

export function StoryAddChapterButton({ storyKey, storyTitle, variant = "secondary" }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const btnClass =
    variant === "primary"
      ? "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:bg-indigo-500 sm:w-auto"
      : "inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-200";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnClass}>
        <span aria-hidden>＋</span>
        Thêm chương
      </button>
      <AddChapterModal
        isOpen={open}
        onClose={() => setOpen(false)}
        storyKey={storyKey}
        storyTitle={storyTitle}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
