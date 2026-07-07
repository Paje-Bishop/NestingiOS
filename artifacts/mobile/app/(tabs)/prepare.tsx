import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getGetDecisionQueryKey,
  getListDecisionsQueryKey,
  getListTasksQueryKey,
  useAddContribution,
  useCloseDecision,
  useCreateDecision,
  useCreateTask,
  useGetDecision,
  useListDecisions,
  useListTasks,
  useReopenDecision,
  useUpdateTask,
  type ChecklistItem,
  type PrepareMember,
  type PrepareTasksView,
  type SharedDecision,
  type SharedDecisionDetail,
  type Task,
} from "@workspace/api-client-react";
import { fonts } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

// Celebratory, never shaming (Nest Content Bible "Gentle Momentum"). Rotated at
// random so completion never feels like a canned response.
const MOMENTUM_LINES = [
  "That's one less thing to carry.",
  "Done. One more thing in place.",
  "Nicely done — you're building real momentum.",
  "One step closer, together.",
];

type TaskTab = "for_you" | "together" | "all" | "completed";
type TopTab = "tasks" | "decisions";

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

// Ascending due timing; tasks without a due week sort last.
function byDueTiming(a: Task, b: Task): number {
  const aw = a.dueWeek ?? Number.MAX_SAFE_INTEGER;
  const bw = b.dueWeek ?? Number.MAX_SAFE_INTEGER;
  if (aw !== bw) return aw - bw;
  return a.sortOrder - b.sortOrder;
}

// ─── Task list card ───────────────────────────────────────────────────────────

