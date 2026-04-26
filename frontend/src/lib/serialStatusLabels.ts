/** Khớp `App\Models\Story::SERIAL_STATUS_LABELS` (API `serial_status`). */

export function serialStatusLabel(status: string | null | undefined): string | null {
  if (status === "completed") return "Hoàn thành";
  if (status === "ongoing") return "Đang ra";
  return null;
}

export function serialStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-950/50 dark:text-emerald-200";
    case "ongoing":
      return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-100";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400";
  }
}
