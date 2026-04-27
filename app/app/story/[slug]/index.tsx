import { useFocusEffect } from "@react-navigation/native";
import { Audio } from "expo-av";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColorScheme } from "@/components/useColorScheme";
import { apiFetch, chapterAudioUrl, type Chapter, type Story } from "@/lib/api";
import { getLastReadChapterId } from "@/lib/readProgress";
import { setWebDocumentTitle } from "@/lib/webTitle";
import { genreLabel } from "@/lib/genreLabels";
import { storyGenreSlugs } from "@/lib/storyGenres";
import { storyUiPalette } from "@/constants/storyUi";

type StoryShowResponse = { data: Story };

const CHAPTER_PAGE_SIZE = 25;

function storyDetailChaptersQuery(slug: string, offset: number): string {
  const k = encodeURIComponent(slug);
  return `/api/stories/${k}?chapters_order=asc&chapters_full=0&chapters_limit=${CHAPTER_PAGE_SIZE}&chapters_offset=${offset}&chapters_omit_content=1`;
}

/** Khớp thứ tự `Chapter::scopeChapterNumberSort` (null sau, rồi số, rồi id). */
function chapterReadOrder(a: Chapter, b: Chapter): number {
  const aN = a.chapter_number;
  const bN = b.chapter_number;
  const aMissing = aN == null || aN === undefined;
  const bMissing = bN == null || bN === undefined;
  if (aMissing && bMissing) {
    return a.id - b.id;
  }
  if (aMissing) {
    return 1;
  }
  if (bMissing) {
    return -1;
  }
  if (aN !== bN) {
    return aN - bN;
  }

  return a.id - b.id;
}

function audioStatusLabel(hasFile: boolean): string {
  return hasFile ? "Đã có file audio" : "Chưa có file";
}

function slugParam(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v ?? "";
}

