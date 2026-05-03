import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import Colors from '@/constants/Colors';
import { storyUiPalette } from '@/constants/storyUi';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ui = storyUiPalette(scheme);
  const palette = Colors[scheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ui.indigo600,
        tabBarInactiveTintColor: palette.tabIconDefault,
        tabBarStyle: {
          backgroundColor: palette.background,
          borderTopColor: ui.shellBorder,
        },
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: scheme === 'light' ? ui.indigo50 : ui.screenBg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: scheme === 'light' ? ui.indigo200 : ui.shellBorder,
        },
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          letterSpacing: -0.35,
          color: scheme === 'light' ? ui.indigo900 : ui.text,
        },
        headerTintColor: ui.indigo600,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Truyện',
          tabBarIcon: ({ color }) => <TabBarIcon name="book" color={color} />,
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable>
                {({ pressed }) => (
                  <FontAwesome
                    name="info-circle"
                    size={24}
                    color={ui.indigo600}
                    style={{ marginRight: 15, opacity: pressed ? 0.55 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Ứng dụng',
          tabBarIcon: ({ color }) => <TabBarIcon name="mobile" color={color} />,
        }}
      />
    </Tabs>
  );
}
