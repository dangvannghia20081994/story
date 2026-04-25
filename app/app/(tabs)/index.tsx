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
import { apiFetch, type PaginatedStories, type Story } from "@/lib/api";
import { genreLabel } from "@/lib/genreLabels";

export default function StoriesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const json = await apiFetch<PaginatedStories>("/api/stories");
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
        renderItem={({ item }) => {
          const g = genreLabel(item.genre);
          const count = item.chapters_count;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push(`/story/${encodeURIComponent(item.slug)}`)}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.muted}>
                {[g, typeof count === "number" ? `${count} chương` : null].filter(Boolean).join(" · ") ||
                  "—"}
              </Text>
            </Pressable>
          );
        }}
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
  error: { color: "#b91c1c", padding: 16, fontSize: 14 },
});
