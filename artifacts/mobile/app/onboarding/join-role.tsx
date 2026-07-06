import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { acceptInvitation } from "@workspace/api-client-react";
import {
  OnboardingLayout,
  OptionCard,
  PrimaryButton,
} from "@/components/ui/OnboardingLayout";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function JoinRoleScreen() {
  const colors = useColors();
  const { setCurrentPregnancy, onboardingData } = useApp();
  const params = useLocalSearchParams<{ inviteCode: string }>();
  const [selected, setSelected] = useState<"pregnant_person" | "supporter" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    const inviteCode = params.inviteCode ?? onboardingData.inviteCode;
    if (!selected || !inviteCode) return;
    setLoading(true);
    setError(null);
    try {
      const result = await acceptInvitation(inviteCode, { role: selected });
      await setCurrentPregnancy(result.membership.pregnancyId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push("/onboarding/join-complete");
    } catch (err: unknown) {
      if (err instanceof Response && err.status === 409) {
        setError(
          "This pregnancy already has a pregnant person. Please choose a different role or contact the person who invited you.",
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingLayout
      step={5}
      title="What's your role in this journey?"
      subtitle="This helps us show you the right information and recommendations."
      bottomContent={
        loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <PrimaryButton label="Join" onPress={handleJoin} disabled={!selected || loading} />
        )
      }
    >
      <View style={{ gap: 0 }}>
        <OptionCard
          label="I'm the pregnant person"
          sublabel="This journey is happening in my body"
          selected={selected === "pregnant_person"}
          onPress={() => setSelected("pregnant_person")}
          icon={
            <Ionicons
              name="heart"
              size={22}
              color={
                selected === "pregnant_person"
                  ? colors.accentForeground
                  : colors.mutedForeground
              }
            />
          }
        />
        <OptionCard
          label="I'm a supporter"
          sublabel="Partner, family member, or close friend"
          selected={selected === "supporter"}
          onPress={() => setSelected("supporter")}
          icon={
            <Feather
              name="users"
              size={22}
              color={
                selected === "supporter" ? colors.accentForeground : colors.mutedForeground
              }
            />
          }
        />
      </View>
    </OnboardingLayout>
  );
}
