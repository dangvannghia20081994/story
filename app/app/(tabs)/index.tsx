import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { useColorScheme } from "@/components/useColorScheme";
import { storyUiPalette } from "@/constants/storyUi";
import { apiFetch, type PaginatedStories, type Story } from "@/lib/api";
import { storyGenresLine } from "@/lib/storyGenres";
import { setWebDocumentTitle } from "@/lib/webTitle";

export default function StoriesScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const ui = storyUiPalette(scheme);
  const styles = useMemo(() => createListStyles(ui), [ui]);

  const [items, setItems] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const json = await apiFetch<PaginatedStories>("/api/stories?page=1");
    setItems(json.data);
    setPage(1);
    setLastPage(json.last_page ?? 1);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= lastPage) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const json = await apiFetch<PaginatedStories>(`/api/stories?page=${next}`);
      setItems((prev) => [...prev, ...json.data]);
      setPage(next);
      setLastPage(json.last_page ?? 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, page, lastPage]);

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

  useFocusEffect(
    useCallback(() => {
      setWebDocumentTitle("Truyện");
    }, []),
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: ui.screenBg }]}>
        <ActivityIndicator size="large" color={ui.indigo600} />
        <Text style={{ color: ui.textMuted, marginTop: 12, fontSize: 14 }}>Đang tải truyện…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: ui.screenBg }]}>
      {error ? (
        <Text style={[styles.error, { color: ui.error }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ui.indigo600} />
        }
        onEndReached={() => {
          void loadMore();
        }}
        onEndReachedThreshold={0.35}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 16, alignItems: "center" }}>
              <ActivityIndicator size="small" color={ui.indigo600} />
            </View>
          ) : page < lastPage ? (
            <Pressable
              onPress={() => void loadMore()}
              style={({ pressed }) => [
                styles.loadMoreRow,
                { borderColor: ui.shellBorder, backgroundColor: pressed ? ui.chapterRowHover : ui.shellBg },
              ]}
            >
              <Text style={[styles.loadMoreText, { color: ui.text }]}>Tải thêm truyện</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: ui.textMuted }]}>Chưa có truyện.</Text>
        }
        contentContainerStyle={items.length === 0 ? styles.centered : styles.listContent}
        renderItem={({ item }) => {
          const gLine = storyGenresLine(item);
          const count = item.chapters_count;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: ui.divide, backgroundColor: pressed ? ui.chapterRowHover : "transparent" },
              ]}
              onPress={() => router.push(`/story/${encodeURIComponent(item.slug)}`)}
            >
              <View style={[styles.rowCard, { backgroundColor: ui.shellBg, borderColor: ui.shellBorder }]}>
                <Text style={[styles.title, { color: ui.text }]}>{item.title}</Text>
                <Text style={[styles.meta, { color: ui.textMuted }]}>
                  {[gLine !== "—" ? gLine : null, typeof count === "number" ? `${count} chương` : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function createListStyles(ui: ReturnType<typeof storyUiPalette>) {
  return StyleSheet.create({
    container: { flex: 1 },
    centered: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
    listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 12 },
    row: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingVertical: 6,
    },
    rowCard: {
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 14,
      shadowColor: ui.shadowColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 1,
    },
    title: { fontSize: 17, fontWeight: "600", letterSpacing: -0.2 },
    meta: { marginTop: 6, fontSize: 13 },
    empty: { fontSize: 14 },
    error: { padding: 16, fontSize: 14 },
    loadMoreRow: {
      marginHorizontal: 16,
      marginBottom: 20,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: "center",
    },
    loadMoreText: { fontSize: 14, fontWeight: "600" },
  });
}
