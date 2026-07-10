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
      ? "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-chusa px-5 py-2.5 text-sm font-semibold text-[#f6ede0] transition hover:bg-chusa-deep sm:w-auto"
      : "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-paper-raised px-4 py-2 text-sm font-medium text-ink transition hover:border-chusa/40 hover:text-chusa";

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
