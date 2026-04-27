import { Stack } from "expo-router";

import { useColorScheme } from "@/components/useColorScheme";
import { storyUiPalette } from "@/constants/storyUi";

export default function StoryStackLayout() {
  const scheme = useColorScheme() ?? "light";
  const c = storyUiPalette(scheme === "dark" ? "dark" : "light");

  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Truyện",
        headerStyle: { backgroundColor: c.shellBg },
        headerTintColor: c.indigo600,
        headerTitleStyle: { color: c.text, fontWeight: "600" as const },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.screenBg },
      }}
    >
      <Stack.Screen name="[slug]/index" options={{ title: "Truyện" }} />
      <Stack.Screen name="[slug]/read/[chapterId]" options={{ title: "Chương" }} />
    </Stack>
  );
}
