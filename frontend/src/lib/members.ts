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
  voice_id: string;
  pitch: number;
  rate: number;
  created_at: string | null;
  updated_at: string | null;
  story_title?: string;
};

type MemberResponse = {
  data: Member[];
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

export async function loadMemberDirectory(): Promise<Member[]> {
  const stories = await loadStories(20);
  if (stories.length === 0) {
    return [];
  }

  const nestedMembers = await Promise.all(
    stories.map(async (story) => {
      try {
        const res = await apiFetch<MemberResponse>(
          `/api/stories/${encodeURIComponent(storyKey(story))}/characters?per_page=50`,
        );
        return (res.data ?? []).map((member) => ({
          ...member,
          story_title: story.title,
        }));
      } catch {
        return [];
      }
    }),
  );

  const unique = new Map<number, Member>();
  nestedMembers.flat().forEach((member) => {
    if (!unique.has(member.id)) {
      unique.set(member.id, member);
    }
  });

  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function loadMemberById(
  memberId: number,
  preferredStoryKey?: string | number,
): Promise<Member | null> {
  if (preferredStoryKey != null && preferredStoryKey !== "") {
    const key = encodeURIComponent(String(preferredStoryKey));
    try {
      const res = await apiFetch<MemberDetailResponse>(`/api/stories/${key}/characters/${memberId}`);
      const story = await apiFetch<{ data: { id: number; title: string } }>(`/api/stories/${key}`);
      return {
        ...res.data,
        story_title: story.data.title,
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
      };
    } catch {
      // Keep scanning until we find the story that owns this member.
    }
  }

  return null;
}
