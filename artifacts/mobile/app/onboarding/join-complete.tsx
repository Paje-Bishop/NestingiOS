import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/ui/OnboardingLayout";
import { fonts } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function JoinCompleteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { onboardingData } = useApp();

  const name = onboardingData.userName ?? "Friend";

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  function handleGoToNest() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace("/(tabs)");
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top + 40, 72),
          paddingBottom: Math.max(insets.bottom, 32),
        },
      ]}
    >
      <View style={styles.content}>
        <View
          style={[styles.decorCircle, { backgroundColor: colors.greenCard }]}
        >
          <View
            style={[
              styles.decorInner,
              { backgroundColor: colors.greenCardForeground },
            ]}
          />
        </View>

        <Text
          style={[
            styles.headline,
            {
              color: colors.foreground,
              fontFamily: fonts.serif,
            },
          ]}
        >
          {`Welcome,\n${name}.`}
        </Text>

        <Text
          style={[
            styles.body,
            {
              color: colors.mutedForeground,
              fontFamily: fonts.sansRegular,
            },
          ]}
        >
          You've joined the pregnancy. You'll be able to see shared decisions, contribute to plans, and stay in sync with everyone on this journey.
        </Text>
      </View>

      <View style={{ paddingHorizontal: 24 }}>
        <PrimaryButton label="Go to Nest" onPress={handleGoToNest} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 40,
  },
  decorCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 36,
  },
  decorInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    opacity: 0.5,
  },
  headline: {
    fontSize: 38,
    lineHeight: 46,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 28,
  },
});
