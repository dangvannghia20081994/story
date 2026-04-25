import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";
import { apiFetch } from "@/lib/api";

type StoryRow = {
  id: number;
  title: string;
  tts_status: string;
  audio_url: string | null;
};

type Paginated = { data: StoryRow[] };

export default function StoriesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const json = await apiFetch<Paginated>("/api/stories");
    setItems(json.data);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Đang tải truyện…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.muted}>Chưa có truyện.</Text>}
        contentContainerStyle={items.length === 0 ? styles.centered : undefined}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push(`/story/${item.id}`)}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.muted}>TTS: {item.tts_status}</Text>
            {item.audio_url ? (
              <Text style={styles.linkHint}>Có audio — mở chi tiết để nghe</Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
  },
  rowPressed: { opacity: 0.7 },
  title: { fontSize: 17, fontWeight: "600" },
  muted: { marginTop: 4, fontSize: 13, opacity: 0.65 },
  linkHint: { marginTop: 6, fontSize: 12, color: "#2563eb" },
  error: { color: "#b91c1c", padding: 16, fontSize: 14 },
});
