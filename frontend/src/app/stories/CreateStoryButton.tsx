"use client";

import { useState } from "react";
import { StoryFormModal } from "@/components/StoryFormModal";

export function CreateStoryButton() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
      >
        Thêm truyện
      </button>

      <StoryFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={({ id }) => {
          window.location.href = `/stories/${id}`;
        }}
      />
    </>
  );
}