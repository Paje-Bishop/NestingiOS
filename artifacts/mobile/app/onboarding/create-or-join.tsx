import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";

import {
  OnboardingLayout,
  OptionCard,
  PrimaryButton,
} from "@/components/ui/OnboardingLayout";
import { useColors } from "@/hooks/useColors";

export default function CreateOrJoinScreen() {
  const colors = useColors();
  const [selected, setSelected] = useState<"create" | "join" | null>(null);

  function handleContinue() {
    router.push("/onboarding/phone");
  }

  return (
    <OnboardingLayout
      step={1}
      title="What would you like to do?"
      bottomContent={
        <PrimaryButton
          label="Continue"
          onPress={handleContinue}
          disabled={!selected}
        />
      }
    >
      <View style={{ gap: 0 }}>
        <OptionCard
          label="Create a pregnancy"
          sublabel="Start a new journey and invite others to join"
          selected={selected === "create"}
          onPress={() => setSelected("create")}
          icon={
            <Ionicons
              name="add-circle-outline"
              size={24}
              color={
                selected === "create"
                  ? colors.accentForeground
                  : colors.mutedForeground
              }
            />
          }
        />
        <OptionCard
          label="Join a pregnancy"
          sublabel="Accept an invite from someone who's already started"
          selected={selected === "join"}
          onPress={() => setSelected("join")}
          icon={
            <Feather
              name="users"
              size={22}
              color={
                selected === "join"
                  ? colors.accentForeground
                  : colors.mutedForeground
              }
            />
          }
        />
      </View>
    </OnboardingLayout>
  );
}
