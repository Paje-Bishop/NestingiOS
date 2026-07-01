import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  OnboardingLayout,
  OptionCard,
  PrimaryButton,
} from "@/components/ui/OnboardingLayout";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

export default function NotificationsScreen() {
  const colors = useColors();
  const [selected, setSelected] = useState<"enable" | "later" | null>(null);

  function handleContinue() {
    router.push("/onboarding/complete");
  }

  return (
    <OnboardingLayout
      step={8}
      title="Would you like timely reminders?"
      bottomContent={
        <PrimaryButton
          label="Continue"
          onPress={handleContinue}
          disabled={!selected}
        />
      }
    >
      {/* Example notification */}
      <View
        style={[
          styles.exampleCard,
          {
            backgroundColor: colors.amberCard,
            borderColor: colors.amberCardBorder,
          },
        ]}
      >
        <Ionicons name="notifications-outline" size={18} color={colors.amberCardForeground} />
        <Text
          style={[
            styles.exampleText,
            {
              color: colors.amberCardForeground,
              fontFamily: fonts.sansRegular,
              flex: 1,
            },
          ]}
        >
          Most anatomy scans happen between weeks 18 and 20. You're entering
          week 18, so this is a good time to confirm yours is scheduled.
        </Text>
      </View>

      <OptionCard
        label="Enable notifications"
        sublabel="Get reminders, milestone alerts, and helpful nudges"
        selected={selected === "enable"}
        onPress={() => setSelected("enable")}
        icon={
          <Ionicons
            name="notifications"
            size={22}
            color={
              selected === "enable"
                ? colors.accentForeground
                : colors.mutedForeground
            }
          />
        }
      />
      <OptionCard
        label="Not now"
        sublabel="You can always turn these on in settings"
        selected={selected === "later"}
        onPress={() => setSelected("later")}
        icon={
          <Ionicons
            name="notifications-off-outline"
            size={22}
            color={
              selected === "later"
                ? colors.accentForeground
                : colors.mutedForeground
            }
          />
        }
      />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  exampleCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  exampleText: {
    fontSize: 14,
    lineHeight: 21,
  },
});
