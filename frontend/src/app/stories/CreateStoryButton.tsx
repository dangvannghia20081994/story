"use client";

import { useState } from "react";
import { StoryFormModal } from "@/components/StoryFormModal";
import { storyDetailHref } from "@/lib/storyPath";

export function CreateStoryButton() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="rounded-lg bg-chusa px-3 py-2 text-sm font-semibold text-[#f6ede0] transition hover:bg-chusa-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chusa"
      >
        Thêm truyện
      </button>

      <StoryFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={(story) => {
          window.location.href = storyDetailHref(story);
        }}
      />
    </>
  );
}