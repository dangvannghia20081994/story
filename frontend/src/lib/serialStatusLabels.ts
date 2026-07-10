/** Khớp `App\Models\Story::SERIAL_STATUS_LABELS` (API `serial_status`). */

export function serialStatusLabel(status: string | null | undefined): string | null {
  if (status === "completed") return "Hoàn thành";
  if (status === "ongoing") return "Đang ra";
  return null;
}

export function serialStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "completed":
      return "border-ngoc/30 bg-ngoc/10 text-ngoc";
    case "ongoing":
      return "border-chusa/30 bg-chusa/10 text-chusa";
    default:
      return "border-line bg-paper-inset text-ink-faint";
  }
}
