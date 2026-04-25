"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { createStory, CreateStoryData } from "@/lib/api";

interface StoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (story: { id: number; title: string }) => void;
}

const GENRES = [
  { value: "tu-tien", label: "Tu tiên" },
  { value: "huyen-huyen", label: "Huyền huyền" },
  { value: "kiem-hiep", label: "Kiếm hiệp" },
  { value: "do-thi", label: "Đô thị" },
  { value: "khac", label: "Khác" },
];

export function StoryFormModal({ isOpen, onClose, onSuccess }: StoryFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    genre: "",
    firstChapterTitle: "",
    firstChapterContent: "",
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: "",
        slug: "",
        description: "",
        genre: "",
        firstChapterTitle: "",
        firstChapterContent: "",
      });
      setError(null);
      setTimeout(() => titleRef.current?.focus(), 100);
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
      const data: CreateStoryData = {
        title: formData.title.trim(),
        slug: formData.slug.trim() || undefined,
        description: formData.description.trim() || undefined,
        genre: formData.genre || undefined,
      };

      if (formData.firstChapterTitle.trim() && formData.firstChapterContent.trim()) {
        data.first_chapter = {
          title: formData.firstChapterTitle.trim(),
          content: formData.firstChapterContent.trim(),
        };
      }

      const story = await createStory(data);
      onSuccess?.({ id: story.id, title: story.title });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-form-modal-title"
      className="fixed inset-0 z-[100000] flex min-h-[100dvh] items-center justify-center overflow-y-auto p-4 sm:p-6"
    >
      <div
        className="fixed inset-0 bg-zinc-600/55 dark:bg-zinc-950/80"
        aria-hidden
        onClick={onClose}
      />

      <div className="relative z-10 my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="mb-6 flex items-center justify-between">
          <h2 id="story-form-modal-title" className="text-xl font-bold text-zinc-800 dark:text-zinc-200">
            Tạo truyện mới
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Tên truyện <span className="text-red-500">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Nhập tên truyện"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Slug (URL)
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="tu-tien (tự động tạo nếu để trống)"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Thể loại
            </label>
            <select
              value={formData.genre}
              onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">Chọn thể loại</option>
              {GENRES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Mô tả
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Mô tả ngắn về truyện"
            />
          </div>

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Chương đầu tiên (tùy chọn)
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
                  Tên chương
                </label>
                <input
                  type="text"
                  value={formData.firstChapterTitle}
                  onChange={(e) => setFormData({ ...formData, firstChapterTitle: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="Ví dụ: Chương 1 - Khởi đầu"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
                  Nội dung chương
                </label>
                <textarea
                  value={formData.firstChapterContent}
                  onChange={(e) => setFormData({ ...formData, firstChapterContent: e.target.value })}
                  rows={5}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="Nội dung chương truyện..."
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Đang tạo..." : "Tạo truyện"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}