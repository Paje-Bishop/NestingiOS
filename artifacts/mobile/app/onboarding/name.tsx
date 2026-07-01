import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import {
  OnboardingLayout,
  PrimaryButton,
} from "@/components/ui/OnboardingLayout";
import { fonts } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function NameScreen() {
  const colors = useColors();
  const { setOnboardingField } = useApp();
  const [name, setName] = useState("");

  function handleContinue() {
    setOnboardingField("userName", name.trim());
    router.push("/onboarding/role");
  }

  return (
    <OnboardingLayout
      step={3}
      title="What should Nest call you?"
      subtitle="This is just your display name — you can change it any time."
      bottomContent={
        <PrimaryButton
          label="Continue"
          onPress={handleContinue}
          disabled={name.trim().length === 0}
        />
      }
    >
      <View>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.mutedForeground}
          autoFocus
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={handleContinue}
          style={[
            styles.input,
            {
              backgroundColor: colors.secondary,
              color: colors.foreground,
              fontFamily: fonts.sansMedium,
              borderColor: colors.border,
            },
          ]}
        />
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 56,
    borderRadius: 14,
    paddingHorizontal: 18,
    fontSize: 18,
    borderWidth: 1.5,
  },
});
