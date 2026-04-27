import AsyncStorage from "@react-native-async-storage/async-storage";

/** Một key JSON: map slug truyện → chương đọc gần nhất (id API). Web dùng localStorage qua AsyncStorage. */
const STORAGE_KEY = "@story_last_chapter_v1";

type ProgressEntry = { chapterId: number; updatedAt: number };
type ProgressMap = Record<string, ProgressEntry>;

async function loadMap(): Promise<ProgressMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as ProgressMap;
  } catch {
    return {};
  }
}

async function saveMap(map: ProgressMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export async function getLastReadChapterId(slug: string): Promise<number | null> {
  if (!slug) {
    return null;
  }
  const map = await loadMap();
  const e = map[slug];
  const id = e?.chapterId;
  return typeof id === "number" && Number.isFinite(id) ? id : null;
}

export async function setLastReadChapter(slug: string, chapterId: number): Promise<void> {
  if (!slug || !Number.isFinite(chapterId)) {
    return;
  }
  const map = await loadMap();
  map[slug] = { chapterId, updatedAt: Date.now() };
  await saveMap(map);
}