export default function StoryDetailScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const ui = storyUiPalette(scheme);
  const styles = useMemo(() => createStyles(ui), [ui]);

  const { slug: slugParamRaw } = useLocalSearchParams<{ slug: string }>();
  const slug = slugParam(slugParamRaw);
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playChapterId, setPlayChapterId] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollLoadLock = useRef(false);
  const [resumeChapterId, setResumeChapterId] = useState<number | null>(null);

  const chapters = useMemo(() => {
    const list = [...(story?.chapters ?? [])];
    list.sort(chapterReadOrder);
    return list;
  }, [story?.chapters]);

  const load = useCallback(async () => {
    setError(null);
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setPlaying(false);
    }
    const json = await apiFetch<StoryShowResponse>(storyDetailChaptersQuery(slug, 0));
    setStory(json.data);
  }, [slug]);

  const loadMoreChapters = useCallback(async () => {
    if (!slug || loadingMore || !story) {
      return;
    }
    const total = story.chapters_total ?? story.chapters_count ?? story.chapters?.length ?? 0;
    const have = story.chapters?.length ?? 0;
    if (have >= total) {
      return;
    }
    setLoadingMore(true);
    try {
      const json = await apiFetch<StoryShowResponse>(storyDetailChaptersQuery(slug, have));
      const batch = json.data.chapters ?? [];
      if (batch.length === 0) {
        setStory((prev) => {
          if (!prev) {
            return prev;
          }
          const have = prev.chapters?.length ?? 0;

          return { ...prev, chapters_total: have };
        });
        return;
      }
      setStory((prev) => {
        if (!prev) {
          return prev;
        }
        const byId = new Map<number, Chapter>();
        for (const c of prev.chapters ?? []) {
          byId.set(c.id, c);
        }
        for (const c of batch) {
          byId.set(c.id, c);
        }
        const merged = Array.from(byId.values());
        merged.sort(chapterReadOrder);
        return {
          ...prev,
          chapters: merged,
          chapters_total: json.data.chapters_total ?? prev.chapters_total,
          chapters_with_audio_total:
            json.data.chapters_with_audio_total ?? prev.chapters_with_audio_total,
        };
      });
    } finally {
      setLoadingMore(false);
    }
  }, [slug, loadingMore, story?.chapters?.length, story?.chapters_total, story?.chapters_count]);

  const onScrollNearEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (contentSize.height <= 0) {
        return;
      }
      const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;
      if (!nearBottom || scrollLoadLock.current || loadingMore || !story) {
        return;
      }
      const total = story.chapters_total ?? story.chapters_count ?? story.chapters?.length ?? 0;
      const have = story.chapters?.length ?? 0;
      if (have >= total) {
        return;
      }
      scrollLoadLock.current = true;
      void loadMoreChapters().finally(() => {
        setTimeout(() => {
          scrollLoadLock.current = false;
        }, 400);
      });
    },
    [loadMoreChapters, loadingMore, story?.chapters?.length, story?.chapters_total, story?.chapters_count],
  );

  const refreshResumeChapter = useCallback(async () => {
    if (!slug) {
      setResumeChapterId(null);
      return;
    }
    try {
      const id = await getLastReadChapterId(slug);
      setResumeChapterId(id);
    } catch {
      setResumeChapterId(null);
    }
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const run = () => {
        if (cancelled) return;
        void refreshResumeChapter();
      };
      run();
      const t = setTimeout(run, 120);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }, [refreshResumeChapter]),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
      setPlaying(false);
    };
  }, [playChapterId]);

  const defaultPlayId = useMemo(() => {
    if (chapters.length === 0) return null;
    const withAudio = chapters.find((c) => chapterAudioUrl(c));
    return (withAudio ?? chapters[0]).id;
  }, [chapters]);

  useEffect(() => {
    if (playChapterId == null && defaultPlayId != null) {
      setPlayChapterId(defaultPlayId);
    }
  }, [defaultPlayId, playChapterId]);

  const playChapter = chapters.find((c) => c.id === playChapterId) ?? chapters[0];
  const playUrl = chapterAudioUrl(playChapter);

  async function togglePlay() {
    if (!playUrl) {
      return;
    }
    const current = soundRef.current;
    if (current) {
      const st = await current.getStatusAsync();
      if (st.isLoaded && st.isPlaying) {
        await current.pauseAsync();
        setPlaying(false);
        return;
      }
      if (st.isLoaded) {
        await current.playAsync();
        setPlaying(true);
        return;
      }
    }
    if (Platform.OS !== "web") {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    }
    const { sound: s } = await Audio.Sound.createAsync({ uri: playUrl }, { shouldPlay: true });
    soundRef.current = s;
    setPlaying(true);
    s.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
        setPlaying(false);
      }
    });
  }

  const openRead = (chapterId: number) => {
    router.push(`/story/${encodeURIComponent(slug)}/read/${chapterId}`);
  };

  const openReadFromStart = () => {
    if (chapters.length === 0) return;
    openRead(chapters[0].id);
  };

  const headerTitle = useMemo(() => {
    if (loading) {
      return "Đang tải…";
    }
    if (story) {
      return story.title;
    }
    return "Truyện";
  }, [loading, story?.title]);

  useEffect(() => {
    setWebDocumentTitle(headerTitle);
    return () => setWebDocumentTitle(null);
  }, [headerTitle]);

  const genreSlugs = story ? storyGenreSlugs(story) : [];
  const withAudioInLoaded = story ? chapters.filter((c) => chapterAudioUrl(c)).length : 0;
  const chaptersTotal =
    story != null ? (story.chapters_total ?? story.chapters_count ?? chapters.length) : 0;
  const withAudioForStat =
    story != null && typeof story.chapters_with_audio_total === "number"
      ? story.chapters_with_audio_total
      : withAudioInLoaded;
  const hasMoreChapters = story != null && chapters.length < chaptersTotal;

  const firstChapterId = chapters[0]?.id;
  const showResume =
    resumeChapterId != null &&
    firstChapterId != null &&
    resumeChapterId !== firstChapterId;

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />
      {loading ? (
        <View style={[styles.center, { backgroundColor: ui.screenBg }]}>
          <ActivityIndicator size="large" color={ui.indigo600} />
          <Text style={[styles.mutedText, { color: ui.textMuted }]}>Đang tải…</Text>
        </View>
      ) : !story ? (
        <View style={[styles.center, { backgroundColor: ui.screenBg }]}>
          <Text style={{ color: ui.error, textAlign: "center" }}>{error ?? "Không tìm thấy truyện."}</Text>
        </View>
      ) : (
      <ScrollView
        style={{ flex: 1, backgroundColor: ui.screenBg }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={400}
        onScroll={onScrollNearEnd}
      >
        {error ? (
          <Text style={[styles.error, { color: ui.error }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <View style={[styles.shell, { backgroundColor: ui.shellBg, borderColor: ui.shellBorder }]}>
          <View style={styles.accentBar}>
            <View style={[styles.accentSeg, { backgroundColor: ui.accentBarLeft }]} />
            <View style={[styles.accentSeg, { backgroundColor: ui.accentBarMid }]} />
            <View style={[styles.accentSeg, { backgroundColor: ui.accentBarRight }]} />
          </View>
          <View style={styles.heroInner}>
            <View style={styles.badges}>
              {genreSlugs.map((g) => {
                const lab = genreLabel(g);
                return lab ? (
                  <View
                    key={g}
                    style={[styles.badgeGenre, { borderColor: ui.indigo200, backgroundColor: ui.indigo50 }]}
                  >
                    <Text style={[styles.badgeGenreText, { color: ui.indigoTextOnSoft }]}>{lab}</Text>
                  </View>
                ) : null;
              })}
              {chaptersTotal > 0 ? (
                <View style={[styles.badgeMuted, { borderColor: ui.pillBorder, backgroundColor: ui.zinc100 }]}>
                  <Text style={[styles.badgeMutedText, { color: ui.textSecondary }]}>
                    {chaptersTotal} chương
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.title, { color: ui.text }]}>{story.title}</Text>
            {story.description ? (
              <Text style={[styles.description, { color: ui.textSecondary }]}>{story.description}</Text>
            ) : (
              <Text style={[styles.mutedText, { color: ui.textMuted }]}>Chưa có mô tả ngắn cho truyện này.</Text>
            )}
            {chaptersTotal > 0 ? (
              <Text style={[styles.audioStat, { color: ui.textSecondary }]}>
                <Text style={{ fontWeight: "600", color: ui.text }}>{withAudioForStat}</Text>
                {" / "}
                {chaptersTotal} chương đã có file audio.
              </Text>
            ) : null}
            {chapters.length > 0 ? (
              <View style={styles.heroReadRow}>
                <Pressable
                  onPress={openReadFromStart}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: ui.primaryButton, opacity: pressed ? 0.9 : 1 },
                  ]}
                >
                  <Text style={styles.primaryBtnText}>Đọc từ đầu</Text>
                </Pressable>
                {showResume && resumeChapterId != null ? (
                  <Pressable
                    onPress={() => openRead(resumeChapterId)}
                    style={({ pressed }) => [
                      styles.outlineReadBtn,
                      {
                        borderColor: ui.indigo200,
                        backgroundColor: ui.shellBg,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.outlineReadBtnText, { color: ui.indigo700 }]}>Đọc tiếp</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {chapters.length > 0 && playUrl ? (
          <View style={[styles.shell, styles.playerCard, { backgroundColor: ui.shellBg, borderColor: ui.shellBorder }]}>
            <Text style={[styles.playerLabel, { color: ui.textSecondary }]}>
              Đang chọn: {playChapter?.title ?? ""}
            </Text>
            <Pressable
              onPress={togglePlay}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { borderColor: ui.zinc200, backgroundColor: ui.chapterRowHover, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.secondaryBtnText, { color: ui.text }]}>{playing ? "Tạm dừng" : "Phát audio"}</Text>
            </Pressable>
          </View>
        ) : chapters.length > 0 ? (
          <Text style={[styles.hint, { color: ui.textMuted }]}>
            Chọn chương có audio trong danh sách, hoặc bấm Đọc từ đầu để dùng đọc máy.
          </Text>
        ) : null}

        <View style={[styles.shell, styles.listShell, { backgroundColor: ui.shellBg, borderColor: ui.shellBorder }]}>
          <View style={styles.listHeader}>
            <Text style={[styles.listHeaderTitle, { color: ui.textMuted }]}>Danh sách chương</Text>
            <View style={[styles.countPill, { backgroundColor: ui.zinc100 }]}>
              <Text style={[styles.countPillText, { color: ui.textSecondary }]}>
                {chapters.length}
                {hasMoreChapters ? ` / ${chaptersTotal}` : ""} chương
              </Text>
            </View>
          </View>
          {chapters.length === 0 ? (
            <Text style={[styles.mutedText, { color: ui.textMuted, paddingVertical: 8 }]}>Truyện này chưa có chương.</Text>
          ) : (
            <View style={[styles.listBorder, { borderColor: ui.divide, backgroundColor: ui.chapterRowBg }]}>
              {chapters.map((chapter, index) => {
                const audio = chapterAudioUrl(chapter);
                const isSelected = chapter.id === playChapterId;
                const hasFile = Boolean(audio);
                const isLast = index === chapters.length - 1;
                return (
                  <View
                    key={chapter.id}
                    style={[
                      styles.chapterRow,
                      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ui.divide },
                      isSelected && { backgroundColor: ui.indigo50 },
                    ]}
                  >
                    <View style={styles.chapterHead}>
                      <View style={[styles.chapterIndex, { backgroundColor: ui.zinc200 }]}>
                        <Text style={[styles.chapterIndexText, { color: ui.textSecondary }]}>
                          {chapter.chapter_number ?? index + 1}
                        </Text>
                      </View>
                      <View style={styles.chapterMeta}>
                        <Text style={[styles.chapterTitle, { color: ui.text }]}>{chapter.title}</Text>
                        <Text style={[styles.chapterSub, { color: ui.textMuted }]}>
                          {audioStatusLabel(hasFile)}
                          {chapter.duration > 0
                            ? ` · ${Math.floor(chapter.duration / 60)} phút ${chapter.duration % 60}s`
                            : ""}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.chapterActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.btnRead,
                          { borderColor: ui.zinc200, backgroundColor: ui.shellBg, opacity: pressed ? 0.85 : 1 },
                        ]}
                        onPress={() => openRead(chapter.id)}
                      >
                        <Text style={[styles.btnReadText, { color: ui.text }]}>Đọc</Text>
                      </Pressable>
                      {audio ? (
                        <Pressable
                          style={({ pressed }) => [
                            styles.btnGhost,
                            { borderColor: ui.indigo200, opacity: pressed ? 0.85 : 1 },
                          ]}
                          onPress={() => setPlayChapterId(chapter.id)}
                        >
                          <Text style={[styles.btnGhostText, { color: ui.indigo700 }]}>Chọn phát</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {hasMoreChapters ? (
            <Pressable
              onPress={() => void loadMoreChapters()}
              disabled={loadingMore}
              style={({ pressed }) => [
                styles.loadMoreBtn,
                { borderColor: ui.zinc200, backgroundColor: ui.shellBg, opacity: loadingMore ? 0.6 : pressed ? 0.88 : 1 },
              ]}
            >
              <Text style={[styles.loadMoreText, { color: ui.text }]}>
                {loadingMore ? "Đang tải…" : `Tải thêm (${chapters.length}/${chaptersTotal})`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      )}
    </>
  );
}

function createStyles(ui: ReturnType<typeof storyUiPalette>) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
    scroll: { padding: 16, paddingBottom: 40, gap: 14 },
    shell: {
      borderRadius: 16,
      borderWidth: 1,
      overflow: "hidden",
      shadowColor: ui.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 2,
    },
    accentBar: { flexDirection: "row", height: 4 },
    accentSeg: { flex: 1 },
    heroInner: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, gap: 12 },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    badgeGenre: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
    },
    badgeGenreText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
    badgeMuted: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
    badgeMutedText: { fontSize: 12, fontWeight: "500" },
    title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5, lineHeight: 34 },
    description: { fontSize: 15, lineHeight: 22 },
    mutedText: { fontSize: 14, lineHeight: 20 },
    audioStat: { fontSize: 14 },
    heroReadRow: {
      marginTop: 4,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 10,
    },
    primaryBtn: {
      alignSelf: "flex-start",
      paddingVertical: 14,
      paddingHorizontal: 22,
      borderRadius: 12,
    },
    primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    outlineReadBtn: {
      alignSelf: "flex-start",
      paddingVertical: 14,
      paddingHorizontal: 22,
      borderRadius: 12,
      borderWidth: 1,
    },
    outlineReadBtnText: { fontSize: 15, fontWeight: "700" },
    playerCard: { padding: 16, gap: 10, marginTop: 0 },
    playerLabel: { fontSize: 14 },
    secondaryBtn: { alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1 },
    secondaryBtnText: { fontSize: 14, fontWeight: "600" },
    hint: { fontSize: 13, paddingHorizontal: 4, lineHeight: 20 },
    listShell: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 },
    listHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
    listHeaderTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
    countPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    countPillText: { fontSize: 12, fontWeight: "600" },
    listBorder: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
    chapterRow: { paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
    chapterHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    chapterIndex: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    chapterIndexText: { fontSize: 12, fontWeight: "700" },
    chapterMeta: { flex: 1, minWidth: 0, gap: 2 },
    chapterTitle: { fontSize: 16, fontWeight: "600" },
    chapterSub: { fontSize: 12 },
    chapterActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    btnRead: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1 },
    btnReadText: { fontSize: 12, fontWeight: "700" },
    btnGhost: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, backgroundColor: "transparent" },
    btnGhostText: { fontSize: 12, fontWeight: "700" },
    loadMoreBtn: {
      marginTop: 12,
      alignSelf: "center",
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 12,
      borderWidth: 1,
    },
    loadMoreText: { fontSize: 14, fontWeight: "600" },
    error: { marginBottom: 4, fontSize: 14 },
  });
}
