import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/constants/fonts";
import { PrimaryButton } from "@/components/ui/OnboardingLayout";
import { useColors } from "@/hooks/useColors";

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top + 24, 56),
          paddingBottom: Math.max(insets.bottom, 32),
        },
      ]}
    >
      {/* Decorative top area */}
      <View style={styles.decorArea}>
        <View
          style={[styles.nestCircle, { backgroundColor: colors.coralCard }]}
        >
          <View
            style={[styles.nestInner, { backgroundColor: colors.accent }]}
          />
        </View>
      </View>

      {/* Text content */}
      <View style={styles.textArea}>
        <Text
          style={[
            styles.headline,
            {
              color: colors.foreground,
              fontFamily: fonts.serif,
            },
          ]}
        >
          Welcome to Nest
        </Text>
        <Text
          style={[
            styles.subtitle,
            {
              color: colors.mutedForeground,
              fontFamily: fonts.sansRegular,
            },
          ]}
        >
          We'll help you prepare with confidence, grow together, and remember
          the journey.
        </Text>
      </View>

      {/* Bottom action */}
      <View style={styles.bottomArea}>
        <PrimaryButton
          label="Get started"
          onPress={() => router.push("/onboarding/create-or-join")}
        />
        <Text
          style={[
            styles.legal,
            {
              color: colors.mutedForeground,
              fontFamily: fonts.sansRegular,
            },
          ]}
        >
          By continuing, you agree to our Terms and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
  },
  decorArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nestCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  nestInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  textArea: {
    paddingBottom: 40,
  },
  headline: {
    fontSize: 42,
    lineHeight: 50,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 26,
  },
  bottomArea: {
    gap: 16,
  },
  legal: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
