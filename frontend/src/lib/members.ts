import { apiFetch } from "@/lib/api";
import { storyKey } from "@/lib/storyPath";

type StoryLite = {
  id: number;
  slug: string | null;
  title: string;
};

type StoryResponse = {
  data: StoryLite[];
};

export type Member = {
  id: number;
  story_id: number;
  name: string;
  created_at: string | null;
  updated_at: string | null;
  story_title?: string;
  story_slug?: string | null;
};

type MemberDetailResponse = {
  data: Member;
};

async function loadStories(limit = 20): Promise<StoryLite[]> {
  try {
    const res = await apiFetch<StoryResponse>(`/api/stories?per_page=${limit}`);
    return res.data ?? [];
  } catch {
    return [];
  }
}

export async function loadMemberById(
  memberId: number,
  preferredStoryKey?: string | number,
): Promise<Member | null> {
  if (preferredStoryKey != null && preferredStoryKey !== "") {
    const key = encodeURIComponent(String(preferredStoryKey));
    try {
      const res = await apiFetch<MemberDetailResponse>(`/api/stories/${key}/characters/${memberId}`);
      const story = await apiFetch<{ data: { id: number; title: string; slug?: string | null } }>(`/api/stories/${key}`);
      return {
        ...res.data,
        story_title: story.data.title,
        story_slug: story.data.slug ?? null,
      };
    } catch {
      // Continue with fallback scan.
    }
  }

  const stories = await loadStories(40);
  for (const story of stories) {
    try {
      const res = await apiFetch<MemberDetailResponse>(
        `/api/stories/${encodeURIComponent(storyKey(story))}/characters/${memberId}`,
      );
      return {
        ...res.data,
        story_title: story.title,
        story_slug: story.slug,
      };
    } catch {
      // Keep scanning until we find the story that owns this character.
    }
  }

  return null;
}
