import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useColorScheme } from "@/components/useColorScheme";
import { storyUiPalette } from "@/constants/storyUi";
import { apiFetch, type Chapter, type Story, type StoryReadNavigation } from "@/lib/api";
import { setLastReadChapter } from "@/lib/readProgress";
import {
  clearReadChapterAutoplay,
  consumeReadChapterAutoplay,
  queueReadChapterAutoplay,
} from "@/lib/readChapterAutoplay";
import { speakChapterContent, stopChapterSpeech } from "@/lib/readSpeech";
import { setWebDocumentTitle } from "@/lib/webTitle";

type StoryShowResponse = {
  data: Story & {
    read_chapter?: Chapter;
    read_navigation?: StoryReadNavigation;
  };
};

function slugParam(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v ?? "";
}

function idParam(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : NaN;
}

export default function ReadChapterScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const ui = storyUiPalette(scheme);
  const styles = useMemo(() => createReadStyles(ui), [ui]);

  const { slug: slugRaw, chapterId: chapterRaw } = useLocalSearchParams<{
    slug: string;
    chapterId: string;
  }>();
  const slug = slugParam(slugRaw);
  const chapterId = idParam(chapterRaw);
  const [story, setStory] = useState<(Story & { read_chapter?: Chapter; read_navigation?: StoryReadNavigation }) | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const key = encodeURIComponent(slug);
    const json = await apiFetch<StoryShowResponse>(
      `/api/stories/${key}?read_chapter=${chapterId}`,
    );
    setStory(json.data);
  }, [slug, chapterId]);

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
      stopChapterSpeech();
      setSpeaking(false);
    };
  }, [chapterId]);

  const nav = story?.read_navigation;
  const chapter = story?.read_chapter;
  const index = nav != null ? Math.max(0, nav.chapter_index - 1) : -1;
  const totalChapters = nav?.chapters_total ?? 0;
  const prev = nav?.prev ?? null;
  const next = nav?.next ?? null;

  const goChapter = useCallback(
    (id: number) => {
      clearReadChapterAutoplay();
      stopChapterSpeech();
      setSpeaking(false);
      router.replace(`/story/${encodeURIComponent(slug)}/read/${id}`);
    },
    [slug, router],
  );

  /** Vuốt ngang (kéo tay sang trái / dx âm): chương sau; vuốt phải: chương trước — giống lật trang. Capture khi ưu tiên ngang rõ để ít chặn cuộn dọc. */
  const swipeNavRef = useRef({ prevId: null as number | null, nextId: null as number | null, ready: false });
  swipeNavRef.current = {
    ready: Boolean(story && chapter && !Number.isNaN(chapterId) && nav),
    prevId: prev?.id ?? null,
    nextId: next?.id ?? null,
  };

  const chapterSwipePan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderRelease: (_, g) => {
          const { ready, prevId, nextId } = swipeNavRef.current;
          if (!ready) return;
          const minDx = 52;
          if (g.dx <= -minDx && nextId != null) {
            goChapter(nextId);
          } else if (g.dx >= minDx && prevId != null) {
            goChapter(prevId);
          }
        },
      }),
    [goChapter],
  );

  const goStory = () => {
    clearReadChapterAutoplay();
    stopChapterSpeech();
    setSpeaking(false);
    router.push(`/story/${encodeURIComponent(slug)}`);
  };

  /** Sau khi tải xong: nếu vừa chuyển chương để nối tiếp đọc thì bắt đầu TTS. */
  useEffect(() => {
    if (loading || !chapter?.content?.trim() || !Number.isFinite(chapterId)) return;
    if (!consumeReadChapterAutoplay(slug, chapterId)) return;
    stopChapterSpeech();
    setSpeaking(true);
    speakChapterContent(chapter.content, {
      onEnd: () => setSpeaking(false),
      onNaturalComplete: () => {
        if (next?.id) {
          queueReadChapterAutoplay(slug, next.id);
          router.replace(`/story/${encodeURIComponent(slug)}/read/${next.id}`);
        }
      },
    });
  }, [loading, chapter?.id, chapter?.content, chapterId, slug, router, next?.id]);

  const toggleSpeak = useCallback(() => {
    if (!chapter?.content?.trim()) return;
    if (speaking) {
      stopChapterSpeech();
      setSpeaking(false);
      clearReadChapterAutoplay();
      return;
    }
    stopChapterSpeech();
    setSpeaking(true);
    speakChapterContent(chapter.content, {
      onEnd: () => setSpeaking(false),
      onNaturalComplete: () => {
        if (next?.id) {
          queueReadChapterAutoplay(slug, next.id);
          router.replace(`/story/${encodeURIComponent(slug)}/read/${next.id}`);
        }
      },
    });
  }, [chapter?.content, speaking, next?.id, slug, router]);

  const headerTitle = useMemo(() => {
    if (loading) {
      return "Đang tải…";
    }
    if (chapter?.title) {
      return chapter.title;
    }
    if (story?.title) {
      return story.title;
    }
    return "Chương";
  }, [loading, chapter?.title, story?.title]);

  useEffect(() => {
    setWebDocumentTitle(headerTitle);
    return () => setWebDocumentTitle(null);
  }, [headerTitle]);

  const readReady = Boolean(story && chapter && !Number.isNaN(chapterId) && nav);

  useEffect(() => {
    if (!readReady || !slug || chapter?.id == null) {
      return;
    }
    void setLastReadChapter(slug, chapter.id);
  }, [readReady, slug, chapter?.id]);

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />
      {loading ? (
        <View style={[styles.center, { backgroundColor: ui.screenBg }]}>
          <ActivityIndicator size="large" color={ui.indigo600} />
          <Text style={{ color: ui.textMuted, marginTop: 12 }}>Đang tải chương…</Text>
        </View>
      ) : !readReady ? (
        <View style={[styles.center, { backgroundColor: ui.screenBg }]}>
          <Text style={{ color: ui.error, textAlign: "center", paddingHorizontal: 24 }}>
            {error ?? "Không tìm thấy chương."}
          </Text>
          <Pressable
            onPress={goStory}
            style={({ pressed }) => [styles.backLink, { borderColor: ui.zinc200, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={{ color: ui.text, fontWeight: "600" }}>← Về trang truyện</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.root, { backgroundColor: ui.screenBg }]} {...chapterSwipePan.panHandlers}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollInner}
            keyboardShouldPersistTaps="handled"
          >
            {error ? (
              <Text style={[styles.error, { color: ui.error }]} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <View style={[styles.article, { backgroundColor: ui.shellBg, borderColor: ui.shellBorder }]}>
              <View style={styles.accentBar}>
                <View style={[styles.accentSeg, { backgroundColor: ui.accentBarLeft }]} />
                <View style={[styles.accentSeg, { backgroundColor: ui.accentBarMid }]} />
                <View style={[styles.accentSeg, { backgroundColor: ui.accentBarRight }]} />
              </View>
              <View style={styles.articleBody}>
                <Text style={[styles.storyTitle, { color: ui.text }]}>{story.title}</Text>
                <Text style={[styles.chapterHeading, { color: ui.textSecondary }]}>{chapter.title}</Text>

                <Pressable
                  onPress={toggleSpeak}
                  style={({ pressed }) => [
                    styles.speakBtn,
                    { backgroundColor: ui.primaryButton, opacity: pressed ? 0.9 : 1 },
                  ]}
                >
                  <Text style={styles.speakBtnText}>{speaking ? "Dừng đọc" : "Đọc chương (máy)"}</Text>
                </Pressable>

                <Text style={[styles.body, { color: ui.text }]}>{chapter.content}</Text>
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: ui.divide, backgroundColor: ui.shellBg }]}>
            <View style={[styles.footerNav, { borderTopColor: ui.divide }]}>
              <Pressable
                onPress={() => prev && goChapter(prev.id)}
                disabled={!prev}
                style={({ pressed }) => [
                  styles.navBtn,
                  { borderColor: ui.zinc200, backgroundColor: ui.chapterRowHover },
                  !prev && styles.navBtnDisabled,
                  pressed && prev && { opacity: 0.88 },
                ]}
              >
                <Text style={[styles.navBtnText, { color: prev ? ui.text : ui.textMuted }]}>← Trước</Text>
              </Pressable>
              <View style={[styles.navCounter, { backgroundColor: ui.zinc100 }]}>
                <Text style={[styles.navCounterText, { color: ui.textSecondary }]}>
                  {index + 1} / {totalChapters}
                </Text>
              </View>
              <Pressable
                onPress={() => next && goChapter(next.id)}
                disabled={!next}
                style={({ pressed }) => [
                  styles.navBtn,
                  { borderColor: ui.zinc200, backgroundColor: ui.chapterRowHover },
                  !next && styles.navBtnDisabled,
                  pressed && next && { opacity: 0.88 },
                ]}
              >
                <Text style={[styles.navBtnText, { color: next ? ui.text : ui.textMuted }]}>Sau →</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

function createReadStyles(ui: ReturnType<typeof storyUiPalette>) {
  return StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
    backLink: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
    scroll: { flex: 1 },
    scrollInner: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
    article: {
      borderRadius: 16,
      borderWidth: 1,
      overflow: "hidden",
      maxWidth: 720,
      alignSelf: "center",
      width: "100%",
      shadowColor: ui.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 3,
    },
    accentBar: { flexDirection: "row", height: 4 },
    accentSeg: { flex: 1 },
    articleBody: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 28, gap: 14 },
    chapterBadgeWrap: { alignItems: "center" },
    chapterBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
    chapterBadgeText: { fontSize: 11, fontWeight: "700" },
    storyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center", lineHeight: 26 },
    chapterHeading: { fontSize: 16, fontWeight: "600", textAlign: "center", lineHeight: 22 },
    speakBtn: { alignSelf: "center", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, marginTop: 4 },
    speakBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    body: { fontSize: 17, lineHeight: 30, marginTop: 8 },
    error: { marginBottom: 8, fontSize: 14 },
    footer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingBottom: 12,
      paddingTop: 8,
      paddingHorizontal: 16,
    },
    footerNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    navBtn: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center",
    },
    navBtnDisabled: { opacity: 0.45 },
    navBtnText: { fontSize: 13, fontWeight: "700" },
    navCounter: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
    navCounterText: { fontSize: 11, fontWeight: "700" },
  });
}
