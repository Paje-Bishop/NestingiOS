import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

export default function PrepareScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 20 },
      ]}
    >
      <Text
        style={[
          styles.title,
          { color: colors.foreground, fontFamily: fonts.serif },
        ]}
      >
        Prepare
      </Text>
      <Text
        style={[
          styles.sub,
          { color: colors.mutedForeground, fontFamily: fonts.sansRegular },
        ]}
      >
        Your checklists and milestones will live here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 34,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  sub: {
    fontSize: 16,
    lineHeight: 24,
  },
});
