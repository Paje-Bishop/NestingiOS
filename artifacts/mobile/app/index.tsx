import { Redirect } from "expo-router";
import { View } from "react-native";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function RootIndex() {
  const { isLoading, isOnboardingComplete } = useApp();
  const colors = useColors();

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  if (isOnboardingComplete) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/onboarding" />;
}
