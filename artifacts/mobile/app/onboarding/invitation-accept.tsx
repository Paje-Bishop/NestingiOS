import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  OnboardingLayout,
  OptionCard,
  PrimaryButton,
} from "@/components/ui/OnboardingLayout";
import { fonts } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function InvitationAcceptScreen() {
  const colors = useColors();
  const { setOnboardingField } = useApp();
  const params = useLocalSearchParams<{
    inviteCode: string;
    pregnancyName: string;
    inviterName: string;
    existingPregnantPerson: string;
  }>();

  const pregnancyName = params.pregnancyName ?? "this pregnancy";
  const inviterName = params.inviterName ?? "someone";

  function handleAccept() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/onboarding/phone",
      params: { inviteCode: params.inviteCode },
    });
  }

  return (
    <OnboardingLayout
      step={2}
      title={`${inviterName} invited you`}
      subtitle={`You've been invited to join "${pregnancyName}". Verify your phone to continue.`}
      bottomContent={
        <PrimaryButton label="Accept & continue" onPress={handleAccept} />
      }
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.greenCard,
            borderColor: colors.greenCardBorder,
          },
        ]}
      >
        <Text
          style={[
            styles.cardLabel,
            { color: colors.greenCardForeground, fontFamily: fonts.sansSemiBold },
          ]}
        >
          PREGNANCY
        </Text>
        <Text
          style={[
            styles.cardName,
            { color: colors.greenCardForeground, fontFamily: fonts.serif },
          ]}
        >
          {pregnancyName}
        </Text>
        <Text
          style={[
            styles.cardMeta,
            { color: colors.greenCardForeground, fontFamily: fonts.sansRegular },
          ]}
        >
          Invited by {inviterName}
        </Text>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    gap: 6,
  },
  cardLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  cardName: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.2,
  },
  cardMeta: {
    fontSize: 15,
    marginTop: 4,
  },
});
