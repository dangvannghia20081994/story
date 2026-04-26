import Link from "next/link";
import { notFound } from "next/navigation";
import { FullWidthLayout } from "@/components/layouts";
import { loadMemberById } from "@/lib/members";

type MemberDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ story?: string }>;
};

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

  return (
    <FullWidthLayout>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 md:p-10">
        <Link href="/members" className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400">
          ← Danh sách thành viên
        </Link>

        <section className="rounded-2xl border border-white/70 bg-white/75 p-6 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75">
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{member.name}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Thuộc truyện: <span className="font-medium">{member.story_title ?? `#${member.story_id}`}</span>
          </p>
        </section>

        <section className="rounded-2xl border border-white/70 bg-white/75 p-6 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">ID</p>
          <p className="mt-1 text-base font-semibold text-zinc-800 dark:text-zinc-100">{member.id}</p>
        </section>
      </div>
    </FullWidthLayout>
  );
}
