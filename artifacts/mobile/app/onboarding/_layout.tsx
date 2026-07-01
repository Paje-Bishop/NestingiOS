import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create-or-join" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="name" />
      <Stack.Screen name="role" />
      <Stack.Screen name="due-date" />
      <Stack.Screen name="pregnancy-name" />
      <Stack.Screen name="invite" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
