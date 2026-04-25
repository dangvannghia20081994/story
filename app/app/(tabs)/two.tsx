import { StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";

export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Expo + React Native</Text>
      <Text style={styles.p}>
        Cùng codebase: chạy web (`npm run web`), thiết bị qua Expo Go (`npm start` + quét QR), hoặc build store
        sau này với EAS Build (`eas build`).
      </Text>
      <Text style={styles.p}>
        API backend: cấu hình biến môi trường{" "}
        <Text style={styles.mono}>EXPO_PUBLIC_API_URL</Text> (xem file{" "}
        <Text style={styles.mono}>.env.example</Text> ở thư mục app).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  p: {
    fontSize: 15,
    lineHeight: 22,
  },
  mono: {
    fontFamily: "SpaceMono",
  },
});
