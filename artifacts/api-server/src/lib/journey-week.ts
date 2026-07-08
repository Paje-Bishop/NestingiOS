// EDD is the start of week 40. Given a due date, the current gestational week is
// 40 minus the number of whole weeks still remaining until the due date. Clamped
// to the 1-42 content range.
export function weekFromDueDate(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = Math.round((due.getTime() - today.getTime()) / msPerDay);
  const week = 40 - Math.floor(daysUntilDue / 7);
  return Math.min(42, Math.max(1, week));
}
