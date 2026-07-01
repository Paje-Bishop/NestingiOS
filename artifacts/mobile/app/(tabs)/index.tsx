import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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

import { fonts } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_WEEK = 18;
const MOCK_NAME = "Sarah";
const MOCK_PREGNANCY_NAME = "Baby Harper";

const SHARED_DECISIONS = [
  {
    id: "1",
    icon: "car" as const,
    title: "Infant car seat",
    status: "Waiting on Joe",
    iconSet: "feather" as const,
  },
  {
    id: "2",
    icon: "home" as const,
    title: "Hospital bag checklist",
    status: "3 opinions in",
    iconSet: "feather" as const,
  },
  {
    id: "3",
    icon: "package" as const,
    title: "Nursery furniture",
    status: "Waiting on you",
    iconSet: "feather" as const,
  },
];

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

interface DecisionCardProps {
  icon: string;
  iconSet: "feather" | "ionicons";
  title: string;
  status: string;
}

function DecisionCard({ icon, title, status }: DecisionCardProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[
        styles.decisionCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.decisionIcon,
          { backgroundColor: colors.secondary },
        ]}
      >
        <Feather name={icon as any} size={16} color={colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.decisionTitle,
            { color: colors.foreground, fontFamily: fonts.sansMedium },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.decisionStatus,
            { color: colors.mutedForeground, fontFamily: fonts.sansRegular },
          ]}
        >
          {status}
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
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
        Joe finished comparing car seats
      </Text>
      <Text
        style={[
          styles.progressSub,
          { color: colors.greenCardForeground, fontFamily: fonts.sansRegular },
        ]}
      >
        3 tasks this week
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
  const { userData } = useApp();

  const displayName = userData?.userName ?? MOCK_NAME;
  const pregnancyName = userData?.pregnancyName ?? MOCK_PREGNANCY_NAME;
  const currentWeek = userData?.currentWeek ?? MOCK_WEEK;
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
        {/* Header */}
        <HomeHeader
          name={displayName}
          pregnancyName={pregnancyName}
          week={currentWeek}
        />

        {/* This week section */}
        <View style={styles.section}>
          <WeekCard week={currentWeek} />
          <TodayFocusCard />
        </View>

        {/* Together section */}
        <View style={styles.section}>
          <SectionTitle label="Together" />

          {/* Collaborative acknowledgment */}
          <Text
            style={[
              styles.collaborativeNote,
              { color: colors.mutedForeground, fontFamily: fonts.sansRegular },
            ]}
          >
            Everyone's caught up this week
          </Text>

          {/* Shared decisions */}
          <View style={styles.decisionsBlock}>
            <View style={styles.decisionsHeader}>
              <Text
                style={[
                  styles.decisionsTitle,
                  { color: colors.foreground, fontFamily: fonts.sansSemiBold },
                ]}
              >
                Shared decisions
              </Text>
              <TouchableOpacity activeOpacity={0.65}>
                <Text
                  style={[
                    styles.viewAll,
                    { color: colors.primary, fontFamily: fonts.sansMedium },
                  ]}
                >
                  View all
                </Text>
              </TouchableOpacity>
            </View>
            {SHARED_DECISIONS.map((d) => (
              <DecisionCard
                key={d.id}
                icon={d.icon}
                iconSet={d.iconSet}
                title={d.title}
                status={d.status}
              />
            ))}
          </View>

          {/* Progress */}
          <ProgressCard />
        </View>

        {/* Capture this week */}
        <CaptureWeekRow />

        {/* Is the baby coming? — week 30+ only */}
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
  decisionsBlock: {
    gap: 8,
  },
  decisionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  decisionsTitle: {
    fontSize: 16,
  },
  viewAll: {
    fontSize: 14,
  },
  decisionCard: {
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
  },
  decisionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  decisionTitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  decisionStatus: {
    fontSize: 12,
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
  progressSub: {
    fontSize: 13,
    opacity: 0.75,
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
