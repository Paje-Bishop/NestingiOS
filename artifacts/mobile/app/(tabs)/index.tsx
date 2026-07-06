import { Feather, Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGetMe } from "@workspace/api-client-react";
import { fonts } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateWeek(dueDate: string | null | undefined): number {
  if (!dueDate) return 18;
  const due = new Date(dueDate);
  const now = new Date();
  const daysLeft = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(42, 40 - Math.round(daysLeft / 7)));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HomeHeader({
  name,
  pregnancyName,
  week,
}: {
  name: string;
  pregnancyName: string;
  week: number;
}) {
  const colors = useColors();
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <View style={styles.headerRow}>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.greeting,
            { color: colors.foreground, fontFamily: fonts.serif },
          ]}
        >
          {greeting}, {name}
        </Text>
        <TouchableOpacity style={styles.pregnancyRow} activeOpacity={0.6}>
          <Text
            style={[
              styles.pregnancyLabel,
              { color: colors.mutedForeground, fontFamily: fonts.sansMedium },
            ]}
          >
            {pregnancyName} · Week {week}
          </Text>
          <Feather
            name="chevron-down"
            size={14}
            color={colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.avatar, { backgroundColor: colors.coralCard }]}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.avatarText,
            {
              color: colors.coralCardForeground,
              fontFamily: fonts.sansSemiBold,
            },
          ]}
        >
          {initials}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SectionTitle({ label }: { label: string }) {
  const colors = useColors();
  return (
    <Text
      style={[
        styles.sectionTitle,
        { color: colors.mutedForeground, fontFamily: fonts.sansSemiBold },
      ]}
    >
      {label.toUpperCase()}
    </Text>
  );
}

function WeekCard({ week }: { week: number }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.weekCard,
        {
          backgroundColor: colors.coralCard,
          borderColor: colors.coralCardBorder,
        },
      ]}
    >
      <Text
        style={[
          styles.eyebrow,
          {
            color: colors.coralCardForeground,
            fontFamily: fonts.sansSemiBold,
            opacity: 0.7,
          },
        ]}
      >
        THIS WEEK
      </Text>
      <Text
        style={[
          styles.weekHeadline,
          { color: colors.coralCardForeground, fontFamily: fonts.serif },
        ]}
      >
        Week {week}
      </Text>
      <Text
        style={[
          styles.weekBody,
          { color: colors.coralCardForeground, fontFamily: fonts.sansRegular },
        ]}
      >
        Your anatomy scan window may be coming up soon. This is a great time to
        confirm it's scheduled.
      </Text>
    </View>
  );
}

function TodayFocusCard() {
  const colors = useColors();
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[
        styles.focusCard,
        {
          backgroundColor: colors.amberCard,
          borderColor: colors.amberCardBorder,
        },
      ]}
    >
      <View style={styles.focusCardLeft}>
        <View
          style={[
            styles.focusIconWrap,
            { backgroundColor: colors.amberCardForeground + "18" },
          ]}
        >
          <Feather name="check-square" size={18} color={colors.amberCardForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.eyebrow,
              {
                color: colors.amberCardForeground,
                fontFamily: fonts.sansSemiBold,
                opacity: 0.7,
                marginBottom: 4,
              },
            ]}
          >
            TODAY'S FOCUS
          </Text>
          <Text
            style={[
              styles.focusText,
              {
                color: colors.amberCardForeground,
                fontFamily: fonts.sansMedium,
              },
            ]}
          >
            Confirm your anatomy scan appointment
          </Text>
        </View>
      </View>
      <Feather
        name="chevron-right"
        size={18}
        color={colors.amberCardForeground}
      />
    </TouchableOpacity>
  );
}

function ProgressCard() {
  const colors = useColors();
  return (
    <View
      style={[
        styles.progressCard,
        {
          backgroundColor: colors.greenCard,
          borderColor: colors.greenCardBorder,
        },
      ]}
    >
      <View style={styles.progressCardHeader}>
        <View
          style={[
            styles.progressIconWrap,
            { backgroundColor: colors.greenCardForeground + "18" },
          ]}
        >
          <Feather name="trending-up" size={16} color={colors.greenCardForeground} />
        </View>
        <Text
          style={[
            styles.eyebrow,
            {
              color: colors.greenCardForeground,
              fontFamily: fonts.sansSemiBold,
              opacity: 0.7,
            },
          ]}
        >
          PROGRESS
        </Text>
      </View>
      <Text
        style={[
          styles.progressMain,
          { color: colors.greenCardForeground, fontFamily: fonts.sansMedium },
        ]}
      >
        You're all caught up this week
      </Text>
    </View>
  );
}

function CaptureWeekRow() {
  const colors = useColors();
  return (
    <TouchableOpacity
      activeOpacity={0.65}
      style={[
        styles.captureRow,
        { borderColor: colors.border },
      ]}
    >
      <Ionicons name="sparkles" size={16} color={colors.mutedForeground} />
      <Text
        style={[
          styles.captureText,
          { color: colors.mutedForeground, fontFamily: fonts.sansRegular },
        ]}
      >
        Capture this week
      </Text>
      <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentPregnancyId } = useApp();

  const { data: meData } = useGetMe();

  const person = meData?.person;
  const pregnancies = meData?.pregnancies ?? [];
  const currentPregnancy =
    pregnancies.find((p) => p.id === currentPregnancyId) ?? pregnancies[0];

  const displayName = person?.displayName ?? "Friend";
  const pregnancyName = currentPregnancy?.name ?? "Baby";
  const currentWeek = calculateWeek(currentPregnancy?.dueDate);
  const showBabyComing = currentWeek >= 30;

  const tabBarHeight = Platform.OS === "web" ? 84 : 80;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 16, Platform.OS === "web" ? 67 : 52),
            paddingBottom: tabBarHeight + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader
          name={displayName}
          pregnancyName={pregnancyName}
          week={currentWeek}
        />

        <View style={styles.section}>
          <WeekCard week={currentWeek} />
          <TodayFocusCard />
        </View>

        <View style={styles.section}>
          <SectionTitle label="Together" />
          <Text
            style={[
              styles.collaborativeNote,
              { color: colors.mutedForeground, fontFamily: fonts.sansRegular },
            ]}
          >
            {pregnancies.length > 1
              ? `You're in ${pregnancies.length} pregnancies`
              : "Everyone's caught up this week"}
          </Text>
          <ProgressCard />
        </View>

        <CaptureWeekRow />

        {showBabyComing && (
          <TouchableOpacity
            activeOpacity={0.65}
            style={styles.babyComingRow}
          >
            <Text
              style={[
                styles.babyComingText,
                { color: colors.primary, fontFamily: fonts.sansMedium },
              ]}
            >
              Is the baby coming?
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  greeting: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  pregnancyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  pregnancyLabel: {
    fontSize: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    marginTop: 4,
  },
  avatarText: {
    fontSize: 15,
  },
  section: {
    marginBottom: 28,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  weekCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 6,
  },
  weekHeadline: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  weekBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  focusCard: {
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  focusCardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  focusIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  focusText: {
    fontSize: 15,
    lineHeight: 21,
  },
  collaborativeNote: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  progressCard: {
    borderRadius: 20,
    padding: 18,
    gap: 6,
    borderWidth: 1,
  },
  progressCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  progressIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  progressMain: {
    fontSize: 15,
    lineHeight: 21,
  },
  captureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  captureText: {
    flex: 1,
    fontSize: 14,
  },
  babyComingRow: {
    alignItems: "center",
    paddingVertical: 16,
  },
  babyComingText: {
    fontSize: 15,
  },
});
