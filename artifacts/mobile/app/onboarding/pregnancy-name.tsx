import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import {
  OnboardingLayout,
  PrimaryButton,
} from "@/components/ui/OnboardingLayout";
import { fonts } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function PregnancyNameScreen() {
  const colors = useColors();
  const { setOnboardingField } = useApp();
  const [name, setName] = useState("");

  function handleContinue(skip?: boolean) {
    setOnboardingField("pregnancyName", skip ? "" : name.trim());
    router.push("/onboarding/invite");
  }

  return (
    <OnboardingLayout
      step={6}
      title="What should we call this pregnancy?"
      subtitle="This name will appear in your home screen and shared spaces. You can skip this and we'll choose one for you."
      bottomContent={
        <View style={{ gap: 10 }}>
          <PrimaryButton
            label="Continue"
            onPress={() => handleContinue(false)}
          />
          <TouchableOpacity
            onPress={() => handleContinue(true)}
            style={styles.skipBtn}
          >
            <Text
              style={[
                styles.skipText,
                {
                  color: colors.mutedForeground,
                  fontFamily: fonts.sansMedium,
                },
              ]}
            >
              Skip for now
            </Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Baby Harper"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
          autoFocus
          returnKeyType="done"
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
        <Text
          style={[
            styles.hint,
            {
              color: colors.mutedForeground,
              fontFamily: fonts.sansRegular,
            },
          ]}
        >
          Optional — this is just a nickname, not a commitment.
        </Text>
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
    marginBottom: 10,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
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
