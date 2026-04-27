import Constants from "expo-constants";
import { Platform } from "react-native";

const appName = (Constants.expoConfig?.name as string | undefined)?.trim() || "Story";

/**
 * Trên web, tiêu đề tab trình duyệt (`document.title`) không theo header native.
 * Gọi khi đổi màn hình / tiêu đề; `title` rỗng → chỉ `appName`.
 */
export function setWebDocumentTitle(title: string | null | undefined): void {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return;
  }
  const t = title != null ? String(title).trim() : "";
  document.title = t ? `${t} · ${appName}` : appName;
}
