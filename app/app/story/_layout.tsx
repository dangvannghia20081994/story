import { Stack } from "expo-router";
import { StyleSheet } from "react-native";

import { useColorScheme } from "@/components/useColorScheme";
import { storyUiPalette } from "@/constants/storyUi";

export default function StoryStackLayout() {
  const scheme = (useColorScheme() ?? "light") === "dark" ? "dark" : "light";
  const c = storyUiPalette(scheme);

  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Truyện",
        headerStyle: {
          backgroundColor: scheme === "light" ? c.indigo50 : c.screenBg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: c.shellBorder,
        },
        headerTintColor: c.indigo600,
        headerTitleStyle: { color: c.text, fontWeight: "700" as const, fontSize: 16, letterSpacing: -0.2 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.screenBg },
      }}
    >
      <Stack.Screen name="[slug]/index" options={{ title: "Truyện" }} />
      <Stack.Screen name="[slug]/read/[chapterId]" options={{ title: "Chương" }} />
    </Stack>
  );
}
