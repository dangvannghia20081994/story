import { Audio } from "expo-av";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Button,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";

import { Text, View } from "@/components/Themed";
import {
  apiFetch,
  chapterAudioUrl,
  parseApiErrorMessage,
  queueChapterTts,
  type Chapter,
  type Story,
} from "@/lib/api";
import { genreLabel } from "@/lib/genreLabels";

type StoryShowResponse = { data: Story };

function statusLabel(status: string): string {
  if (status === "completed") return "Hoàn thành";
  if (status === "processing") return "Đang xử lý";
  if (status === "failed") return "Lỗi";
  return "Chờ render";
}

function slugParam(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v ?? "";
}

export default function StoryDetailScreen() {
  const router = useRouter();
  const { slug: slugParamRaw } = useLocalSearchParams<{ slug: string }>();
  const slug = slugParam(slugParamRaw);
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [queueBusyId, setQueueBusyId] = useState<number | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playChapterId, setPlayChapterId] = useState<number | null>(null);

  const chapters = useMemo(() => {
    const list = [...(story?.chapters ?? [])];
    list.sort((a, b) => a.id - b.id);
    return list;
  }, [story?.chapters]);

  const load = useCallback(async () => {
    setError(null);
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setPlaying(false);
    }
    const key = encodeURIComponent(slug);
    const json = await apiFetch<StoryShowResponse>(`/api/stories/${key}`);
    setStory(json.data);
  }, [slug]);

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
    const withAudio = chapters.find((c) => chapterAudioUrl(c) && c.status === "completed");
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

  async function onQueueTts(chapterId: number) {
    if (!slug) return;
    setQueueBusyId(chapterId);
    setError(null);
    try {
      await queueChapterTts(slug, chapterId, { regenerate: false });
      await load();
    } catch (e) {
      setError(parseApiErrorMessage((e as Error).message));
    } finally {
      setQueueBusyId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!story) {
    return (
      <View style={styles.center}>
        <Text>{error ?? "Không tìm thấy truyện."}</Text>
      </View>
    );
  }

  const genre = genreLabel(story.genre);
  const withAudioCount = chapters.filter((c) => chapterAudioUrl(c)).length;
  const failedChapter = chapters.find((c) => c.status === "failed" && c.error_message);

  return (
    <>
      <Stack.Screen options={{ title: story.title }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <View style={styles.badges}>
          {genre ? (
            <Text style={styles.badge}>{genre}</Text>
          ) : null}
          {typeof story.chapters_count === "number" ? (
            <Text style={styles.badgeMuted}>{story.chapters_count} chương</Text>
          ) : null}
        </View>
        {story.description ? (
          <Text style={styles.description}>{story.description}</Text>
        ) : (
          <Text style={styles.muted}>Chưa có mô tả.</Text>
        )}
        {chapters.length > 0 ? (
          <Text style={styles.muted}>
            {withAudioCount} / {chapters.length} chương đã có file audio.
          </Text>
        ) : null}
        {failedChapter?.error_message ? (
          <Text style={styles.error}>{failedChapter.error_message}</Text>
        ) : null}

        {chapters.length > 0 && playUrl ? (
          <View style={styles.player}>
            <Text style={styles.playerLabel}>Đang phát: {playChapter?.title ?? ""}</Text>
            <Button title={playing ? "Tạm dừng" : "Phát audio"} onPress={togglePlay} />
          </View>
        ) : chapters.length > 0 ? (
          <Text style={styles.muted}>Chọn chương có audio bên dưới (hoặc xếp hàng TTS).</Text>
        ) : null}

        <Text style={styles.sectionTitle}>Danh sách chương</Text>
        {chapters.length === 0 ? (
          <Text style={styles.muted}>Truyện này chưa có chương.</Text>
        ) : (
          chapters.map((chapter, index) => {
            const audio = chapterAudioUrl(chapter);
            const hideTts = chapter.status === "completed" || chapter.status === "failed";
            const isProcessing = chapter.status === "processing";
            const isSelected = chapter.id === playChapterId;
            return (
              <View
                key={chapter.id}
                style={[styles.chapterRow, isSelected && styles.chapterRowSelected]}
              >
                <View style={styles.chapterHead}>
                  <Text style={styles.chapterIndex}>{index + 1}</Text>
                  <View style={styles.chapterMeta}>
                    <Text style={styles.chapterTitle}>{chapter.title}</Text>
                    <Text style={styles.muted}>
                      {statusLabel(chapter.status)}
                      {chapter.duration > 0
                        ? ` · ${Math.floor(chapter.duration / 60)} phút ${chapter.duration % 60}s`
                        : audio
                          ? " · Đã có file"
                          : " · Chưa có audio"}
                    </Text>
                  </View>
                </View>
                <View style={styles.chapterActions}>
                  <Pressable
                    style={({ pressed }) => [styles.btnOutline, pressed && styles.pressed]}
                    onPress={() =>
                      router.push(`/story/${encodeURIComponent(slug)}/read/${chapter.id}`)
                    }
                  >
                    <Text style={styles.btnOutlineText}>Đọc</Text>
                  </Pressable>
                  {audio ? (
                    <Pressable
                      style={({ pressed }) => [styles.btnOutline, pressed && styles.pressed]}
                      onPress={() => setPlayChapterId(chapter.id)}
                    >
                      <Text style={styles.btnOutlineText}>Chọn để phát</Text>
                    </Pressable>
                  ) : null}
                  {!hideTts ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.btnPrimary,
                        (pressed || queueBusyId === chapter.id || isProcessing) && styles.pressed,
                        (queueBusyId === chapter.id || isProcessing) && styles.btnDisabled,
                      ]}
                      disabled={queueBusyId === chapter.id || isProcessing}
                      onPress={() => void onQueueTts(chapter.id)}
                    >
                      <Text style={styles.btnPrimaryText}>
                        {isProcessing
                          ? "Đang TTS…"
                          : queueBusyId === chapter.id
                            ? "Đang gửi…"
                            : "Xếp hàng TTS"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  scroll: { padding: 16, paddingBottom: 32, gap: 10 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(99, 102, 241, 0.15)",
  },
  badgeMuted: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    opacity: 0.7,
  },
  description: { fontSize: 15, lineHeight: 22, marginTop: 4 },
  muted: { fontSize: 13, opacity: 0.65 },
  error: { color: "#b91c1c", marginBottom: 4, fontSize: 14 },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, opacity: 0.5, marginTop: 12 },
  player: { marginVertical: 8, gap: 8 },
  playerLabel: { fontSize: 14 },
  chapterRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    gap: 10,
  },
  chapterRowSelected: { borderColor: "#6366f1", borderWidth: 1.5 },
  chapterHead: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  chapterIndex: {
    width: 28,
    height: 28,
    textAlign: "center",
    lineHeight: 28,
    fontSize: 12,
    fontWeight: "700",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(99, 102, 241, 0.2)",
  },
  chapterMeta: { flex: 1, minWidth: 0 },
  chapterTitle: { fontSize: 16, fontWeight: "600" },
  chapterActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btnOutline: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#999",
  },
  btnOutlineText: { fontSize: 13, fontWeight: "600" },
  btnPrimary: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#4f46e5",
  },
  btnPrimaryText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  btnDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
});