function TaskCard({
  task,
  waiting,
  onPress,
}: {
  task: Task;
  waiting: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const done = task.status === "completed";
  const checklist = task.checklist ?? [];
  const checkedCount = checklist.filter((c) => c.done).length;

  return (
    <TouchableOpacity
      accessibilityLabel={`Open task ${task.title}`}
      onPress={onPress}
      style={[styles.taskCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.taskCardRow}>
        <Feather
          name={done ? "check-circle" : "circle"}
          size={20}
          color={done ? colors.greenCardForeground : colors.mutedForeground}
        />
        <View style={styles.taskCardBody}>
          <Text
            style={[
              styles.taskTitle,
              {
                color: colors.foreground,
                fontFamily: fonts.sansSemiBold,
                textDecorationLine: done ? "line-through" : "none",
              },
            ]}
          >
            {task.title}
          </Text>
          <View style={styles.taskMetaRow}>
            {task.dueWeek != null ? (
              <Text style={[styles.taskMeta, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}>
                Week {task.dueWeek}
              </Text>
            ) : null}
            {task.assignedMemberName ? (
              <Text style={[styles.taskMeta, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}>
                · {task.assignedMemberName}
              </Text>
            ) : null}
            {checklist.length > 0 ? (
              <Text style={[styles.taskMeta, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}>
                · {checkedCount}/{checklist.length}
              </Text>
            ) : null}
          </View>
          {waiting ? (
            <Text style={[styles.waitingLabel, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}>
              Waiting for a Pregnant Person to join
            </Text>
          ) : null}
        </View>
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Task detail (Story 2 + 3) ────────────────────────────────────────────────

function TaskDetail({
  task,
  view,
  pregnancyId,
  onBack,
}: {
  task: Task;
  view: PrepareTasksView;
  pregnancyId: number;
  onBack: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [momentum, setMomentum] = useState<string | null>(null);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [reassigning, setReassigning] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(pregnancyId) });

  const update = useUpdateTask({ mutation: { onSuccess: invalidate } });

  const done = task.status === "completed";
  const checklist = task.checklist ?? [];

  function toggleChecklistItem(itemId: string) {
    const next: ChecklistItem[] = checklist.map((c) =>
      c.id === itemId ? { ...c, done: !c.done } : c,
    );
    update.mutate({ pregnancyId, taskId: task.id, data: { checklist: next } });
  }

  function complete() {
    haptic();
    setMomentum(MOMENTUM_LINES[Math.floor(Math.random() * MOMENTUM_LINES.length)]);
    update.mutate({ pregnancyId, taskId: task.id, data: { status: "completed" } });
  }

  function reopen() {
    setMomentum(null);
    update.mutate({ pregnancyId, taskId: task.id, data: { status: "not_started" } });
  }

  function reassignTo(memberId: number | null) {
    setReassigning(false);
    update.mutate({ pregnancyId, taskId: task.id, data: { assignedMemberId: memberId } });
  }

  function saveNotes() {
    update.mutate({ pregnancyId, taskId: task.id, data: { notes } });
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 24, paddingTop: Math.max(insets.top + 8, 44), paddingBottom: 60 }}
    >
      <TouchableOpacity accessibilityLabel="Back to tasks" onPress={onBack} style={styles.backRow}>
        <Feather name="chevron-left" size={22} color={colors.primary} />
        <Text style={[styles.backText, { color: colors.primary, fontFamily: fonts.sansMedium }]}>Prepare</Text>
      </TouchableOpacity>

      <Text style={[styles.detailTitle, { color: colors.foreground, fontFamily: fonts.serif }]}>{task.title}</Text>

      {task.whyNow ? <DetailBlock label="WHY NOW" body={task.whyNow} /> : null}
      {task.whyItMatters ? <DetailBlock label="WHY IT MATTERS" body={task.whyItMatters} /> : null}

      {checklist.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground, fontFamily: fonts.sansSemiBold }]}>
            CHECKLIST
          </Text>
          {checklist.map((item) => (
            <TouchableOpacity
              key={item.id}
              accessibilityLabel={`Toggle ${item.label}`}
              onPress={() => toggleChecklistItem(item.id)}
              disabled={update.isPending}
              style={styles.checkRow}
            >
              <Feather
                name={item.done ? "check-square" : "square"}
                size={20}
                color={item.done ? colors.greenCardForeground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.checkLabel,
                  {
                    color: colors.foreground,
                    fontFamily: fonts.sansRegular,
                    textDecorationLine: item.done ? "line-through" : "none",
                  },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {task.prompts ? (
        <View style={[styles.promptBox, { backgroundColor: colors.accent, borderColor: colors.coralCardBorder }]}>
          <Text style={[styles.promptText, { color: colors.accentForeground, fontFamily: fonts.sansRegular }]}>
            {task.prompts}
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground, fontFamily: fonts.sansSemiBold }]}>
          ASSIGNED TO
        </Text>
        <TouchableOpacity
          accessibilityLabel="Reassign task"
          onPress={() => setReassigning((v) => !v)}
          style={[styles.assigneePill, { borderColor: colors.border }]}
        >
          <Feather name="user" size={16} color={colors.mutedForeground} />
          <Text style={[styles.assigneeText, { color: colors.foreground, fontFamily: fonts.sansMedium }]}>
            {task.assignedMemberName ?? "Unassigned"}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        {reassigning ? (
          <View style={styles.reassignList}>
            {view.members.map((m: PrepareMember) => (
              <TouchableOpacity
                key={m.membershipId}
                accessibilityLabel={`Assign to ${m.personName}`}
                onPress={() => reassignTo(m.membershipId)}
                style={styles.reassignRow}
              >
                <Text style={[styles.assigneeText, { color: colors.foreground, fontFamily: fonts.sansRegular }]}>
                  {m.personName}
                </Text>
                {task.assignedMemberId === m.membershipId ? (
                  <Feather name="check" size={16} color={colors.primary} />
                ) : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              accessibilityLabel="Unassign"
              onPress={() => reassignTo(null)}
              style={styles.reassignRow}
            >
              <Text style={[styles.assigneeText, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}>
                Unassign
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground, fontFamily: fonts.sansSemiBold }]}>NOTES</Text>
        <TextInput
          accessibilityLabel="Task notes"
          value={notes}
          onChangeText={setNotes}
          onBlur={saveNotes}
          placeholder="Add a note…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[
            styles.notesInput,
            { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: fonts.sansRegular },
          ]}
        />
      </View>

      {momentum ? (
        <View style={[styles.momentum, { backgroundColor: colors.greenCard, borderColor: colors.greenCardBorder }]}>
          <Feather name="heart" size={16} color={colors.greenCardForeground} />
          <Text style={[styles.momentumText, { color: colors.greenCardForeground, fontFamily: fonts.sansMedium }]}>
            {momentum}
          </Text>
        </View>
      ) : null}

      {done ? (
        <TouchableOpacity accessibilityLabel="Mark not done" onPress={reopen} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
          <Text style={[styles.secondaryBtnText, { color: colors.foreground, fontFamily: fonts.sansSemiBold }]}>
            Mark as not done
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          accessibilityLabel="Mark complete"
          onPress={complete}
          disabled={update.isPending}
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground, fontFamily: fonts.sansSemiBold }]}>
            Mark complete
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function DetailBlock({ label, body }: { label: string; body: string }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.eyebrow, { color: colors.mutedForeground, fontFamily: fonts.sansSemiBold }]}>{label}</Text>
      <Text style={[styles.detailBody, { color: colors.foreground, fontFamily: fonts.sansRegular }]}>{body}</Text>
    </View>
  );
}

// ─── Create task (Story 5) ────────────────────────────────────────────────────

function CreateTaskForm({
  pregnancyId,
  members,
  onDone,
}: {
  pregnancyId: number;
  members: PrepareMember[];
  onDone: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [assignedMemberId, setAssignedMemberId] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [draft, setDraft] = useState("");
  const create = useCreateTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(pregnancyId) });
        onDone();
      },
    },
  });

  const assigneeName =
    members.find((m) => m.membershipId === assignedMemberId)?.personName ?? "Anyone";

  function addItem() {
    const label = draft.trim();
    if (!label) return;
    setItems((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label, done: false },
    ]);
    setDraft("");
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((c) => c.id !== id));
  }

  function submit() {
    create.mutate({
      pregnancyId,
      data: {
        title: title.trim(),
        taskType: "together",
        assignedMemberId: assignedMemberId ?? undefined,
        checklist: items.length > 0 ? items : undefined,
      },
    });
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 24, paddingTop: Math.max(insets.top + 8, 44), paddingBottom: 60 }}
    >
      <TouchableOpacity accessibilityLabel="Cancel new task" onPress={onDone} style={styles.backRow}>
        <Feather name="chevron-left" size={22} color={colors.primary} />
        <Text style={[styles.backText, { color: colors.primary, fontFamily: fonts.sansMedium }]}>Prepare</Text>
      </TouchableOpacity>
      <Text style={[styles.detailTitle, { color: colors.foreground, fontFamily: fonts.serif }]}>Add a task</Text>
      <TextInput
        accessibilityLabel="New task title"
        value={title}
        onChangeText={setTitle}
        placeholder="What needs doing?"
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.notesInput,
          { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: fonts.sansRegular, minHeight: 52 },
        ]}
      />

      <View style={styles.section}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground, fontFamily: fonts.sansSemiBold }]}>
          WHO IT&apos;S FOR
        </Text>
        <TouchableOpacity
          accessibilityLabel="Choose who this task is for"
          onPress={() => setPicking((v) => !v)}
          style={[styles.assigneePill, { borderColor: colors.border }]}
        >
          <Feather name="user" size={16} color={colors.mutedForeground} />
          <Text style={[styles.assigneeText, { color: colors.foreground, fontFamily: fonts.sansMedium }]}>
            {assigneeName}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        {picking ? (
          <View style={styles.reassignList}>
            {members.map((m) => (
              <TouchableOpacity
                key={m.membershipId}
                accessibilityLabel={`Assign to ${m.personName}`}
                onPress={() => {
                  setAssignedMemberId(m.membershipId);
                  setPicking(false);
                }}
                style={styles.reassignRow}
              >
                <Text style={[styles.assigneeText, { color: colors.foreground, fontFamily: fonts.sansRegular }]}>
                  {m.personName}
                </Text>
                {assignedMemberId === m.membershipId ? (
                  <Feather name="check" size={16} color={colors.primary} />
                ) : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              accessibilityLabel="Anyone"
              onPress={() => {
                setAssignedMemberId(null);
                setPicking(false);
              }}
              style={styles.reassignRow}
            >
              <Text style={[styles.assigneeText, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}>
                Anyone
              </Text>
              {assignedMemberId === null ? <Feather name="check" size={16} color={colors.primary} /> : null}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground, fontFamily: fonts.sansSemiBold }]}>
          CHECKLIST
        </Text>
        {items.map((item) => (
          <View key={item.id} style={styles.checkRow}>
            <Feather name="square" size={20} color={colors.mutedForeground} />
            <Text style={[styles.checkLabel, { color: colors.foreground, fontFamily: fonts.sansRegular }]}>
              {item.label}
            </Text>
            <TouchableOpacity accessibilityLabel={`Remove ${item.label}`} onPress={() => removeItem(item.id)}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.chkAddRow}>
          <TextInput
            accessibilityLabel="New checklist item"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addItem}
            returnKeyType="done"
            blurOnSubmit={false}
            placeholder="Add a sub-step…"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.chkInput,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: fonts.sansRegular },
            ]}
          />
          <TouchableOpacity
            accessibilityLabel="Add checklist item"
            onPress={addItem}
            disabled={draft.trim().length === 0}
            style={[styles.chkAddBtn, { backgroundColor: colors.primary, opacity: draft.trim().length === 0 ? 0.5 : 1 }]}
          >
            <Feather name="plus" size={20} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        accessibilityLabel="Save task"
        onPress={submit}
        disabled={title.trim().length === 0 || create.isPending}
        style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: title.trim().length === 0 ? 0.5 : 1 }]}
      >
        <Text style={[styles.primaryBtnText, { color: colors.primaryForeground, fontFamily: fonts.sansSemiBold }]}>
          Add task
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Decision detail (Story 4) ────────────────────────────────────────────────

