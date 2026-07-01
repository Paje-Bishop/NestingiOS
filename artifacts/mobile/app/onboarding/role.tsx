import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";

import {
  OnboardingLayout,
  OptionCard,
  PrimaryButton,
} from "@/components/ui/OnboardingLayout";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function RoleScreen() {
  const colors = useColors();
  const { setOnboardingField } = useApp();
  const [selected, setSelected] = useState<"pregnant" | "supporting" | null>(
    null
  );

  function handleContinue() {
    if (!selected) return;
    setOnboardingField("role", selected);
    router.push("/onboarding/due-date");
  }

  return (
    <OnboardingLayout
      step={4}
      title="Which role are you using Nest in today?"
      subtitle="You can always adjust this in settings."
      bottomContent={
        <PrimaryButton
          label="Continue"
          onPress={handleContinue}
          disabled={!selected}
        />
      }
    >
      <View>
        <OptionCard
          label="I'm pregnant"
          sublabel="Track your pregnancy, connect with your team"
          selected={selected === "pregnant"}
          onPress={() => setSelected("pregnant")}
          icon={
            <Ionicons
              name="heart-outline"
              size={24}
              color={
                selected === "pregnant"
                  ? colors.accentForeground
                  : colors.mutedForeground
              }
            />
          }
        />
        <OptionCard
          label="I'm supporting someone who's pregnant"
          sublabel="Stay in the loop, contribute to shared decisions"
          selected={selected === "supporting"}
          onPress={() => setSelected("supporting")}
          icon={
            <Feather
              name="users"
              size={22}
              color={
                selected === "supporting"
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
