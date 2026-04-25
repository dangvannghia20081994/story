import { Audio } from "expo-av";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Button, ScrollView, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import { apiFetch } from "@/lib/api";

type StoryDetail = {
  data: {
    id: number;
    title: string;
    content: string;
    tts_status: string;
    tts_error: string | null;
    audio_url: string | null;
  };
};

export default function StoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<StoryDetail["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [queueBusy, setQueueBusy] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setPlaying(false);
    }
    const json = await apiFetch<StoryDetail>(`/api/stories/${id}`);
    setDetail(json.data);
  }, [id]);

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
    };
  }, []);

  async function queueTts() {
    if (!id) {
      return;
    }
    setQueueBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/stories/${id}/queue-tts`, { method: "POST", body: "{}" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setQueueBusy(false);
    }
  }

  async function togglePlay() {
    const url = detail?.audio_url;
    if (!url) {
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
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound: s } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
    soundRef.current = s;
    setPlaying(true);
    s.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
        setPlaying(false);
      }
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.center}>
        <Text>{error ?? "Không tìm thấy truyện."}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: detail.title }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Text style={styles.meta}>TTS: {detail.tts_status}</Text>
        {detail.tts_error ? <Text style={styles.error}>{detail.tts_error}</Text> : null}
        <Button title={queueBusy ? "Đang gửi…" : "Xếp hàng TTS"} onPress={queueTts} disabled={queueBusy} />
        {detail.audio_url ? (
          <View style={styles.player}>
            <Button title={playing ? "Tạm dừng" : "Phát audio"} onPress={togglePlay} />
          </View>
        ) : null}
        <Text style={styles.body}>{detail.content}</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  scroll: { padding: 16, gap: 12 },
  meta: { fontSize: 14, opacity: 0.7 },
  body: { marginTop: 8, fontSize: 16, lineHeight: 24 },
  error: { color: "#b91c1c", marginBottom: 8 },
  player: { marginVertical: 8 },
});
