"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { createStoryChapter } from "@/lib/api";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  storyKey: string;
  storyTitle: string;
  onSuccess?: () => void;
};

export function AddChapterModal({ isOpen, onClose, storyKey, storyTitle, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [chapterNumber, setChapterNumber] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setContent("");
      setChapterNumber("");
      setError(null);
      setTimeout(() => titleRef.current?.focus(), 80);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const n = chapterNumber.trim() === "" ? null : parseInt(chapterNumber, 10);
      await createStoryChapter(storyKey, {
        title: title.trim(),
        content: content.trim(),
        chapter_number: n != null && Number.isFinite(n) && n >= 1 ? n : null,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được chương");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-chapter-modal-title"
      className="fixed inset-0 z-[100000] flex min-h-[100dvh] items-center justify-center overflow-y-auto p-4 sm:p-6"
    >
      <div className="fixed inset-0 bg-zinc-600/55 dark:bg-zinc-950/80" aria-hidden onClick={onClose} />

      <div className="relative z-10 my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="add-chapter-modal-title" className="text-xl font-bold text-zinc-800 dark:text-zinc-200">
              Thêm chương
            </h2>
            <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400" title={storyTitle}>
              {storyTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Đóng"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {error ? (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          ) : null}

          <div>
            <label htmlFor="add-chapter-title" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Tiêu đề chương <span className="text-red-500">*</span>
            </label>
            <input
              id="add-chapter-title"
              ref={titleRef}
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Ví dụ: Chương 12 — …"
            />
          </div>

          <div>
            <label htmlFor="add-chapter-num" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Số thứ tự chương <span className="font-normal text-zinc-500">(tùy chọn)</span>
            </label>
            <input
              id="add-chapter-num"
              type="number"
              min={1}
              value={chapterNumber}
              onChange={(e) => setChapterNumber(e.target.value)}
              className="w-full max-w-[12rem] rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Để trống = tự gán"
            />
          </div>

          <div>
            <label htmlFor="add-chapter-content" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nội dung <span className="text-red-500">*</span>
            </label>
            <textarea
              id="add-chapter-content"
              required
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Nội dung chương…"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Đang lưu…" : "Lưu chương"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
