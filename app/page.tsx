"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type TaskContext = "deep" | "admin" | "calls" | "errands" | "other";
type DayType = "workday" | "admin" | "creative" | "light";
type ReviewStatus = "none" | "done" | "delayed" | "canceled" | "moved" | "other";

interface ParsedTask {
  id: number;
  title: string;
  include: boolean;
  durationMinutes: number;
  isImportant: boolean;
  context: TaskContext;
  reviewStatus?: ReviewStatus;
  reviewNote?: string;
}

interface ParsedEvent {
  title: string;
  startMinutes: number;
  endMinutes: number;
}

interface FreeSlot {
  startMinutes: number;
  endMinutes: number;
}

interface PlannedBlock {
  taskTitle: string;
  startMinutes: number;
  endMinutes: number;
  isImportant: boolean;
  context: TaskContext;
}

const DAY_TYPE_CONFIG: Record<
  DayType,
  { label: string; startMinutes: number; endMinutes: number }
> = {
  workday: {
    label: "Workday (09–17)",
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
  },
  admin: {
    label: "Admin / chores (10–18)",
    startMinutes: 10 * 60,
    endMinutes: 18 * 60,
  },
  creative: {
    label: "Creative (11–19)",
    startMinutes: 11 * 60,
    endMinutes: 19 * 60,
  },
  light: {
    label: "Light day (09–15)",
    startMinutes: 9 * 60,
    endMinutes: 15 * 60,
  },
};

function parseTimeToMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseEvents(
  calendarText: string,
  workStart: number,
  workEnd: number
): ParsedEvent[] {
  const lines = calendarText.split("\n");
  const events: ParsedEvent[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // HH:MM-HH:MM Title
    const rangeMatch = line.match(
      /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s+(.+)$/
    );
    if (rangeMatch) {
      const start = parseTimeToMinutes(rangeMatch[1]);
      const end = parseTimeToMinutes(rangeMatch[2]);
      const title = rangeMatch[3].trim();
      if (start === null || end === null || !title) continue;
      const clampedStart = Math.max(start, workStart);
      const clampedEnd = Math.min(end, workEnd);
      if (clampedEnd > clampedStart) {
        events.push({ title, startMinutes: clampedStart, endMinutes: clampedEnd });
      }
      continue;
    }

    // HH:MM Title  (default 30 min)
    const singleMatch = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
    if (singleMatch) {
      const start = parseTimeToMinutes(singleMatch[1]);
      const title = singleMatch[2].trim();
      if (start === null || !title) continue;
      const defaultEnd = start + 30;
      const clampedStart = Math.max(start, workStart);
      const clampedEnd = Math.min(defaultEnd, workEnd);
      if (clampedEnd > clampedStart) {
        events.push({ title, startMinutes: clampedStart, endMinutes: clampedEnd });
      }
    }
  }

  events.sort((a, b) => a.startMinutes - b.startMinutes);
  return events;
}

function computeFreeSlots(
  events: ParsedEvent[],
  workStart: number,
  workEnd: number
): FreeSlot[] {
  const slots: FreeSlot[] = [];
  let cursor = workStart;

  for (const event of events) {
    if (event.startMinutes > cursor) {
      slots.push({ startMinutes: cursor, endMinutes: event.startMinutes });
    }
    cursor = Math.max(cursor, event.endMinutes);
  }

  if (cursor < workEnd) {
    slots.push({ startMinutes: cursor, endMinutes: workEnd });
  }

  return slots;
}

function minutesToLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function minutesToTimeString(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function buildPlan(
  freeSlots: FreeSlot[],
  tasks: ParsedTask[]
): { blocks: PlannedBlock[]; unscheduled: ParsedTask[] } {
  const blocks: PlannedBlock[] = [];
  const remainingTasks: ParsedTask[] = [];

  let slotIndex = 0;
  let currentSlot = freeSlots[slotIndex] ?? null;
  let slotCursor = currentSlot ? currentSlot.startMinutes : 0;

  for (const task of tasks) {
    if (!task.include || task.durationMinutes <= 0) {
      remainingTasks.push(task);
      continue;
    }

    let remaining = task.durationMinutes;

    while (remaining > 0 && currentSlot) {
      if (slotCursor >= currentSlot.endMinutes) {
        slotIndex += 1;
        currentSlot = freeSlots[slotIndex] ?? null;
        if (currentSlot) {
          slotCursor = currentSlot.startMinutes;
        }
        continue;
      }

      const available = currentSlot.endMinutes - slotCursor;
      const used = Math.min(available, remaining);
      const blockStart = slotCursor;
      const blockEnd = blockStart + used;

      blocks.push({
        taskTitle: task.title,
        startMinutes: blockStart,
        endMinutes: blockEnd,
        isImportant: task.isImportant,
        context: task.context,
      });

      remaining -= used;
      slotCursor = blockEnd;
    }

    if (remaining > 0) {
      remainingTasks.push(task);
    }
  }

  return { blocks, unscheduled: remainingTasks };
}

function contextLabel(ctx: TaskContext): string {
  switch (ctx) {
    case "deep":
      return "Deep work";
    case "admin":
      return "Admin";
    case "calls":
      return "Calls";
    case "errands":
      return "Errands";
    default:
      return "Other";
  }
}

function formatCountdown(deltaMinutes: number): string {
  if (deltaMinutes <= 0) return "";
  const h = Math.floor(deltaMinutes / 60);
  const m = deltaMinutes % 60;
  if (h === 0) return `Starts in ${m}m`;
  if (m === 0) return `Starts in ${h}h`;
  return `Starts in ${h}h ${m}m`;
}

function buildResumeText(
  tasks: ParsedTask[],
  daySummary: string,
  dayType: DayType
): string {
  const lines: string[] = [];
  lines.push("Today Desk – Resume of the day");
  lines.push("");
  lines.push(`Day type: ${DAY_TYPE_CONFIG[dayType].label}`);
  lines.push("");

  if (daySummary.trim()) {
    lines.push("Overall notes:");
    lines.push(daySummary.trim());
    lines.push("");
  }

  if (tasks.length > 0) {
    lines.push("Tasks review:");
    for (const task of tasks) {
      const status = task.reviewStatus && task.reviewStatus !== "none"
        ? task.reviewStatus
        : "no status";
      const note = task.reviewNote?.trim();
      let line = `- ${task.title} — ${status}`;
      if (note) {
        line += ` (${note})`;
      }
      lines.push(line);
    }
  } else {
    lines.push("No tasks recorded for today.");
  }

  return lines.join("\n");
}

const STORAGE_KEY = "today-desk-v1";

export default function TodayDeskPage() {
  const [calendarRaw, setCalendarRaw] = useState("");
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [planBlocks, setPlanBlocks] = useState<PlannedBlock[]>([]);
  const [unscheduled, setUnscheduled] = useState<ParsedTask[]>([]);
  const [quickTask, setQuickTask] = useState("");
  const [dayType, setDayType] = useState<DayType>("workday");
  const [workStartMinutes, setWorkStartMinutes] = useState(
    DAY_TYPE_CONFIG.workday.startMinutes
  );
  const [workEndMinutes, setWorkEndMinutes] = useState(
    DAY_TYPE_CONFIG.workday.endMinutes
  );
  const [now, setNow] = useState<Date | null>(null);
  const [daySummary, setDaySummary] = useState("");
  const [emailDraftOpen, setEmailDraftOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const reminderTimersRef = useRef<number[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // ignore if AdSense is not ready yet
    }
  }, []);

  // Derived values
  const freeSlots = useMemo(
    () => computeFreeSlots(events, workStartMinutes, workEndMinutes),
    [events, workStartMinutes, workEndMinutes]
  );

  const topTasks = useMemo(
    () => tasks.filter((t) => t.isImportant).slice(0, 3),
    [tasks]
  );

  const totalFreeMinutes = useMemo(
    () =>
      freeSlots.reduce(
        (sum, slot) => sum + (slot.endMinutes - slot.startMinutes),
        0
      ),
    [freeSlots]
  );

  const totalPlannedTaskMinutes = useMemo(
    () =>
      planBlocks.reduce(
        (sum, block) => sum + (block.endMinutes - block.startMinutes),
        0
      ),
    [planBlocks]
  );

  const overloadMessage = useMemo(() => {
    const diff = totalPlannedTaskMinutes - totalFreeMinutes;
    if (totalFreeMinutes === 0) {
      return "No free time in your work window.";
    }
    if (diff > 0) {
      return `Overbooked by ${minutesToLabel(diff)}.`;
    }
    if (diff < 0) {
      return `You still have ${minutesToLabel(-diff)} free.`;
    }
    return "Perfectly packed – no free time left.";
  }, [totalFreeMinutes, totalPlannedTaskMinutes]);

  const nowMinutes = useMemo(() => {
    if (!now) return null;
    return now.getHours() * 60 + now.getMinutes();
  }, [now]);

  const resumeText = useMemo(
    () => buildResumeText(tasks, daySummary, dayType),
    [tasks, daySummary, dayType]
  );

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.dayType) setDayType(parsed.dayType as DayType);
      if (typeof parsed.calendarRaw === "string") setCalendarRaw(parsed.calendarRaw);
      if (Array.isArray(parsed.tasks)) setTasks(parsed.tasks);
      if (typeof parsed.daySummary === "string") setDaySummary(parsed.daySummary);
    } catch {
      // ignore
    }
  }, []);

  // React to dayType changes
  useEffect(() => {
    const config = DAY_TYPE_CONFIG[dayType];
    setWorkStartMinutes(config.startMinutes);
    setWorkEndMinutes(config.endMinutes);
    setPlanBlocks([]);
    setUnscheduled([]);
  }, [dayType]);

  // Clock
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-parse calendar
  useEffect(() => {
    const parsed = parseEvents(calendarRaw, workStartMinutes, workEndMinutes);
    setEvents(parsed);
  }, [calendarRaw, workStartMinutes, workEndMinutes]);

  // Save to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const data = {
      dayType,
      calendarRaw,
      tasks,
      daySummary,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }, [dayType, calendarRaw, tasks, daySummary]);

  // Reminders for important blocks
  useEffect(() => {
    // clear existing timers
    for (const id of reminderTimersRef.current) {
      window.clearTimeout(id);
    }
    reminderTimersRef.current = [];

    if (!now) return;

    const nowMs = now.getTime();

    for (const block of planBlocks) {
      if (!block.isImportant) continue;

      const startMinutes = block.startMinutes;
      const reminderMinutes = startMinutes - 5;
      if (reminderMinutes <= 0) continue;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const reminderTimeMs = today.getTime() + reminderMinutes * 60 * 1000;

      if (reminderTimeMs <= nowMs) {
        // already past; skip
        continue;
      }

      const delayMs = reminderTimeMs - nowMs;

      const timeoutId = window.setTimeout(() => {
        if ("Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification("Today Desk – upcoming important block", {
              body: `${block.taskTitle} at ${minutesToTimeString(
                block.startMinutes
              )}`,
            });
          } else {
            alert(
              `Important block soon: ${block.taskTitle} at ${minutesToTimeString(
                block.startMinutes
              )}`
            );
          }
        } else {
          alert(
            `Important block soon: ${block.taskTitle} at ${minutesToTimeString(
              block.startMinutes
            )}`
          );
        }
      }, delayMs);

      reminderTimersRef.current.push(timeoutId);
    }

    return () => {
      for (const id of reminderTimersRef.current) {
        window.clearTimeout(id);
      }
      reminderTimersRef.current = [];
    };
  }, [planBlocks, now]);

  function handleAddQuickTask() {
    const title = quickTask.trim();
    if (!title) return;
    setTasks((prev) => [
      ...prev,
      {
        id: prev.length ? prev[prev.length - 1].id + 1 : 1,
        title,
        include: true,
        durationMinutes: 30,
        isImportant: false,
        context: "other",
      },
    ]);
    setQuickTask("");
  }

  function handleToggleTaskInclude(id: number) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, include: !t.include } : t))
    );
  }

  function handleToggleTaskImportant(id: number) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, isImportant: !t.isImportant } : t
      )
    );
  }

  function handleTaskDurationChange(id: number, minutes: number) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, durationMinutes: minutes } : t))
    );
  }

  function handleTaskContextChange(id: number, ctx: TaskContext) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, context: ctx } : t))
    );
  }

  function handleTaskReviewChange(
    id: number,
    changes: Partial<Pick<ParsedTask, "reviewStatus" | "reviewNote">>
  ) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...changes } : t))
    );
  }

  function handleBuildPlan() {
    const { blocks, unscheduled } = buildPlan(freeSlots, tasks);
    setPlanBlocks(blocks);
    setUnscheduled(unscheduled);
  }

  function handleResetDay() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setCalendarRaw("");
    setTasks([]);
    setEvents([]);
    setPlanBlocks([]);
    setUnscheduled([]);
    setQuickTask("");
    setDaySummary("");
    setDayType("workday");
  }

  function handleParseDayClick() {
    // Mainly to give a feeling of "apply" now that tasks are added via Quick capture.
    setPlanBlocks([]);
    setUnscheduled([]);
  }

  async function handleCopyResume() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(resumeText);
        // success: stay silent
      } else {
        throw new Error("Clipboard API not available");
      }
    } catch {
      alert("Could not copy automatically. Please select and copy the text manually.");
    }
  }

  function handleEmailResume() {
    const subject = "Today Desk – Resume of the day";
    const body = resumeText; // uses the existing resumeText useMemo
    const mailto = `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  async function handleSendEmailDraft() {
    const fullText =
      (emailTo.trim() ? `To: ${emailTo.trim()}\n\n` : "") + resumeText;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullText);
        // no popup — user will just paste into their email app
      } else {
        throw new Error("Clipboard API not available");
      }
    } catch {
      alert(
        "Could not copy automatically. Please select and copy the text manually."
      );
    }
  }

  
  const durationOptions = [15, 25, 30, 45, 60, 90, 120];

  const reviewStatusOptions: { value: ReviewStatus; label: string }[] = [
    { value: "none", label: "No status" },
    { value: "done", label: "Done" },
    { value: "delayed", label: "Delayed" },
    { value: "canceled", label: "Canceled" },
    { value: "moved", label: "Moved" },
    { value: "other", label: "Other" },
  ];

  return (
    <main className="min-h-screen bg-emerald-50 text-emerald-950">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Today Desk</h1>
            <p className="text-sm text-emerald-800">
              Paste today&apos;s tasks and calendar, get one clear view of your day.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs sm:text-sm">
            <div className="text-emerald-700">
              No login • No integrations • All in your browser
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-emerald-700">Day type:</span>
                <select
                  className="rounded border border-emerald-200 bg-white px-2 py-1 text-xs"
                  value={dayType}
                  onChange={(e) => setDayType(e.target.value as DayType)}
                >
                  {Object.entries(DAY_TYPE_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {cfg.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">
                Now:{" "}
                {now
                  ? `${now.getHours().toString().padStart(2, "0")}:${now
                      .getMinutes()
                      .toString()
                      .padStart(2, "0")}`
                  : "--:--"}
              </div>
              <button
                type="button"
                onClick={handleResetDay}
                className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-200"
              >
                Reset day
              </button>
            </div>
          </div>
        </header>

        {/* Columns */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,2.2fr)]">
          {/* Column 1: Paste info & Resume */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-emerald-900">
                1. Paste today&apos;s info
              </h2>
              <button
                type="button"
                onClick={handleParseDayClick}
                className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-emerald-600"
              >
                Parse day
              </button>
            </div>

            {/* Quick capture */}
            <div className="rounded-lg bg-emerald-100/70 p-3 shadow-sm">
              <div className="mb-1 text-xs font-medium text-emerald-900">
                Quick capture
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded border border-emerald-200 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-emerald-300"
                  placeholder="Type a task and press Enter…"
                  value={quickTask}
                  onChange={(e) => setQuickTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddQuickTask();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddQuickTask}
                  className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Calendar textarea (moved up) */}
            <div className="rounded-lg bg-emerald-100/70 p-3 shadow-sm">
              <div className="mb-1 text-xs font-medium text-emerald-900">
                Calendar for today (09:30-10:00 Standup, or 15:00 1:1)
              </div>
              <textarea
                className="h-40 w-full resize-none rounded border border-emerald-200 bg-white p-2 text-xs outline-none focus:ring-2 focus:ring-emerald-300"
                placeholder={`Example:\n09:30-10:00 Standup\n11:00-12:00 Deep work\n15:00 1:1 with manager`}
                value={calendarRaw}
                onChange={(e) => setCalendarRaw(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-emerald-700">
                Tip: copy today&apos;s events from your calendar in agenda view and
                paste them here.
              </p>
            </div>

            {/* Resume of the day (replaces old Tasks textarea) */}
            <div className="rounded-lg bg-emerald-100/70 p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-medium text-emerald-900">
                  Resume of the day
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopyResume}
                    className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-900 hover:bg-emerald-200"
                  >
                    Copy resume
                  </button>
                  <button
                    type="button"
                    onClick={handleEmailResume}
                    className="rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600"
                  >
                    Send resume by email
                  </button>
                </div>
              </div>

              {/* Overall notes */}
              <div className="mb-3">
                <label className="mb-1 block text-[11px] font-medium text-emerald-900">
                  Overall notes about today
                </label>
                <textarea
                  className="h-20 w-full resize-none rounded border border-emerald-200 bg-white p-2 text-xs outline-none focus:ring-2 focus:ring-emerald-300"
                  placeholder="How did today really go? Wins, frictions, anything to remember for tomorrow…"
                  value={daySummary}
                  onChange={(e) => setDaySummary(e.target.value)}
                />
              </div>

              {/* Per-task review list */}
              <div>
                <div className="mb-1 text-[11px] font-medium text-emerald-900">
                  Review today&apos;s tasks
                </div>
                {tasks.length === 0 ? (
                  <div className="rounded border border-dashed border-emerald-200 bg-white/60 p-2 text-[11px] text-emerald-700">
                    No tasks yet. Use Quick capture above to add tasks, then come
                    back here to review them.
                  </div>
                ) : (
                  <div className="max-h-44 space-y-1 overflow-auto rounded border border-emerald-200 bg-white/70 p-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded bg-emerald-50/80 p-2 text-[11px]"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="font-medium text-emerald-950">
                            {task.title}
                          </div>
                          <select
                            className="rounded border border-emerald-200 bg-white px-1 py-0.5 text-[11px]"
                            value={task.reviewStatus ?? "none"}
                            onChange={(e) =>
                              handleTaskReviewChange(task.id, {
                                reviewStatus: e.target
                                  .value as ReviewStatus,
                              })
                            }
                          >
                            {reviewStatusOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          className="w-full rounded border border-emerald-200 bg-white px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-emerald-300"
                          placeholder="Optional note for this task (e.g. why delayed, moved to when, etc.)"
                          value={task.reviewNote ?? ""}
                          onChange={(e) =>
                            handleTaskReviewChange(task.id, {
                              reviewNote: e.target.value,
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Email draft */}
              {emailDraftOpen && (
                <div className="mt-3 rounded border border-emerald-200 bg-white/80 p-2 text-[11px] text-emerald-900">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="font-medium">Email draft</div>
                    <button
                      type="button"
                      className="rounded px-1 text-[11px] text-emerald-700 hover:bg-emerald-100"
                      onClick={() => setEmailDraftOpen(false)}
                    >
                      ✕
                    </button>
                  </div>

                  <label className="mb-1 block">
                    <span className="block text-[11px] font-medium text-emerald-900">
                      To (optional)
                    </span>
                    <input
                      type="email"
                      className="mt-0.5 w-full rounded border border-emerald-200 bg-white px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-emerald-300"
                      placeholder="you@example.com"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                    />
                  </label>

                  <label className="mt-2 block">
                    <span className="block text-[11px] font-medium text-emerald-900">
                      Email body
                    </span>
                    <textarea
                      className="mt-0.5 h-24 w-full resize-none rounded border border-emerald-200 bg-white p-2 text-[11px] outline-none focus:ring-1 focus:ring-emerald-300"
                      value={resumeText}
                      readOnly
                    />
                  </label>

                  <div className="mt-2 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSendEmailDraft}
                      className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                    >
                      Send
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyResume}
                      className="rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600"
                    >
                      Copy email text
                    </button>
                  </div>
                  <p className="text-[10px] text-emerald-700">
                    We don&apos;t send emails directly. &quot;Send&quot; copies this draft (with the To line) so you can paste it into any email app and send.
                  </p>
                </div>
                </div>
              )}
            </div>

            </section>

          {/* Column 2: Timeline & free time (unchanged core behaviour) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-emerald-900">
                2. Timeline &amp; free time
              </h2>
            </div>
            <div className="rounded-lg bg-emerald-100/70 p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between text-[11px] text-emerald-800">
                <div>
                  Work day: {minutesToTimeString(workStartMinutes)}–
                  {minutesToTimeString(workEndMinutes)}
                </div>
                <div>
                  Events: {events.length} • Free slots: {freeSlots.length}
                </div>
              </div>
              {/* Timeline */}
              <div className="mb-2 flex gap-2">
                <div className="flex flex-col text-[11px] text-emerald-700">
                  {Array.from(
                    {
                      length:
                        Math.floor((workEndMinutes - workStartMinutes) / 60) + 1,
                    },
                    (_, i) => workStartMinutes + i * 60
                  ).map((m) => (
                    <div key={m} className="h-8">
                      {minutesToTimeString(m)}
                    </div>
                  ))}
                </div>
                <div className="relative flex-1 overflow-hidden rounded border border-emerald-200 bg-white">
                  {/* Free slots */}
                  {freeSlots.map((slot, idx) => {
                    const total = workEndMinutes - workStartMinutes;
                    const top = ((slot.startMinutes - workStartMinutes) / total) * 100;
                    const height =
                      ((slot.endMinutes - slot.startMinutes) / total) * 100;
                    return (
                      <div
                        key={idx}
                        className="absolute left-0 right-0 rounded-sm bg-emerald-50"
                        style={{ top: `${top}%`, height: `${height}%` }}
                      />
                    );
                  })}
                  {/* Events */}
                  {events.map((event, idx) => {
                    const total = workEndMinutes - workStartMinutes;
                    const top =
                      ((event.startMinutes - workStartMinutes) / total) * 100;
                    const height =
                      ((event.endMinutes - event.startMinutes) / total) * 100;
                    return (
                      <div
                        key={idx}
                        className="absolute left-0 right-0 rounded-sm bg-emerald-300/80 px-2 py-1 text-[11px] text-emerald-950"
                        style={{ top: `${top}%`, height: `${height}%` }}
                      >
                        <div className="font-semibold">{event.title}</div>
                        <div className="text-[10px]">
                          {minutesToTimeString(event.startMinutes)}–
                          {minutesToTimeString(event.endMinutes)}
                        </div>
                      </div>
                    );
                  })}
                  {/* Optional "now" indicator */}
                  {nowMinutes !== null &&
                    nowMinutes >= workStartMinutes &&
                    nowMinutes <= workEndMinutes && (
                      <div
                        className="absolute left-0 right-0 border-t border-emerald-500"
                        style={{
                          top: `${
                            ((nowMinutes - workStartMinutes) /
                              (workEndMinutes - workStartMinutes)) *
                            100
                          }%`,
                        }}
                      />
                    )}
                </div>
              </div>

              {/* Free slots list */}
              <div className="mt-2 rounded bg-white/80 p-2 text-[11px]">
                <div className="mb-1 font-medium text-emerald-900">
                  Free slots
                </div>
                {freeSlots.length === 0 ? (
                  <div className="text-emerald-700">
                    No free time between your events.
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {freeSlots.map((slot, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between gap-2"
                      >
                        <span>
                          {minutesToTimeString(slot.startMinutes)}–
                          {minutesToTimeString(slot.endMinutes)}
                        </span>
                        <span className="text-emerald-700">
                          {minutesToLabel(slot.endMinutes - slot.startMinutes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {/* Column 3: Build plan */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-emerald-900">
                3. Build today&apos;s plan
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBuildPlan}
                  className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-emerald-600"
                >
                  Build plan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (planBlocks.length === 0) {
                      alert("No planned blocks yet to copy.");
                      return;
                    }
                    const lines: string[] = [];
                    lines.push("Today Desk – planned blocks");
                    lines.push("");
                    for (const block of planBlocks) {
                      const label = `${minutesToTimeString(
                        block.startMinutes
                      )}-${minutesToTimeString(block.endMinutes)} ${
                        block.taskTitle
                      } [${contextLabel(block.context)}]`;
                      lines.push(label);
                    }
                    const text = lines.join("\n");
                    navigator.clipboard
                      .writeText(text)
                      .then(() => {
                        // success: stay silent
                      })
                      .catch(() => {
                        alert(
                          "Could not copy automatically. Please select and copy manually."
                        );
                      });
                  }}
                  className="rounded-md border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-200"
                >
                  Copy today&apos;s plan
                </button>
              </div>
            </div>

            {/* Capacity / overload */}
            <div className="rounded-lg bg-emerald-100/70 p-3 text-[11px] text-emerald-900 shadow-sm">
              <div className="mb-1 font-medium">
                Capacity: {minutesToLabel(totalFreeMinutes)}.{" "}
                {planBlocks.length === 0
                  ? "No tasks planned yet."
                  : `${minutesToLabel(
                      totalPlannedTaskMinutes
                    )} of that is planned.`}
              </div>
              <div className="text-emerald-800">{overloadMessage}</div>
            </div>

            {/* Top 3 */}
            <div className="rounded-lg bg-emerald-100/70 p-3 text-[11px] shadow-sm">
              <div className="mb-1 flex items-center justify-between">
                <div className="font-medium text-emerald-900">
                  Top 3 for today
                </div>
                <div className="text-[10px] text-emerald-700">
                  Star up to 3 must-do tasks.
                </div>
              </div>
              {topTasks.length === 0 ? (
                <div className="rounded border border-dashed border-emerald-200 bg-white/60 p-2 text-emerald-700">
                  Star 1–3 tasks in the list below to see them here.
                </div>
              ) : (
                <ul className="space-y-1">
                  {topTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between rounded bg-white/80 px-2 py-1"
                    >
                      <span className="text-emerald-950">{task.title}</span>
                      <span className="text-[10px] text-emerald-700">
                        {minutesToLabel(task.durationMinutes)} •{" "}
                        {contextLabel(task.context)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Tasks for today */}
            <div className="rounded-lg bg-emerald-100/70 p-3 text-[11px] shadow-sm">
              <div className="mb-1 flex items-center justify-between">
                <div className="font-medium text-emerald-900">
                  Tasks for today
                </div>
                <div className="text-[10px] text-emerald-700">
                  Starred tasks appear in Top 3 and get reminders.
                </div>
              </div>
              {tasks.length === 0 ? (
                <div className="rounded border border-dashed border-emerald-200 bg-white/60 p-2 text-emerald-700">
                  Add tasks with Quick capture on the left to see them here.
                </div>
              ) : (
                <div className="max-h-52 space-y-1 overflow-auto rounded border border-emerald-200 bg-white/70 p-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="grid grid-cols-[auto_auto_1fr] items-center gap-2 rounded bg-emerald-50/80 px-2 py-1"
                    >
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={task.include}
                          onChange={() => handleToggleTaskInclude(task.id)}
                          className="h-3 w-3 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleTaskImportant(task.id)}
                          className={`text-xs ${
                            task.isImportant
                              ? "text-amber-500"
                              : "text-emerald-400"
                          }`}
                          title="Toggle important"
                        >
                          ★
                        </button>
                      </div>
                      <div className="flex flex-col gap-1">
                        <select
                          className="rounded border border-emerald-200 bg-white px-1 py-0.5 text-[10px]"
                          value={task.context}
                          onChange={(e) =>
                            handleTaskContextChange(
                              task.id,
                              e.target.value as TaskContext
                            )
                          }
                        >
                          <option value="deep">Deep work</option>
                          <option value="admin">Admin</option>
                          <option value="calls">Calls</option>
                          <option value="errands">Errands</option>
                          <option value="other">Other</option>
                        </select>
                        <select
                          className="rounded border border-emerald-200 bg-white px-1 py-0.5 text-[10px]"
                          value={task.durationMinutes}
                          onChange={(e) =>
                            handleTaskDurationChange(
                              task.id,
                              parseInt(e.target.value, 10)
                            )
                          }
                        >
                          {durationOptions.map((m) => (
                            <option key={m} value={m}>
                              {minutesToLabel(m)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="truncate text-emerald-950">
                        {task.title}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Planned blocks */}
            <div className="rounded-lg bg-emerald-100/70 p-3 text-[11px] shadow-sm">
              <div className="mb-1 font-medium text-emerald-900">
                Planned blocks
              </div>
              {planBlocks.length === 0 ? (
                <div className="rounded border border-dashed border-emerald-200 bg-white/60 p-2 text-emerald-700">
                  Click &quot;Build plan&quot; to generate a schedule in your free
                  time slots.
                </div>
              ) : (
                <div className="max-h-60 space-y-1 overflow-auto rounded border border-emerald-200 bg-white/70 p-2">
                  {planBlocks.map((block, idx) => {
                    let statusLabel = "";
                    let statusClass = "text-emerald-700";
                    if (nowMinutes !== null) {
                      if (nowMinutes < block.startMinutes) {
                        const delta = block.startMinutes - nowMinutes;
                        statusLabel = formatCountdown(delta);
                        statusClass = block.isImportant
                          ? "text-emerald-900 font-semibold"
                          : "text-emerald-700";
                      } else if (
                        nowMinutes >= block.startMinutes &&
                        nowMinutes < block.endMinutes
                      ) {
                        statusLabel = "In progress";
                        statusClass = "text-emerald-900 font-semibold";
                      } else {
                        statusLabel = "Done";
                        statusClass = "text-emerald-600";
                      }
                    }

                    return (
                      <div
                        key={idx}
                        className="rounded bg-emerald-50/80 px-2 py-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            {block.isImportant && (
                              <span className="text-[10px] text-amber-500">
                                ★
                              </span>
                            )}
                            <span className="font-medium text-emerald-950">
                              {block.taskTitle}
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-700">
                            {minutesToTimeString(block.startMinutes)}–
                            {minutesToTimeString(block.endMinutes)} •{" "}
                            {minutesToLabel(
                              block.endMinutes - block.startMinutes
                            )}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-[10px]">
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                            {contextLabel(block.context)}
                          </span>
                          {statusLabel && (
                            <span className={statusClass}>{statusLabel}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Unscheduled */}
            {unscheduled.length > 0 && (
              <div className="rounded-lg bg-emerald-100/70 p-3 text-[11px] shadow-sm">
                <div className="mb-1 font-medium text-emerald-900">
                  Unscheduled
                </div>
                <p className="mb-1 text-emerald-800">
                  These tasks didn&apos;t fit into your free time today:
                </p>
                <ul className="list-disc pl-4">
                  {unscheduled.map((task) => (
                    <li key={task.id}>
                      {task.title}{" "}
                      <span className="text-emerald-700">
                        ({minutesToLabel(task.durationMinutes)})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sponsored panel */}
            <div className="rounded-2xl border-2 border-emerald-500 bg-linear-to-r from-emerald-50 to-emerald-100 p-4 text-[11px] text-emerald-900 shadow-md">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Sponsored
                  </span>
                  <span className="text-xs font-semibold">
                    Support Today Desk, keep it free.
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700">
                  Ad space • Google AdSense ready
                </span>
              </div>

              <p className="mb-2 text-[11px] leading-snug text-emerald-800">
                This is a dedicated panel for your ad. When you&apos;re ready,
                replace this text with your{" "}
                <code className="rounded bg-emerald-200 px-1">
                  &lt;ins class=&quot;adsbygoogle&quot;&gt;
                </code>{" "}
                block and AdSense script.
              </p>

              <div className="rounded-lg border border-dashed border-emerald-400 bg-white/80 p-3 text-[11px]">
                <p className="mb-1 font-medium text-emerald-900">
                  Ad placeholder
                </p>
                <div className="flex justify-center">
                  <ins
                    className="adsbygoogle"
                    style={{ display: "block" }}
                    data-ad-client="ca-pub-XXXXXXXXXXXXXXX"
                    data-ad-slot="1234567890"
                    data-ad-format="auto"
                    data-full-width-responsive="true"
                  />
                </div>
                <p className="mt-2 text-[10px] text-emerald-700">
                  When your AdSense account is approved, replace the client and slot IDs above with the values from your AdSense code.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-6 border-t border-emerald-200 pt-3 text-center text-[11px] text-emerald-700">
          Today Desk — a tiny front panel for your day. Starred tasks trigger
          gentle reminders (while this tab is open).
        </footer>
      </div>
    </main>
  );
}