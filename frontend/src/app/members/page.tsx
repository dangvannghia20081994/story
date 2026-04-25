import Link from "next/link";
import { FullWidthLayout } from "@/components/layouts";
import { loadMemberDirectory } from "@/lib/members";

export default async function MembersPage() {
  const members = await loadMemberDirectory();

  return (
    <FullWidthLayout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
        <header className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/70">
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Danh sach thanh vien</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Danh sach nhan vat tu cac truyen trong he thong.
          </p>
        </header>

        {members.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/70">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Chua co thanh vien de hien thi.</p>
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <Link
                key={member.id}
                href={`/members/${member.id}?story=${member.story_id}`}
                className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-600"
              >
                <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">{member.name}</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Voice ID: {member.voice_id}</p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  Truyen: <span className="font-medium">{member.story_title ?? `#${member.story_id}`}</span>
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    Pitch {member.pitch.toFixed(2)}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    Rate {member.rate.toFixed(2)}
                  </span>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </FullWidthLayout>
  );
}
