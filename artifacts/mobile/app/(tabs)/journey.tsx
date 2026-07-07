import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getGetCurrentJourneyWeekQueryKey,
  useCreateMemory,
  useGetCurrentJourneyWeek,
  type JournalSlot,
  type JourneyWeekContent,
  type MemoryPromptOption,
} from "@workspace/api-client-react";
import { fonts } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

// ─── Week content (Story 1) ──────────────────────────────────────────────────

function ContentBlock({ label, body }: { label: string; body: string }) {
  const colors = useColors();
  return (
    <View style={styles.contentBlock}>
      <Text
        style={[
          styles.eyebrow,
          { color: colors.mutedForeground, fontFamily: fonts.sansSemiBold },
        ]}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={[
          styles.contentBody,
          { color: colors.foreground, fontFamily: fonts.sansRegular },
        ]}
      >
        {body}
      </Text>
    </View>
  );
}

function WeekContent({ content }: { content: JourneyWeekContent }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <View
        style={[
          styles.weekCard,
          { backgroundColor: colors.coralCard, borderColor: colors.coralCardBorder },
        ]}
      >
        <Text
          style={[
            styles.eyebrow,
            { color: colors.coralCardForeground, fontFamily: fonts.sansSemiBold, opacity: 0.7 },
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
          Week {content.weekNumber}
        </Text>
        <Text
          style={[
            styles.weekBody,
            { color: colors.coralCardForeground, fontFamily: fonts.sansRegular },
          ]}
        >
          {content.yourBaby}
        </Text>
      </View>

      {content.roleContent ? <ContentBlock label="For you" body={content.roleContent} /> : null}
      {content.milestones ? <ContentBlock label="Milestones" body={content.milestones} /> : null}
      {content.commonExperiences ? (
        <ContentBlock label="What's common now" body={content.commonExperiences} />
      ) : null}

      {content.isThisCommon ? (
        <View
          style={[
            styles.reassureCard,
            { backgroundColor: colors.greenCard, borderColor: colors.greenCardBorder },
          ]}
        >
          <Feather name="heart" size={15} color={colors.greenCardForeground} />
          <Text
            style={[
              styles.reassureText,
              { color: colors.greenCardForeground, fontFamily: fonts.sansRegular },
            ]}
          >
            {content.isThisCommon}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Journal slot (Story 2) ──────────────────────────────────────────────────

function PublishedReflection({ text }: { text: string }) {
  const colors = useColors();
  return (
    <View
      style={[styles.journalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.journalHeaderRow}>
        <Feather name="check-circle" size={15} color={colors.primary} />
        <Text
          style={[
            styles.eyebrow,
            { color: colors.mutedForeground, fontFamily: fonts.sansSemiBold, marginBottom: 0 },
          ]}
        >
          THIS WEEK'S REFLECTION
        </Text>
      </View>
      <Text
        style={[
          styles.reflectionText,
          { color: colors.foreground, fontFamily: fonts.sansRegular },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

function JournalComposer({
  slot,
  weekNumber,
  pregnancyId,
}: {
  slot: JournalSlot;
  weekNumber: number;
  pregnancyId: number;
}) {
  const colors = useColors();
  const queryClient = useQueryClient();

  const [selectedPrompt, setSelectedPrompt] = useState<MemoryPromptOption | null>(
    slot.defaultPrompt ?? slot.eligiblePrompts[0] ?? null,
  );
  const [showPicker, setShowPicker] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMemory = useCreateMemory({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({
          queryKey: getGetCurrentJourneyWeekQueryKey(pregnancyId),
        });
      },
      onError: () => {
        setError("Something went wrong saving your reflection. Please try again.");
      },
    },
  });

  if (!selectedPrompt) {
    return (
      <View
        style={[styles.journalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text
          style={[
            styles.reflectionText,
            { color: colors.mutedForeground, fontFamily: fonts.sansRegular },
          ]}
        >
          You've reflected on every prompt available for now — beautiful work. New ones open up
          as your weeks go on.
        </Text>
      </View>
    );
  }

  const canSave = text.trim().length > 0 && !createMemory.isPending;

  function handleSave() {
    if (!selectedPrompt) return;
    setError(null);
    createMemory.mutate({
      pregnancyId,
      data: {
        sourceType: "journey_prompt",
        journeyWeekNumber: weekNumber,
        promptLibraryItemId: selectedPrompt.id,
        text: text.trim(),
      },
    });
  }

  return (
    <View style={styles.section}>
      <Text
        style={[
          styles.eyebrow,
          { color: colors.mutedForeground, fontFamily: fonts.sansSemiBold },
        ]}
      >
        A MOMENT TO REFLECT
      </Text>

      <View
        style={[styles.journalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text
          style={[
            styles.promptText,
            { color: colors.foreground, fontFamily: fonts.serif },
          ]}
        >
          {selectedPrompt.promptText}
        </Text>

        {slot.eligiblePrompts.length > 1 ? (
          <TouchableOpacity
            onPress={() => setShowPicker((v) => !v)}
            activeOpacity={0.6}
            style={styles.switchPromptRow}
          >
            <Feather name="refresh-cw" size={13} color={colors.primary} />
            <Text
              style={[
                styles.switchPromptText,
                { color: colors.primary, fontFamily: fonts.sansMedium },
              ]}
            >
              {showPicker ? "Hide prompts" : "Choose a different prompt"}
            </Text>
          </TouchableOpacity>
        ) : null}

        {showPicker
          ? slot.eligiblePrompts.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => {
                  setSelectedPrompt(p);
                  setShowPicker(false);
                }}
                activeOpacity={0.6}
                style={[
                  styles.promptOption,
                  {
                    borderColor: p.id === selectedPrompt.id ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.promptOptionText,
                    { color: colors.foreground, fontFamily: fonts.sansRegular },
                  ]}
                >
                  {p.promptText}
                </Text>
              </TouchableOpacity>
            ))
          : null}

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write as much or as little as you like…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[
            styles.input,
            {
              color: colors.foreground,
              fontFamily: fonts.sansRegular,
              borderColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        />

        {error ? (
          <Text style={[styles.errorText, { color: colors.primary, fontFamily: fonts.sansMedium }]}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={handleSave}
          disabled={!canSave}
          activeOpacity={0.85}
          style={[
            styles.saveBtn,
            { backgroundColor: canSave ? colors.primary : colors.border },
          ]}
        >
          {createMemory.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Text
              style={[
                styles.saveBtnText,
                {
                  color: canSave ? colors.primaryForeground : colors.mutedForeground,
                  fontFamily: fonts.sansSemiBold,
                },
              ]}
            >
              Save reflection
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function JournalSection({
  slot,
  weekNumber,
  pregnancyId,
}: {
  slot: JournalSlot;
  weekNumber: number;
  pregnancyId: number;
}) {
  if (slot.published && slot.memory?.text) {
    return (
      <View style={styles.section}>
        <PublishedReflection text={slot.memory.text} />
      </View>
    );
  }
  return <JournalComposer slot={slot} weekNumber={weekNumber} pregnancyId={pregnancyId} />;
}

// ─── Empty / loading states ──────────────────────────────────────────────────

function CenteredMessage({ title, body }: { title: string; body: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.centered,
        { backgroundColor: colors.background, paddingTop: Math.max(insets.top + 20, 60) },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground, fontFamily: fonts.serif }]}>
        {title}
      </Text>
      <Text
        style={[styles.sub, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}
      >
        {body}
      </Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function JourneyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentPregnancyId } = useApp();

  // The hook self-disables when pregnancyId is null/undefined.
  const { data, isLoading, isError } = useGetCurrentJourneyWeek(currentPregnancyId as number);

  const tabBarHeight = Platform.OS === "web" ? 84 : 80;

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <CenteredMessage
        title="Journey"
        body="We couldn't load your week just now. Pull down or check back in a moment."
      />
    );
  }

  if (data.state === "needs_due_date") {
    return (
      <CenteredMessage
        title="Journey"
        body="Add your due date to unlock your week-by-week story. You can do this anytime from your pregnancy details."
      />
    );
  }

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
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.foreground, fontFamily: fonts.serif }]}>
          Journey
        </Text>

        {data.content ? <WeekContent content={data.content} /> : null}

        {data.journal && data.weekNumber != null ? (
          <JournalSection
            slot={data.journal}
            weekNumber={data.weekNumber}
            pregnancyId={currentPregnancyId as number}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 34,
    letterSpacing: -0.3,
    marginBottom: 20,
  },
  sub: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  section: {
    marginBottom: 28,
    gap: 16,
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
  contentBlock: {
    gap: 4,
  },
  contentBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  reassureCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  reassureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  journalCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 14,
  },
  journalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reflectionText: {
    fontSize: 15,
    lineHeight: 23,
  },
  promptText: {
    fontSize: 20,
    lineHeight: 27,
    letterSpacing: -0.2,
  },
  switchPromptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  switchPromptText: {
    fontSize: 13,
  },
  promptOption: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  promptOptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  errorText: {
    fontSize: 13,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    fontSize: 15,
  },
});
