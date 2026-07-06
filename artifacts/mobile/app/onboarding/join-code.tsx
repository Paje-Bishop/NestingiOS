import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { getInvitation } from "@workspace/api-client-react";
import {
  OnboardingLayout,
  PrimaryButton,
} from "@/components/ui/OnboardingLayout";
import { fonts } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function JoinCodeScreen() {
  const colors = useColors();
  const { setOnboardingField } = useApp();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState((params.code ?? "").toUpperCase());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-submit if code was passed via deep link
  useEffect(() => {
    if (params.code && params.code.length === 8) {
      handleLookup(params.code.toUpperCase());
    }
  }, []);

  async function handleLookup(overrideCode?: string) {
    const lookupCode = (overrideCode ?? code).toUpperCase().replace(/\s/g, "");
    if (lookupCode.length < 6) {
      setError("Please enter your invite code.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await getInvitation(lookupCode);
      setOnboardingField("pregnancyName", data.pregnancy.name);
      setOnboardingField("inviteCode", lookupCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: "/onboarding/invitation-accept",
        params: {
          inviteCode: lookupCode,
          pregnancyName: data.pregnancy.name,
          inviterName: data.inviterName,
          existingPregnantPerson: data.existingPregnantPerson ? "1" : "0",
        },
      });
    } catch {
      setError("Invalid or expired invite code. Please check and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingLayout
      step={2}
      title="Enter your invite code"
      subtitle="You received this from the person who invited you. It looks like 8 letters and numbers."
      bottomContent={
        <PrimaryButton
          label={loading ? "Looking up…" : "Continue"}
          onPress={() => handleLookup()}
          disabled={code.replace(/\s/g, "").length < 6 || loading}
        />
      }
    >
      <View>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: 24 }} />
        ) : (
          <TextInput
            value={code}
            onChangeText={(t) => {
              setCode(t.toUpperCase().replace(/\s/g, "").slice(0, 8));
              setError(null);
            }}
            placeholder="e.g. ABC12345"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus={!params.code}
            style={[
              styles.codeInput,
              {
                backgroundColor: colors.secondary,
                color: colors.foreground,
                fontFamily: fonts.sansSemiBold,
                borderColor: error ? colors.destructive : colors.border,
              },
            ]}
          />
        )}
        {error && (
          <Text
            style={[
              styles.error,
              { color: colors.destructive, fontFamily: fonts.sansRegular },
            ]}
          >
            {error}
          </Text>
        )}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  codeInput: {
    height: 64,
    borderRadius: 14,
    paddingHorizontal: 18,
    fontSize: 24,
    borderWidth: 1.5,
    letterSpacing: 4,
    textAlign: "center",
  },
  error: {
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
  },
});
