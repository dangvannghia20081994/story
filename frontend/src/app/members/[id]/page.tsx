import { notFound, redirect } from "next/navigation";
import { loadMemberById } from "@/lib/members";
import { storyCharactersHref } from "@/lib/storyPath";

type MemberDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ story?: string }>;
};

/** Đường dẫn cũ `/members/:id` — chuyển về danh sách nhân vật của truyện (không có trang chi tiết nhân vật). */
export default async function MemberDetailPage({ params, searchParams }: MemberDetailPageProps) {
  const { id } = await params;
  const { story } = await searchParams;

  const memberId = Number(id);
  const storyId = story ? Number(story) : undefined;

  if (!Number.isFinite(memberId)) {
    notFound();
  }

  const member = await loadMemberById(memberId, Number.isFinite(storyId) ? storyId : undefined);
  if (!member) {
    notFound();
  }

  redirect(storyCharactersHref({ id: member.story_id, slug: member.story_slug ?? undefined }));
}
