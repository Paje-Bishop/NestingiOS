import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCreateInvitation, useCreatePregnancy, useUpdateMe } from "@workspace/api-client-react";
import { PrimaryButton } from "@/components/ui/OnboardingLayout";
import { fonts } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function getWeekOrdinal(week: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = week % 100;
  return week + (s[(v - 20) % 10] || s[v] || s[0]);
}

function calculateWeek(dueDate: string | null | undefined, dueDateType?: string): number {
  if (!dueDate || dueDateType === "unknown") return 18;
  const due = new Date(dueDate);
  const now = new Date();
  const daysLeft = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(42, 40 - Math.round(daysLeft / 7)));
}

export default function CompleteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { onboardingData, setCurrentPregnancy } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const name = onboardingData.userName ?? "Friend";
  const role = onboardingData.role ?? "pregnant";
  const dueDateType = onboardingData.dueDateType ?? "unknown";
  const week = calculateWeek(onboardingData.dueDate, dueDateType);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const updateMe = useUpdateMe();
  const createPregnancy = useCreatePregnancy();
  const createInvitation = useCreateInvitation();

  async function handleGoToNest() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await updateMe.mutateAsync({ data: { displayName: name } });

      const dueDatePrecision =
        dueDateType === "exact"
          ? "exact"
          : dueDateType === "approximate"
            ? "approximate_month"
            : "unknown";

      const { pregnancy } = await createPregnancy.mutateAsync({
        data: {
          name: onboardingData.pregnancyName?.trim() || undefined,
          dueDate: onboardingData.dueDate ?? undefined,
          dueDatePrecision,
          role: role === "pregnant" ? "pregnant_person" : "supporter",
        },
      });

      await setCurrentPregnancy(pregnancy.id);
      setDone(true);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.replace("/(tabs)");
    } catch {
      setSubmitting(false);
    }
  }

  const supportingCopy =
    role === "supporting"
      ? "You're joining this journey as a supporter. We'll help you stay in sync, contribute to decisions, and be there in the ways that matter."
      : `You're about ${week} weeks along. We'll help you focus on what matters now, what can wait, and what to prepare before the baby arrives.`;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top + 40, 72),
          paddingBottom: Math.max(insets.bottom, 32),
        },
      ]}
    >
      <Text
        style={[
          styles.stepLabel,
          { color: colors.mutedForeground, fontFamily: fonts.sansMedium },
        ]}
      >
        Step 9 of 9
      </Text>

      <View style={styles.content}>
        <View
          style={[styles.decorCircle, { backgroundColor: colors.greenCard }]}
        >
          <View
            style={[
              styles.decorInner,
              { backgroundColor: colors.greenCardForeground },
            ]}
          />
        </View>

        <Text
          style={[
            styles.headline,
            {
              color: colors.foreground,
              fontFamily: fonts.serif,
            },
          ]}
        >
          {`You're all set,\n${name}.`}
        </Text>

        <Text
          style={[
            styles.body,
            {
              color: colors.mutedForeground,
              fontFamily: fonts.sansRegular,
            },
          ]}
        >
          {supportingCopy}
        </Text>

        {role === "pregnant" && (
          <View
            style={[
              styles.weekBadge,
              {
                backgroundColor: colors.coralCard,
                borderColor: colors.coralCardBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.weekBadgeLabel,
                {
                  color: colors.coralCardForeground,
                  fontFamily: fonts.sansMedium,
                },
              ]}
            >
              WEEK
            </Text>
            <Text
              style={[
                styles.weekBadgeNumber,
                {
                  color: colors.coralCardForeground,
                  fontFamily: fonts.serif,
                },
              ]}
            >
              {week}
            </Text>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 24 }}>
        {submitting ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <PrimaryButton label="Go to Nest" onPress={handleGoToNest} disabled={done} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepLabel: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 32,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 40,
  },
  decorCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 36,
  },
  decorInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    opacity: 0.5,
  },
  headline: {
    fontSize: 38,
    lineHeight: 46,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 28,
  },
  weekBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  weekBadgeLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  weekBadgeNumber: {
    fontSize: 36,
    lineHeight: 40,
  },
});