function DecisionDetail({
  decisionId,
  pregnancyId,
  onBack,
}: {
  decisionId: number;
  pregnancyId: number;
  onBack: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [contribution, setContribution] = useState("");
  const [finalDecision, setFinalDecision] = useState("");
  const [finalRationale, setFinalRationale] = useState("");

  const query = useGetDecision(pregnancyId, decisionId);
  const decision = query.data as SharedDecisionDetail | undefined;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetDecisionQueryKey(pregnancyId, decisionId) });
    queryClient.invalidateQueries({ queryKey: getListDecisionsQueryKey(pregnancyId) });
  };

  const addContribution = useAddContribution({ mutation: { onSuccess: invalidate } });
  const closeDecision = useCloseDecision({ mutation: { onSuccess: invalidate } });
  const reopenDecision = useReopenDecision({ mutation: { onSuccess: invalidate } });

  if (query.isLoading || !decision) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const closed = decision.status === "closed";

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 24, paddingTop: Math.max(insets.top + 8, 44), paddingBottom: 60 }}
    >
      <TouchableOpacity accessibilityLabel="Back to decisions" onPress={onBack} style={styles.backRow}>
        <Feather name="chevron-left" size={22} color={colors.primary} />
        <Text style={[styles.backText, { color: colors.primary, fontFamily: fonts.sansMedium }]}>Decisions</Text>
      </TouchableOpacity>

      <Text style={[styles.detailTitle, { color: colors.foreground, fontFamily: fonts.serif }]}>{decision.title}</Text>
      {decision.prompt ? (
        <Text style={[styles.detailBody, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}>
          {decision.prompt}
        </Text>
      ) : null}

      {closed ? (
        <View style={[styles.closedBox, { backgroundColor: colors.greenCard, borderColor: colors.greenCardBorder }]}>
          <Text style={[styles.eyebrow, { color: colors.greenCardForeground, fontFamily: fonts.sansSemiBold }]}>
            WE DECIDED
          </Text>
          <Text style={[styles.detailBody, { color: colors.greenCardForeground, fontFamily: fonts.sansMedium }]}>
            {decision.finalDecision}
          </Text>
          {decision.finalRationale ? (
            <Text style={[styles.detailBody, { color: colors.greenCardForeground, fontFamily: fonts.sansRegular }]}>
              {decision.finalRationale}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground, fontFamily: fonts.sansSemiBold }]}>
          THE CONVERSATION
        </Text>
        {decision.contributions.length === 0 ? (
          <Text style={[styles.detailBody, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}>
            No thoughts shared yet.
          </Text>
        ) : (
          decision.contributions.map((c) => (
            <View key={c.id} style={[styles.contribCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.contribAuthor, { color: colors.primary, fontFamily: fonts.sansSemiBold }]}>
                {c.authorName}
              </Text>
              <Text style={[styles.detailBody, { color: colors.foreground, fontFamily: fonts.sansRegular }]}>
                {c.body}
              </Text>
            </View>
          ))
        )}
      </View>

      {!closed ? (
        <View style={styles.section}>
          <TextInput
            accessibilityLabel="Add your thoughts"
            value={contribution}
            onChangeText={setContribution}
            placeholder="Share your thoughts…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.notesInput,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: fonts.sansRegular },
            ]}
          />
          <TouchableOpacity
            accessibilityLabel="Post contribution"
            onPress={() => {
              addContribution.mutate({ pregnancyId, decisionId, data: { body: contribution.trim() } });
              setContribution("");
            }}
            disabled={contribution.trim().length === 0 || addContribution.isPending}
            style={[styles.secondaryBtn, { borderColor: colors.border, opacity: contribution.trim().length === 0 ? 0.5 : 1 }]}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.foreground, fontFamily: fonts.sansSemiBold }]}>
              Add to the conversation
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Only a contributor can record the outcome or reopen (Story 4). */}
      {decision.viewerIsContributor && !closed ? (
        <View style={[styles.recordBox, { borderColor: colors.border }]}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground, fontFamily: fonts.sansSemiBold }]}>
            RECORD THE DECISION
          </Text>
          <TextInput
            accessibilityLabel="Final decision"
            value={finalDecision}
            onChangeText={setFinalDecision}
            placeholder="What did you decide?"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.notesInput,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: fonts.sansRegular, minHeight: 48 },
            ]}
          />
          <TextInput
            accessibilityLabel="Final rationale"
            value={finalRationale}
            onChangeText={setFinalRationale}
            placeholder="Why? (optional)"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.notesInput,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: fonts.sansRegular, minHeight: 48 },
            ]}
          />
          <TouchableOpacity
            accessibilityLabel="Close decision"
            onPress={() => {
              haptic();
              closeDecision.mutate({
                pregnancyId,
                decisionId,
                data: { finalDecision: finalDecision.trim(), finalRationale: finalRationale.trim() || undefined },
              });
            }}
            disabled={finalDecision.trim().length === 0 || closeDecision.isPending}
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: finalDecision.trim().length === 0 ? 0.5 : 1 }]}
          >
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground, fontFamily: fonts.sansSemiBold }]}>
              Record & close
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {decision.viewerIsContributor && closed ? (
        <TouchableOpacity
          accessibilityLabel="Reopen decision"
          onPress={() => reopenDecision.mutate({ pregnancyId, decisionId })}
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.foreground, fontFamily: fonts.sansSemiBold }]}>
            Reopen this decision
          </Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

