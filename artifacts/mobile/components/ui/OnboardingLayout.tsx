import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

interface Props {
  step?: number;
  totalSteps?: number;
  showBack?: boolean;
  children: React.ReactNode;
  bottomContent?: React.ReactNode;
  title?: string;
  titleSerif?: boolean;
  subtitle?: string;
  scrollable?: boolean;
}

export function OnboardingLayout({
  step,
  totalSteps = 9,
  showBack = true,
  children,
  bottomContent,
  title,
  titleSerif = false,
  subtitle,
  scrollable = true,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const progressPct = step !== undefined ? (step / totalSteps) * 100 : 0;

  const content = (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top nav */}
      <View style={[styles.topNav, { paddingTop: Math.max(insets.top + 8, 48) }]}>
        <View style={styles.navLeft}>
          {showBack && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.navCenter}>
          {step !== undefined && (
            <Text
              style={[
                styles.stepText,
                { color: colors.mutedForeground, fontFamily: fonts.sansMedium },
              ]}
            >
              Step {step} of {totalSteps}
            </Text>
          )}
        </View>

        <View style={styles.navRight} />
      </View>

      {/* Progress bar */}
      {step !== undefined && (
        <View
          style={[styles.progressTrack, { backgroundColor: colors.muted }]}
        >
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${progressPct}%` as any,
              },
            ]}
          />
        </View>
      )}

      {/* Scrollable content */}
      {scrollable ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {title && (
            <Text
              style={[
                titleSerif ? styles.titleSerif : styles.titleSans,
                { color: colors.foreground },
              ]}
            >
              {title}
            </Text>
          )}
          {subtitle && (
            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.mutedForeground,
                  fontFamily: fonts.sansRegular,
                },
              ]}
            >
              {subtitle}
            </Text>
          )}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.scrollContent, { flex: 1 }]}>
          {title && (
            <Text
              style={[
                titleSerif ? styles.titleSerif : styles.titleSans,
                { color: colors.foreground },
              ]}
            >
              {title}
            </Text>
          )}
          {subtitle && (
            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.mutedForeground,
                  fontFamily: fonts.sansRegular,
                },
              ]}
            >
              {subtitle}
            </Text>
          )}
          {children}
        </View>
      )}

      {/* Bottom action area */}
      {bottomContent && (
        <View
          style={[
            styles.bottomArea,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {bottomContent}
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, disabled }: PrimaryButtonProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.primaryBtn,
        {
          backgroundColor: disabled
            ? colors.muted
            : colors.primary,
        },
      ]}
    >
      <Text
        style={[
          styles.primaryBtnText,
          {
            color: disabled ? colors.mutedForeground : colors.primaryForeground,
            fontFamily: fonts.sansSemiBold,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface OptionCardProps {
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
}

export function OptionCard({
  label,
  sublabel,
  selected,
  onPress,
  icon,
}: OptionCardProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.optionCard,
        {
          backgroundColor: selected ? colors.accent : colors.secondary,
          borderColor: selected ? colors.primary : "transparent",
          borderWidth: selected ? 1.5 : 1.5,
        },
      ]}
    >
      {icon && <View style={styles.optionIcon}>{icon}</View>}
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.optionLabel,
            {
              color: selected ? colors.accentForeground : colors.foreground,
              fontFamily: fonts.sansSemiBold,
            },
          ]}
        >
          {label}
        </Text>
        {sublabel && (
          <Text
            style={[
              styles.optionSublabel,
              {
                color: selected
                  ? colors.accentForeground
                  : colors.mutedForeground,
                fontFamily: fonts.sansRegular,
              },
            ]}
          >
            {sublabel}
          </Text>
        )}
      </View>
      {selected && (
        <Feather name="check-circle" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
    minHeight: 52,
  },
  navLeft: {
    width: 40,
    alignItems: "flex-start",
  },
  navCenter: {
    flex: 1,
    alignItems: "center",
  },
  navRight: {
    width: 40,
  },
  backBtn: {
    padding: 2,
  },
  stepText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  progressTrack: {
    height: 3,
    marginHorizontal: 20,
    borderRadius: 2,
    marginBottom: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  titleSerif: {
    fontSize: 34,
    lineHeight: 42,
    marginBottom: 12,
    letterSpacing: -0.3,
    fontFamily: "DmSerifDisplay_400Regular",
  },
  titleSans: {
    fontSize: 26,
    lineHeight: 34,
    marginBottom: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 12,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    letterSpacing: 0.1,
  },
  optionCard: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  optionIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    fontSize: 16,
    marginBottom: 2,
  },
  optionSublabel: {
    fontSize: 13,
    lineHeight: 18,
  },
});
