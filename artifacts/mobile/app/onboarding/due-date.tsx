import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  OnboardingLayout,
  PrimaryButton,
} from "@/components/ui/OnboardingLayout";
import { fonts } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function getYears() {
  const current = new Date().getFullYear();
  return [current, current + 1];
}

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

interface DatePickerModalProps {
  visible: boolean;
  mode: "exact" | "approximate";
  onClose: () => void;
  onConfirm: (date: Date, type: "exact" | "approximate") => void;
}

function DatePickerModal({ visible, mode, onClose, onConfirm }: DatePickerModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const defaultMonth = (now.getMonth() + 5) % 12;
  const defaultYear = now.getMonth() + 5 >= 12 ? now.getFullYear() + 1 : now.getFullYear();

  const [selMonth, setSelMonth] = useState(defaultMonth);
  const [selDay, setSelDay] = useState(1);
  const [selYear, setSelYear] = useState(defaultYear);

  const years = getYears();
  const days = Array.from(
    { length: getDaysInMonth(selMonth, selYear) },
    (_, i) => i + 1
  );

  function handleConfirm() {
    let d: Date;
    if (mode === "exact") {
      d = new Date(selYear, selMonth, selDay);
    } else {
      d = new Date(selYear, selMonth, 15);
    }
    onConfirm(d, mode);
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, 24),
            },
          ]}
        >
          <View style={styles.modalHandle}>
            <View
              style={[styles.handle, { backgroundColor: colors.border }]}
            />
          </View>
          <Text
            style={[
              styles.modalTitle,
              { color: colors.foreground, fontFamily: fonts.sansSemiBold },
            ]}
          >
            {mode === "exact" ? "Select due date" : "Select approximate month"}
          </Text>

          <View style={styles.pickerRow}>
            {/* Month */}
            <View style={styles.pickerCol}>
              <Text style={[styles.pickerLabel, { color: colors.mutedForeground, fontFamily: fonts.sansMedium }]}>Month</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setSelMonth(i)}
                    style={[
                      styles.pickerItem,
                      selMonth === i && { backgroundColor: colors.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        {
                          fontFamily: selMonth === i ? fonts.sansSemiBold : fonts.sansRegular,
                          color: selMonth === i ? colors.primary : colors.foreground,
                        },
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Day (exact only) */}
            {mode === "exact" && (
              <View style={[styles.pickerCol, { maxWidth: 70 }]}>
                <Text style={[styles.pickerLabel, { color: colors.mutedForeground, fontFamily: fonts.sansMedium }]}>Day</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {days.map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setSelDay(d)}
                      style={[
                        styles.pickerItem,
                        selDay === d && { backgroundColor: colors.accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          {
                            fontFamily: selDay === d ? fonts.sansSemiBold : fonts.sansRegular,
                            color: selDay === d ? colors.primary : colors.foreground,
                          },
                        ]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Year */}
            <View style={[styles.pickerCol, { maxWidth: 80 }]}>
              <Text style={[styles.pickerLabel, { color: colors.mutedForeground, fontFamily: fonts.sansMedium }]}>Year</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {years.map((y) => (
                  <TouchableOpacity
                    key={y}
                    onPress={() => setSelYear(y)}
                    style={[
                      styles.pickerItem,
                      selYear === y && { backgroundColor: colors.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        {
                          fontFamily: selYear === y ? fonts.sansSemiBold : fonts.sansRegular,
                          color: selYear === y ? colors.primary : colors.foreground,
                        },
                      ]}
                    >
                      {y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleConfirm}
            activeOpacity={0.8}
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.confirmBtnText, { color: colors.primaryForeground, fontFamily: fonts.sansSemiBold }]}>
              Confirm
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function DueDateScreen() {
  const colors = useColors();
  const { setOnboardingField } = useApp();
  const [selected, setSelected] = useState<"exact" | "approximate" | "unknown" | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  function handleOptionPress(option: "exact" | "approximate" | "unknown") {
    setSelected(option);
    if (option === "exact" || option === "approximate") {
      setShowPicker(true);
    }
  }

  function handleDateConfirm(date: Date, type: "exact" | "approximate") {
    setSelectedDate(date);
    setShowPicker(false);
  }

  function handleContinue() {
    if (selected === "unknown") {
      setOnboardingField("dueDate", null);
      setOnboardingField("dueDateType", "unknown");
    } else if (selectedDate) {
      setOnboardingField("dueDate", selectedDate.toISOString());
      setOnboardingField("dueDateType", selected ?? "approximate");
    }
    router.push("/onboarding/pregnancy-name");
  }

  const canContinue =
    selected === "unknown" || (selected !== null && selectedDate !== null);

  function formatSelectedDate() {
    if (!selectedDate) return null;
    if (selected === "approximate") {
      return selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    return selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  return (
    <OnboardingLayout
      step={5}
      title="When is the baby's due date?"
      subtitle="This helps us personalise your timeline and reminders."
      bottomContent={
        <PrimaryButton
          label="Continue"
          onPress={handleContinue}
          disabled={!canContinue}
        />
      }
    >
      <View>
        <TouchableOpacity
          onPress={() => handleOptionPress("exact")}
          activeOpacity={0.7}
          style={[
            styles.card,
            {
              backgroundColor: selected === "exact" ? colors.accent : colors.secondary,
              borderColor: selected === "exact" ? colors.primary : "transparent",
            },
          ]}
        >
          <Feather
            name="calendar"
            size={20}
            color={selected === "exact" ? colors.accentForeground : colors.mutedForeground}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardLabel, { color: colors.foreground, fontFamily: fonts.sansSemiBold }]}>
              Exact date
            </Text>
            {selected === "exact" && selectedDate ? (
              <Text style={[styles.cardSub, { color: colors.primary, fontFamily: fonts.sansMedium }]}>
                {formatSelectedDate()}
              </Text>
            ) : (
              <Text style={[styles.cardSub, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}>
                Tap to select a date
              </Text>
            )}
          </View>
          {selected === "exact" && (
            <Feather name="check-circle" size={20} color={colors.primary} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleOptionPress("approximate")}
          activeOpacity={0.7}
          style={[
            styles.card,
            {
              backgroundColor: selected === "approximate" ? colors.accent : colors.secondary,
              borderColor: selected === "approximate" ? colors.primary : "transparent",
            },
          ]}
        >
          <Feather
            name="clock"
            size={20}
            color={selected === "approximate" ? colors.accentForeground : colors.mutedForeground}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardLabel, { color: colors.foreground, fontFamily: fonts.sansSemiBold }]}>
              Approximate month
            </Text>
            {selected === "approximate" && selectedDate ? (
              <Text style={[styles.cardSub, { color: colors.primary, fontFamily: fonts.sansMedium }]}>
                {formatSelectedDate()}
              </Text>
            ) : (
              <Text style={[styles.cardSub, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}>
                Tap to choose a month
              </Text>
            )}
          </View>
          {selected === "approximate" && (
            <Feather name="check-circle" size={20} color={colors.primary} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleOptionPress("unknown")}
          activeOpacity={0.7}
          style={[
            styles.card,
            {
              backgroundColor: selected === "unknown" ? colors.accent : colors.secondary,
              borderColor: selected === "unknown" ? colors.primary : "transparent",
            },
          ]}
        >
          <Ionicons
            name="help-circle-outline"
            size={22}
            color={selected === "unknown" ? colors.accentForeground : colors.mutedForeground}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardLabel, { color: colors.foreground, fontFamily: fonts.sansSemiBold }]}>
              I'm not sure yet
            </Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}>
              We'll adjust as you learn more
            </Text>
          </View>
          {selected === "unknown" && (
            <Feather name="check-circle" size={20} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {showPicker && selected && selected !== "unknown" && (
        <DatePickerModal
          visible={showPicker}
          mode={selected}
          onClose={() => setShowPicker(false)}
          onConfirm={handleDateConfirm}
        />
      )}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  cardLabel: {
    fontSize: 16,
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  modalHandle: {
    alignItems: "center",
    marginBottom: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
  },
  pickerRow: {
    flexDirection: "row",
    gap: 8,
    height: 200,
    marginBottom: 20,
  },
  pickerCol: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 12,
    marginBottom: 8,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  pickerScroll: {
    flex: 1,
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 2,
    alignItems: "center",
  },
  pickerItemText: {
    fontSize: 15,
  },
  confirmBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  confirmBtnText: {
    fontSize: 16,
  },
});
