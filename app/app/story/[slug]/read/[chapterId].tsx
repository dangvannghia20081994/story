import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Speech from "expo-speech";
import { ActivityIndicator, Button, ScrollView, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import { apiFetch, type Story } from "@/lib/api";

type StoryShowResponse = { data: Story };

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
  const { slug: slugRaw, chapterId: chapterRaw } = useLocalSearchParams<{
    slug: string;
    chapterId: string;
  }>();
  const slug = slugParam(slugRaw);
  const chapterId = idParam(chapterRaw);
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  const load = useCallback(async () => {
    setError(null);
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
      Speech.stop();
      setSpeaking(false);
    };
  }, [chapterId]);

  const chapters = useMemo(() => {
    const list = [...(story?.chapters ?? [])];
    list.sort((a, b) => a.id - b.id);
    return list;
  }, [story?.chapters]);

  const index = chapters.findIndex((c) => c.id === chapterId);
  const chapter = index >= 0 ? chapters[index] : null;
  const prev = index > 0 ? chapters[index - 1] : null;
  const next = index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : null;

  const goChapter = (id: number) => {
    Speech.stop();
    setSpeaking(false);
    router.replace(`/story/${encodeURIComponent(slug)}/read/${id}`);
  };

  const toggleSpeak = useCallback(() => {
    if (!chapter?.content?.trim()) return;
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    Speech.stop();
    const text = chapter.content.replace(/\s+/g, " ").trim();
    setSpeaking(true);
    Speech.speak(text, {
      language: "vi-VN",
      pitch: 1.0,
      rate: 0.95,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }, [chapter?.content, speaking]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!story || !chapter || Number.isNaN(chapterId)) {
    return (
      <View style={styles.center}>
        <Text>{error ?? "Không tìm thấy chương."}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: chapter.title }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Text style={styles.storyTitle}>{story.title}</Text>
        <Text style={styles.chapterHeading}>{chapter.title}</Text>
        <View style={styles.speakRow}>
          <Button title={speaking ? "Dừng đọc" : "Đọc chương (máy)"} onPress={toggleSpeak} />
        </View>
        <Text style={styles.body}>{chapter.content}</Text>
        <View style={styles.nav}>
          {prev ? (
            <Button title={`← ${prev.title}`} onPress={() => goChapter(prev.id)} />
          ) : (
            <View style={styles.navSpacer} />
          )}
          {next ? (
            <Button title={`${next.title} →`} onPress={() => goChapter(next.id)} />
          ) : (
            <View style={styles.navSpacer} />
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },
  storyTitle: { fontSize: 13, opacity: 0.55 },
  chapterHeading: { fontSize: 20, fontWeight: "700" },
  speakRow: { marginTop: 4, marginBottom: 8 },
  body: { fontSize: 17, lineHeight: 28 },
  error: { color: "#b91c1c" },
  nav: { marginTop: 20, gap: 12 },
  navSpacer: { minHeight: 36 },
});
