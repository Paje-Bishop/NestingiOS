import { router } from "expo-router";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  OnboardingLayout,
  PrimaryButton,
} from "@/components/ui/OnboardingLayout";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

export default function InviteScreen() {
  const colors = useColors();
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");

  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function handleSend() {
    router.push("/onboarding/notifications");
  }

  function handleSkip() {
    router.push("/onboarding/notifications");
  }

  return (
    <OnboardingLayout
      step={7}
      title="Would you like to invite someone to prepare with you?"
      subtitle="Send an invite to a partner, family member, or friend. They'll be able to contribute to shared decisions and see your journey."
      bottomContent={
        <View style={{ gap: 10 }}>
          <PrimaryButton
            label="Send invite"
            onPress={handleSend}
            disabled={
              inviteName.trim().length === 0 ||
              invitePhone.replace(/\D/g, "").length < 10
            }
          />
          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
            <Text
              style={[
                styles.skipText,
                {
                  color: colors.mutedForeground,
                  fontFamily: fonts.sansMedium,
                },
              ]}
            >
              I'll do this later
            </Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        <View>
          <Text
            style={[
              styles.label,
              {
                color: colors.mutedForeground,
                fontFamily: fonts.sansMedium,
              },
            ]}
          >
            Their name
          </Text>
          <TextInput
            value={inviteName}
            onChangeText={setInviteName}
            placeholder="e.g. Joe"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            style={[
              styles.input,
              {
                backgroundColor: colors.secondary,
                color: colors.foreground,
                fontFamily: fonts.sansRegular,
                borderColor: colors.border,
              },
            ]}
          />
        </View>
        <View>
          <Text
            style={[
              styles.label,
              {
                color: colors.mutedForeground,
                fontFamily: fonts.sansMedium,
              },
            ]}
          >
            Their phone number
          </Text>
          <TextInput
            value={invitePhone}
            onChangeText={(t) => setInvitePhone(formatPhone(t))}
            placeholder="(555) 000-0000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            style={[
              styles.input,
              {
                backgroundColor: colors.secondary,
                color: colors.foreground,
                fontFamily: fonts.sansRegular,
                borderColor: colors.border,
              },
            ]}
          />
        </View>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 18,
    fontSize: 16,
    borderWidth: 1.5,
  },
  skipBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 15,
  },
});
