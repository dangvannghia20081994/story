import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { useColorScheme } from "@/components/useColorScheme";
import { storyUiPalette } from "@/constants/storyUi";
import { apiFetch, type PaginatedStories, type Story } from "@/lib/api";
import { buildPublicStoriesApiPath } from "@/lib/storiesListQuery";
import { storyGenresLine } from "@/lib/storyGenres";
import { setWebDocumentTitle } from "@/lib/webTitle";

const QUICK_FILTERS = [
  { id: "all", label: "Tất cả", icon: "th" },
  { id: "newest", label: "Mới nhất", icon: "star" },
  { id: "trending", label: "Xu hướng", icon: "fire" },
  { id: "completed", label: "Hoàn thành", icon: "check" },
];

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
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [apiQ, setApiQ] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    const trimmed = searchText.trim().slice(0, 200);
    if (trimmed === "") {
      setApiQ("");
      return;
    }
    const id = setTimeout(() => setApiQ(trimmed), 350);
    return () => clearTimeout(id);
  }, [searchText]);

  const load = useCallback(async () => {
    setError(null);
    const extra =
      activeFilter === "completed"
        ? { serial_status: "completed" as const }
        : activeFilter === "newest"
          ? { sort: "created_desc" as const }
          : {};
    const path = buildPublicStoriesApiPath(1, { q: apiQ, ...extra });
    const json = await apiFetch<PaginatedStories>(path);
    setItems(json.data);
    setPage(1);
    setLastPage(json.last_page ?? 1);
  }, [apiQ, activeFilter]);

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= lastPage) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const extra =
        activeFilter === "completed"
          ? { serial_status: "completed" as const }
          : activeFilter === "newest"
            ? { sort: "created_desc" as const }
            : {};
      const path = buildPublicStoriesApiPath(next, { q: apiQ, ...extra });
      const json = await apiFetch<PaginatedStories>(path);
      setItems((prev) => [...prev, ...json.data]);
      setPage(next);
      setLastPage(json.last_page ?? 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, page, lastPage, apiQ, activeFilter]);

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
      {/* Header Section - Outside FlatList */}
      <View style={[styles.header, { backgroundColor: ui.screenBg, borderBottomColor: ui.shellBorder }]}>
        <View style={styles.headerContent}>
          {/* Search Bar */}
          <View style={[
            styles.searchContainer, 
            { 
              backgroundColor: ui.shellBg, 
              borderColor: searchFocused ? ui.indigo600 : ui.shellBorder,
            }
          ]}>
            <FontAwesome name="search" size={14} color={ui.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: ui.text }]}
              placeholder="Tìm theo tiêu đề…"
              placeholderTextColor={ui.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onSubmitEditing={() => setApiQ(searchText.trim().slice(0, 200))}
              returnKeyType="search"
              selectionColor={ui.indigo600}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={200}
            />
          </View>

          {/* Quick Filters */}
          <ScrollView 
            style={styles.filtersScroll}
            contentContainerStyle={styles.filtersContainer}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
          >
            {QUICK_FILTERS.map((filter) => (
              <Pressable
                key={filter.id}
                onPress={() => setActiveFilter(filter.id)}
                style={({ pressed }) => [
                  styles.filterPill,
                  {
                    backgroundColor:
                      activeFilter === filter.id ? ui.indigo600 : ui.pillBg,
                    borderColor:
                      activeFilter === filter.id ? ui.indigo600 : ui.pillBorder,
                  },
                ]}
              >
                <FontAwesome
                  name={filter.icon as any}
                  size={12}
                  color={activeFilter === filter.id ? ui.white : ui.indigo600}
                />
                <Text
                  style={[
                    styles.filterText,
                    {
                      color:
                        activeFilter === filter.id ? ui.white : ui.text,
                    },
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      {error ? (
        <Text style={[styles.error, { color: ui.error }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={true}
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
                { 
                  borderColor: ui.indigo200, 
                  backgroundColor: pressed ? ui.indigo50 : "transparent"
                },
              ]}
            >
              <FontAwesome name="plus" size={16} color={ui.indigo600} />
              <Text style={[styles.loadMoreText, { color: ui.indigo600 }]}>Tải thêm truyện</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: ui.textMuted }]}>
            {apiQ.trim() !== "" ? "Không có truyện phù hợp." : "Chưa có truyện."}
          </Text>
        }
        contentContainerStyle={items.length === 0 ? styles.centered : styles.listContent}
        renderItem={({ item }) => {
          const gLine = storyGenresLine(item);
          const count = item.chapters_count;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.storyCard,
                { 
                  backgroundColor: pressed ? ui.chapterRowHover : ui.shellBg,
                  borderColor: ui.shellBorder,
                },
              ]}
              onPress={() => router.push(`/story/${encodeURIComponent(item.slug)}`)}
            >
              <View style={styles.storyContent}>
                <View style={styles.storyHeader}>
                  <Text 
                    style={[styles.storyTitle, { color: ui.text }]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  {count && count > 0 && (
                    <View style={[styles.chapterBadge, { backgroundColor: ui.indigo100 }]}>
                      <Text style={[styles.chapterBadgeText, { color: ui.indigo700 }]}>
                        {count}
                      </Text>
                    </View>
                  )}
                </View>

                {item.description && (
                  <Text 
                    style={[styles.storyDescription, { color: ui.textMuted }]}
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                )}

                <View style={styles.storyMeta}>
                  {gLine !== "—" && (
                    <View style={[styles.genrePill, { backgroundColor: ui.pillBg, borderColor: ui.pillBorder }]}>
                      <FontAwesome name="tag" size={11} color={ui.indigo600} />
                      <Text style={[styles.genreText, { color: ui.text }]}>
                        {gLine}
                      </Text>
                    </View>
                  )}
                  {count && (
                    <Text style={[styles.metaText, { color: ui.textMuted }]}>
                      <FontAwesome name="book" size={11} /> {count} chương
                    </Text>
                  )}
                </View>
              </View>
              <View style={[styles.cardAccent, { backgroundColor: ui.indigo600 }]} />
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

    // Header Styles
    header: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 16,
    },
    headerContent: {
      gap: 12,
    },
    headerTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: "700",
      letterSpacing: -1,
    },
    headerSubtitle: {
      fontSize: 13,
      fontWeight: "500",
      letterSpacing: -0.2,
      marginTop: 2,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "600",
    },

    // Search Bar
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 0,
      borderRadius: 12,
      borderWidth: 1.5,
      marginTop: 4,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: "500",
      paddingVertical: 11,
      paddingHorizontal: 0,
      outlineWidth: 0,
      borderWidth: 0,
      color: "inherit",
      outline: "none",
    },

    // Quick Filters
    filtersScroll: {
      marginTop: 4,
      marginHorizontal: -20,
    },
    filtersContainer: {
      paddingHorizontal: 20,
      gap: 8,
      alignItems: "center",
    },
    filterPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
    },
    filterText: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: -0.2,
    },

    // List Content
    listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28, gap: 12 },

    // Story Card Styles
    storyCard: {
      borderRadius: 16,
      borderWidth: 1,
      overflow: "hidden",
      flexDirection: "row",
      shadowColor: ui.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    storyContent: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 8,
    },
    storyHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
    },
    storyTitle: {
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: -0.3,
      flex: 1,
    },
    chapterBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      minWidth: 32,
      alignItems: "center",
      flexShrink: 0,
    },
    chapterBadgeText: {
      fontSize: 12,
      fontWeight: "600",
    },
    storyDescription: {
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: -0.2,
    },
    storyMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
      marginTop: 2,
    },
    genrePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
    },
    genreText: {
      fontSize: 12,
      fontWeight: "500",
      letterSpacing: -0.1,
    },
    metaText: {
      fontSize: 12,
      fontWeight: "500",
      letterSpacing: -0.1,
    },
    cardAccent: {
      width: 4,
    },

    // Load More
    loadMoreRow: {
      marginHorizontal: 16,
      marginBottom: 20,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    loadMoreText: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },

    // Other
    empty: { fontSize: 15, fontWeight: "500" },
    error: { padding: 16, fontSize: 14, fontWeight: "600" },
  });
}
