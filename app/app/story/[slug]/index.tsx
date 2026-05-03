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
  const twoReadButtons = showResume && resumeChapterId != null;

  return (
    <>
      <Stack.Screen
        options={
          {
            title: headerTitle,
            headerStyle: {
              backgroundColor: scheme === "light" ? ui.indigo50 : ui.screenBg,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: ui.shellBorder,
            },
            headerTitleStyle: {
              color: ui.text,
              fontWeight: "700",
              fontSize: 15,
            },
            headerTintColor: ui.indigo600,
            headerShadowVisible: false,
          } as Record<string, unknown>
        }
      />
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
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <Text style={[styles.error, { color: ui.error }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <View style={[styles.heroBand, { backgroundColor: scheme === "light" ? ui.indigo50 : ui.screenBg }]}>
          <View style={[styles.shell, styles.heroShell, { borderColor: ui.shellBorder, backgroundColor: "transparent" }]}>
            <View style={[styles.heroPoster, { backgroundColor: ui.indigo800 }]}>
              <View
                pointerEvents="none"
                style={[styles.heroPosterGlow, { backgroundColor: ui.accentBarMid }]}
              />
              <View
                pointerEvents="none"
                style={[styles.heroPosterGlow, styles.heroPosterGlow2, { backgroundColor: ui.accentBarRight }]}
              />
              <View style={styles.heroPosterContent}>
                <View style={styles.heroPosterTop}>
                  <View style={styles.heroPosterBadges}>
                    {genreSlugs.map((g) => {
                      const lab = genreLabel(g);
                      return lab ? (
                        <View key={g} style={styles.badgeOnPoster}>
                          <Text style={styles.badgeOnPosterText}>{lab}</Text>
                        </View>
                      ) : null;
                    })}
                    {chaptersTotal > 0 ? (
                      <View style={styles.badgeOnPosterMuted}>
                        <Text style={styles.badgeOnPosterMutedText}>{chaptersTotal} chương</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.heroPosterMark}>
                  <Text style={styles.heroPosterMarkText} allowFontScaling={false}>
                    📚
                  </Text>
                </View>
              </View>
              <View style={[styles.heroPosterFooter, { backgroundColor: ui.accentBarLeft }]} />
            </View>

            <View style={[styles.heroBody, { backgroundColor: ui.shellBg }]}>
              <Text style={[styles.heroTitle, { color: ui.text }]}>{story.title}</Text>
              {story.description ? (
                <Text style={[styles.description, { color: ui.textSecondary }]}>{story.description}</Text>
              ) : (
                <Text style={[styles.mutedText, { color: ui.textMuted }]}>Chưa có mô tả ngắn cho truyện này.</Text>
              )}
              {chaptersTotal > 0 ? (
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: scheme === "light" ? ui.indigo50 : ui.chapterRowBg,
                      borderColor: ui.indigo200,
                    },
                  ]}
                >
                  <Text style={[styles.statCardLabel, { color: ui.textMuted }]}>Audio</Text>
                  <Text style={[styles.audioStat, { color: ui.text }]}>
                    <Text style={{ fontWeight: "800", color: ui.indigo600 }}>{withAudioForStat}</Text>
                    <Text style={{ color: ui.textMuted, fontWeight: "500" }}> / {chaptersTotal}</Text>
                    <Text style={{ color: ui.textSecondary, fontWeight: "500" }}> chương có file</Text>
                  </Text>
                </View>
              ) : null}
              {chapters.length > 0 ? (
                <View style={[styles.heroReadRow, twoReadButtons && styles.heroReadRowTwo]}>
                  <Pressable
                    onPress={openReadFromStart}
                    style={({ pressed }) => [
                      styles.heroReadBtn,
                      twoReadButtons && styles.heroReadBtnGrow,
                      !twoReadButtons && styles.heroReadBtnSingle,
                      styles.primaryBtn,
                      {
                        backgroundColor: ui.primaryButton,
                        opacity: pressed ? 0.92 : 1,
                        shadowColor: ui.indigo900,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: scheme === "light" ? 0.18 : 0.35,
                        shadowRadius: 5,
                        elevation: 2,
                      },
                    ]}
                  >
                    <Text style={styles.primaryBtnText}>Đọc từ đầu</Text>
                  </Pressable>
                  {twoReadButtons ? (
                    <Pressable
                      onPress={() => openRead(resumeChapterId)}
                      style={({ pressed }) => [
                        styles.heroReadBtn,
                        styles.heroReadBtnGrow,
                        styles.outlineReadBtn,
                        {
                          borderColor: ui.indigo600,
                          backgroundColor: scheme === "light" ? "#fff" : ui.shellBg,
                          opacity: pressed ? 0.88 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.outlineReadBtnText, { color: ui.indigo600 }]}>Đọc tiếp</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {chapters.length > 0 && playUrl ? (
          <View style={[styles.shell, styles.playerCard, { backgroundColor: ui.shellBg, borderColor: ui.shellBorder }]}>
            <View style={[styles.playerAccent, { backgroundColor: ui.indigo600 }]} />
            <Text style={[styles.playerLabel, { color: ui.textSecondary }]}>
              Đang chọn · <Text style={{ color: ui.text, fontWeight: "600" }}>{playChapter?.title ?? ""}</Text>
            </Text>
            <Pressable
              onPress={togglePlay}
              style={({ pressed }) => [
                styles.secondaryBtn,
                {
                  borderColor: ui.indigo200,
                  backgroundColor: ui.indigo50,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Text style={[styles.secondaryBtnText, { color: ui.indigo700 }]}>
                {playing ? "Tạm dừng" : "Phát audio"}
              </Text>
            </Pressable>
          </View>
        ) : chapters.length > 0 ? (
          <View style={[styles.hintBox, { backgroundColor: ui.chapterRowBg, borderColor: ui.shellBorder }]}>
            <Text style={[styles.hint, { color: ui.textSecondary }]}>
              Chọn chương có audio trong danh sách, hoặc bấm <Text style={{ fontWeight: "700", color: ui.indigo600 }}>Đọc từ đầu</Text> để dùng đọc máy.
            </Text>
          </View>
        ) : null}

        <View style={[styles.shell, styles.listShell, { backgroundColor: ui.shellBg, borderColor: ui.shellBorder }]}>
          <View style={styles.listHeader}>
            <View style={styles.listHeaderLeft}>
              <View style={[styles.listHeaderMark, { backgroundColor: ui.indigo600 }]} />
              <View style={styles.listHeaderTitleWrap}>
                <Text style={[styles.listHeaderTitle, { color: ui.text }]} numberOfLines={1}>
                  Danh sách{"\u00A0"}chương
                </Text>
              </View>
            </View>
            <View style={[styles.countPill, { backgroundColor: ui.indigo50, borderColor: ui.indigo200 }]}>
              <Text style={[styles.countPillText, { color: ui.indigo700 }]} numberOfLines={1}>
                {chapters.length}
                {hasMoreChapters ? ` / ${chaptersTotal}` : ""}
                {"\u00A0"}chương
              </Text>
            </View>
          </View>
          {chapters.length === 0 ? (
            <Text style={[styles.mutedText, { color: ui.textMuted, paddingVertical: 8 }]}>Truyện này chưa có chương.</Text>
          ) : (
            <View style={styles.chapterList}>
              {chapters.map((chapter, index) => {
                const audio = chapterAudioUrl(chapter);
                const isSelected = chapter.id === playChapterId;
                const hasFile = Boolean(audio);
                return (
                  <View
                    key={chapter.id}
                    style={[
                      styles.chapterCard,
                      {
                        borderColor: isSelected ? ui.indigo600 : ui.shellBorder,
                        backgroundColor: isSelected ? ui.indigo50 : ui.chapterRowBg,
                        shadowColor: ui.shadowColor,
                      },
                    ]}
                  >
                    <View style={styles.chapterCardRow}>
                      <View style={[styles.chapterIndex, { backgroundColor: ui.indigo600 }]}>
                        <Text style={[styles.chapterIndexText, { color: "#fff" }]}>
                          {chapter.chapter_number ?? index + 1}
                        </Text>
                      </View>
                      <View style={styles.chapterMeta}>
                        <Text style={[styles.chapterTitle, { color: ui.text }]} numberOfLines={2}>
                          {chapter.title}
                        </Text>
                        <Text style={[styles.chapterSub, { color: ui.textMuted }]}>
                          {audioStatusLabel(hasFile)}
                          {chapter.duration > 0
                            ? ` · ${Math.floor(chapter.duration / 60)}′${String(Math.floor(chapter.duration % 60)).padStart(2, "0")}″`
                            : ""}
                        </Text>
                      </View>
                      <View style={styles.chapterActions}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.btnRead,
                            {
                              backgroundColor: ui.primaryButton,
                              borderColor: ui.primaryButton,
                              opacity: pressed ? 0.9 : 1,
                            },
                          ]}
                          onPress={() => openRead(chapter.id)}
                        >
                          <Text style={[styles.btnReadText, { color: "#fff" }]}>Đọc</Text>
                        </Pressable>
                        {audio ? (
                          <Pressable
                            style={({ pressed }) => [
                              styles.btnGhost,
                              {
                                borderColor: ui.indigo600,
                                backgroundColor: scheme === "light" ? "#fff" : ui.shellBg,
                                opacity: pressed ? 0.88 : 1,
                              },
                            ]}
                            onPress={() => setPlayChapterId(chapter.id)}
                          >
                            <Text style={[styles.btnGhostText, { color: ui.indigo600 }]}>Phát</Text>
                          </Pressable>
                        ) : null}
                      </View>
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
    scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48, gap: 18 },
    heroBand: {
      marginHorizontal: -16,
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 2,
    },
    shell: {
      borderRadius: 16,
      borderWidth: 1,
      overflow: "hidden",
      shadowColor: ui.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 14,
      elevation: 4,
    },
    heroShell: { borderRadius: 22, overflow: "hidden", backgroundColor: "transparent" },
    heroPoster: {
      minHeight: 152,
      overflow: "hidden",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
    },
    heroPosterGlow: {
      position: "absolute",
      width: 240,
      height: 240,
      borderRadius: 120,
      opacity: 0.38,
      top: -72,
      right: -56,
    },
    heroPosterGlow2: {
      width: 200,
      height: 200,
      borderRadius: 100,
      top: 36,
      left: -80,
      opacity: 0.3,
    },
    heroPosterContent: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 12,
      gap: 6,
    },
    heroPosterTop: { gap: 10 },
    heroPosterBadges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    badgeOnPoster: {
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.34)",
    },
    badgeOnPosterText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.75,
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.96)",
    },
    badgeOnPosterMuted: {
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.22)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.24)",
    },
    badgeOnPosterMutedText: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.92)" },
    heroPosterMark: {
      alignSelf: "center",
      marginTop: 6,
      width: 76,
      height: 76,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.14)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.28)",
    },
    heroPosterMarkText: { fontSize: 36, lineHeight: 40 },
    heroPosterFooter: { height: 3, width: "100%" },
    heroBody: {
      marginTop: -14,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 22,
      gap: 14,
    },
    heroTitle: {
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: -0.55,
      lineHeight: 30,
    },
    description: { fontSize: 15, lineHeight: 23 },
    mutedText: { fontSize: 14, lineHeight: 21 },
    statCard: {
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 4,
    },
    statCardLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
    audioStat: { fontSize: 15, lineHeight: 22 },
    heroReadRow: {
      marginTop: 2,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "stretch",
      gap: 10,
    },
    heroReadRowTwo: { flexWrap: "nowrap" },
    heroReadBtn: {
      minHeight: 44,
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    heroReadBtnGrow: { flex: 1, minWidth: 0, alignSelf: "stretch" },
    heroReadBtnSingle: { alignSelf: "flex-start" },
    primaryBtn: {
      borderWidth: 1,
      borderColor: "transparent",
    },
    primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: -0.15 },
    outlineReadBtn: {
      borderWidth: 1.5,
    },
    outlineReadBtnText: { fontSize: 14, fontWeight: "700", letterSpacing: -0.15 },
    playerCard: { padding: 18, gap: 12, marginTop: 0, position: "relative", overflow: "hidden" },
    playerAccent: { position: "absolute", left: 0, right: 0, top: 0, height: 3 },
    playerLabel: { fontSize: 14, lineHeight: 20, marginTop: 4 },
    secondaryBtn: {
      alignSelf: "flex-start",
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      borderWidth: 1.5,
    },
    secondaryBtnText: { fontSize: 15, fontWeight: "700" },
    hintBox: {
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    hint: { fontSize: 14, lineHeight: 21 },
    listShell: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20, borderRadius: 20 },
    listHeader: {
      flexDirection: "row",
      flexWrap: "nowrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
      marginBottom: 16,
    },
    listHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    listHeaderMark: { width: 4, height: 22, borderRadius: 2, flexShrink: 0 },
    listHeaderTitleWrap: { flex: 1, minWidth: 0, justifyContent: "center" },
    listHeaderTitle: { fontSize: 18, fontWeight: "700", letterSpacing: -0.4 },
    countPill: {
      flexShrink: 0,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    countPillText: { fontSize: 13, fontWeight: "700", letterSpacing: -0.15 },
    chapterList: { gap: 12 },
    chapterCard: {
      borderRadius: 16,
      borderWidth: 1.5,
      paddingVertical: 4,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    chapterCardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    chapterIndex: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    chapterIndexText: { fontSize: 13, fontWeight: "800" },
    chapterMeta: { flex: 1, minWidth: 0, gap: 4 },
    chapterTitle: { fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },
    chapterSub: { fontSize: 12, fontWeight: "500" },
    chapterActions: { flexDirection: "column", gap: 8, alignItems: "stretch", flexShrink: 0 },
    btnRead: {
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 12,
      borderWidth: 1,
      minWidth: 76,
      alignItems: "center",
    },
    btnReadText: { fontSize: 14, fontWeight: "800" },
    btnGhost: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1.5,
      alignItems: "center",
    },
    btnGhostText: { fontSize: 13, fontWeight: "800" },
    loadMoreBtn: {
      marginTop: 14,
      alignSelf: "center",
      paddingVertical: 12,
      paddingHorizontal: 22,
      borderRadius: 14,
      borderWidth: 1.5,
    },
    loadMoreText: { fontSize: 15, fontWeight: "700" },
    error: { marginBottom: 4, fontSize: 14 },
  });
}