// ─── Create decision ──────────────────────────────────────────────────────────

function CreateDecisionForm({ pregnancyId, onDone }: { pregnancyId: number; onDone: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const create = useCreateDecision({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDecisionsQueryKey(pregnancyId) });
        onDone();
      },
    },
  });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 24, paddingTop: Math.max(insets.top + 8, 44) }}
    >
      <TouchableOpacity accessibilityLabel="Cancel new decision" onPress={onDone} style={styles.backRow}>
        <Feather name="chevron-left" size={22} color={colors.primary} />
        <Text style={[styles.backText, { color: colors.primary, fontFamily: fonts.sansMedium }]}>Decisions</Text>
      </TouchableOpacity>
      <Text style={[styles.detailTitle, { color: colors.foreground, fontFamily: fonts.serif }]}>Start a decision</Text>
      <TextInput
        accessibilityLabel="Decision title"
        value={title}
        onChangeText={setTitle}
        placeholder="What are you deciding together?"
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.notesInput,
          { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: fonts.sansRegular, minHeight: 52 },
        ]}
      />
      <TextInput
        accessibilityLabel="Decision prompt"
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Add a little context (optional)"
        placeholderTextColor={colors.mutedForeground}
        multiline
        style={[
          styles.notesInput,
          { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: fonts.sansRegular },
        ]}
      />
      <TouchableOpacity
        accessibilityLabel="Save decision"
        onPress={() => create.mutate({ pregnancyId, data: { title: title.trim(), prompt: prompt.trim() || undefined } })}
        disabled={title.trim().length === 0 || create.isPending}
        style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: title.trim().length === 0 ? 0.5 : 1 }]}
      >
        <Text style={[styles.primaryBtnText, { color: colors.primaryForeground, fontFamily: fonts.sansSemiBold }]}>
          Start decision
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PrepareScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentPregnancyId } = useApp();
  const pregnancyId = currentPregnancyId ?? 0;

  const [topTab, setTopTab] = useState<TopTab>("tasks");
  const [taskTab, setTaskTab] = useState<TaskTab>("for_you");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedDecisionId, setSelectedDecisionId] = useState<number | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingDecision, setCreatingDecision] = useState(false);

  const tasksQuery = useListTasks(pregnancyId, {
    query: { enabled: currentPregnancyId != null, queryKey: getListTasksQueryKey(pregnancyId) },
  });
  const decisionsQuery = useListDecisions(pregnancyId, {
    query: { enabled: currentPregnancyId != null, queryKey: getListDecisionsQueryKey(pregnancyId) },
  });

  const view = tasksQuery.data as PrepareTasksView | undefined;

  const filteredTasks = useMemo(() => {
    if (!view) return [];
    const tasks = view.tasks;
    const isPregnantPerson = view.viewerRole === "pregnant_person";
    switch (taskTab) {
      case "for_you":
        return tasks
          .filter(
            (t) =>
              t.status !== "completed" &&
              (t.assignedMemberId === view.viewerMembershipId ||
                (isPregnantPerson && t.taskType === "mine_only")),
          )
          .sort(byDueTiming);
      case "together":
        return tasks.filter((t) => t.status !== "completed" && t.taskType === "together").sort(byDueTiming);
      case "all":
        return tasks.filter((t) => t.status !== "completed").sort(byDueTiming);
      case "completed":
        return tasks.filter((t) => t.status === "completed").sort(byDueTiming);
    }
  }, [view, taskTab]);

  // Detail / create overlays take over the screen.
  if (selectedTaskId != null && view) {
    const task = view.tasks.find((t) => t.id === selectedTaskId);
    if (task) {
      return (
        <TaskDetail task={task} view={view} pregnancyId={pregnancyId} onBack={() => setSelectedTaskId(null)} />
      );
    }
  }
  if (creatingTask) {
    return (
      <CreateTaskForm
        pregnancyId={pregnancyId}
        members={view?.members ?? []}
        onDone={() => setCreatingTask(false)}
      />
    );
  }
  if (selectedDecisionId != null) {
    return (
      <DecisionDetail
        decisionId={selectedDecisionId}
        pregnancyId={pregnancyId}
        onBack={() => setSelectedDecisionId(null)}
      />
    );
  }
  if (creatingDecision) {
    return <CreateDecisionForm pregnancyId={pregnancyId} onDone={() => setCreatingDecision(false)} />;
  }

  const decisions = (decisionsQuery.data as SharedDecision[] | undefined) ?? [];
  const loading = tasksQuery.isLoading || decisionsQuery.isLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Math.max(insets.top + 12, 52) }]}>
      <Text style={[styles.title, { color: colors.foreground, fontFamily: fonts.serif }]}>Prepare</Text>

      <View style={styles.topTabs}>
        <TopTabButton label="Tasks" active={topTab === "tasks"} onPress={() => setTopTab("tasks")} />
        <TopTabButton label="Decisions" active={topTab === "decisions"} onPress={() => setTopTab("decisions")} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : topTab === "tasks" ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabsScroll} contentContainerStyle={styles.subTabs}>
            {(["for_you", "together", "all", "completed"] as TaskTab[]).map((t) => (
              <SubTabButton
                key={t}
                label={t === "for_you" ? "For You" : t === "all" ? "All" : t === "together" ? "Together" : "Completed"}
                active={taskTab === t}
                onPress={() => setTaskTab(t)}
              />
            ))}
          </ScrollView>
          <ScrollView contentContainerStyle={styles.listContent}>
            {filteredTasks.length === 0 ? (
              <Text style={[styles.empty, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}>
                Nothing here yet.
              </Text>
            ) : (
              filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  waiting={taskTab === "all" && task.taskType === "mine_only" && view != null && !view.hasPregnantPerson}
                  onPress={() => setSelectedTaskId(task.id)}
                />
              ))
            )}
            <TouchableOpacity accessibilityLabel="Add a task" onPress={() => setCreatingTask(true)} style={[styles.addRow, { borderColor: colors.border }]}>
              <Feather name="plus" size={18} color={colors.primary} />
              <Text style={[styles.addText, { color: colors.primary, fontFamily: fonts.sansSemiBold }]}>Add a task</Text>
            </TouchableOpacity>
          </ScrollView>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {decisions.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}>
              No shared decisions yet.
            </Text>
          ) : (
            decisions.map((d) => (
              <TouchableOpacity
                key={d.id}
                accessibilityLabel={`Open decision ${d.title}`}
                onPress={() => setSelectedDecisionId(d.id)}
                style={[styles.taskCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.taskCardRow}>
                  <Feather
                    name={d.status === "closed" ? "check-circle" : "message-circle"}
                    size={20}
                    color={d.status === "closed" ? colors.greenCardForeground : colors.mutedForeground}
                  />
                  <View style={styles.taskCardBody}>
                    <Text style={[styles.taskTitle, { color: colors.foreground, fontFamily: fonts.sansSemiBold }]}>
                      {d.title}
                    </Text>
                    <Text style={[styles.taskMeta, { color: colors.mutedForeground, fontFamily: fonts.sansRegular }]}>
                      {d.status === "closed" ? "Decided" : "Open"} · {d.contributionCount} {d.contributionCount === 1 ? "voice" : "voices"}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </View>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity accessibilityLabel="Start a decision" onPress={() => setCreatingDecision(true)} style={[styles.addRow, { borderColor: colors.border }]}>
            <Feather name="plus" size={18} color={colors.primary} />
            <Text style={[styles.addText, { color: colors.primary, fontFamily: fonts.sansSemiBold }]}>Start a decision</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function TopTabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityLabel={`${label} tab`}
      onPress={onPress}
      style={[
        styles.topTab,
        { borderBottomColor: active ? colors.primary : "transparent" },
      ]}
    >
      <Text
        style={[
          styles.topTabText,
          { color: active ? colors.foreground : colors.mutedForeground, fontFamily: active ? fonts.sansSemiBold : fonts.sansMedium },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SubTabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      accessibilityLabel={`${label} view`}
      onPress={onPress}
      style={[
        styles.subTab,
        { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border },
      ]}
    >
      <Text
        style={[
          styles.subTabText,
          { color: active ? colors.primaryForeground : colors.mutedForeground, fontFamily: fonts.sansMedium },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  title: { fontSize: 34, letterSpacing: -0.3, marginBottom: 12 },
  topTabs: { flexDirection: "row", gap: 20, marginBottom: 8 },
  topTab: { paddingVertical: 8, borderBottomWidth: 2 },
  topTabText: { fontSize: 16 },
  subTabsScroll: { flexGrow: 0, marginTop: 8 },
  subTabs: { gap: 8, paddingVertical: 8, paddingRight: 8 },
  subTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  subTabText: { fontSize: 13 },
  listContent: { paddingTop: 8, paddingBottom: 40 },
  empty: { fontSize: 15, textAlign: "center", paddingVertical: 40 },
  taskCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10 },
  taskCardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  taskCardBody: { flex: 1, gap: 3 },
  taskTitle: { fontSize: 16, lineHeight: 22 },
  taskMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  taskMeta: { fontSize: 13 },
  waitingLabel: { fontSize: 12, marginTop: 2, fontStyle: "italic" },
  addRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", marginTop: 6 },
  addText: { fontSize: 15 },
  backRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  backText: { fontSize: 16 },
  detailTitle: { fontSize: 28, letterSpacing: -0.3, marginBottom: 12, lineHeight: 34 },
  section: { marginTop: 20, gap: 8 },
  eyebrow: { fontSize: 11, letterSpacing: 1 },
  detailBody: { fontSize: 15, lineHeight: 22 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  checkLabel: { fontSize: 15, flex: 1 },
  promptBox: { marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1 },
  promptText: { fontSize: 14, lineHeight: 21 },
  assigneePill: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  assigneeText: { fontSize: 15 },
  reassignList: { marginTop: 8, gap: 2 },
  reassignRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 4 },
  chkAddRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  chkInput: { flex: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  chkAddBtn: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  notesInput: { borderRadius: 14, borderWidth: 1, padding: 14, fontSize: 15, minHeight: 80, textAlignVertical: "top", marginTop: 4 },
  momentum: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, padding: 14, borderRadius: 14, borderWidth: 1 },
  momentumText: { fontSize: 15, flex: 1 },
  primaryBtn: { marginTop: 24, paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  primaryBtnText: { fontSize: 16 },
  secondaryBtn: { marginTop: 12, paddingVertical: 15, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  secondaryBtnText: { fontSize: 15 },
  contribCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8, gap: 4 },
  contribAuthor: { fontSize: 13 },
  closedBox: { marginTop: 16, padding: 16, borderRadius: 14, borderWidth: 1, gap: 6 },
  recordBox: { marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1, gap: 8 },
});
