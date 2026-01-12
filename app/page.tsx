"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type ThemeId = 'mint' | 'peach' | 'lavender';

interface Theme {
  id: ThemeId;
  name: string;
  bg: string;
  card: string;
  accent: string;
  accentSoft: string;
}

const THEMES: Theme[] = [
  { id: 'mint', name: 'Mint', bg: '#ECFDF5', card: '#FFFFFF', accent: '#A7F3D0', accentSoft: '#A7F3D0' },
  { id: 'peach', name: 'Peach', bg: '#FFF7ED', card: '#FFFFFF', accent: '#FFAD99', accentSoft: '#FED7AA' },
  { id: 'lavender', name: 'Lavender', bg: '#F8FAFC', card: '#FFFFFF', accent: '#64748B', accentSoft: '#E2E8F0' },
];

const THEME_STORAGE_KEY = 'today-desk-theme';

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
  const [themeId, setThemeId] = useState<ThemeId>('mint');
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

  // Theme effects
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (stored && THEMES.some((t) => t.id === stored)) {
      setThemeId(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
  }, [themeId]);

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

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
    <div
      style={
        {
          '--td-bg': theme.bg,
          '--td-card': theme.card,
          '--td-accent': theme.accent,
          '--td-accent-soft': theme.accentSoft,
        } as React.CSSProperties
      }
      className="min-h-screen bg-(--td-bg)"
    >
      <main className="bg-(--td-bg) text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Today Desk – one clear plan for your day
          </h1>
          <p className="mt-3 text-sm text-slate-700 max-w-2xl mx-auto">
            Today Desk is a simple daily planner that helps you turn your to-do list and calendar
            into one realistic day plan. Paste your tasks and events, see your free time, and
            build a schedule that actually fits – no login, no integrations, all in your browser.
          </p>
        </header>

        {/* Controls */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="text-slate-600">
              No login • No integrations • All in your browser
            </div>
            <div className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
              Now: {" "}
              {now
                ? `${now.getHours().toString().padStart(2, "0")}:${now
                    .getMinutes()
                    .toString()
                    .padStart(2, "0")}`
                : "--:--"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-slate-600">Day type:</span>
              <select
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
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
            <button
              type="button"
              onClick={handleResetDay}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Reset day
            </button>
          </div>
        </div>

        {/* Columns */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,2.2fr)]">
          {/* Column 1: Paste info & Resume */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">
                1. Paste today&apos;s info
              </h2>
              <button
                type="button"
                onClick={handleParseDayClick}
                className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Parse day
              </button>
            </div>

            {/* Quick capture */}
            <div className="rounded-lg bg-(--td-card) p-3 shadow-sm">
              <div className="mb-1 text-xs font-medium text-slate-800">
                Quick capture
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-slate-300"
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
                  className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Calendar textarea (moved up) */}
            <div className="rounded-lg bg-(--td-card) p-3 shadow-sm">
              <div className="mb-1 text-xs font-medium text-slate-800">
                Calendar for today (09:30-10:00 Standup, or 15:00 1:1)
              </div>
              <textarea
                className="h-40 w-full resize-none rounded border border-slate-200 bg-white p-2 text-xs outline-none focus:ring-2 focus:ring-slate-300"
                placeholder={`Example:\n09:30-10:00 Standup\n11:00-12:00 Deep work\n15:00 1:1 with manager`}
                value={calendarRaw}
                onChange={(e) => setCalendarRaw(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-slate-600">
                Tip: copy today&apos;s events from your calendar in agenda view and
                paste them here.
              </p>
            </div>

            {/* Resume of the day (replaces old Tasks textarea) */}
            <div className="rounded-lg bg-(--td-card) p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-medium text-slate-800">
                  Resume of the day
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopyResume}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Copy resume
                  </button>
                  <button
                    type="button"
                    onClick={handleEmailResume}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Send resume by email
                  </button>
                </div>
              </div>

              {/* Overall notes */}
              <div className="mb-3">
                <label className="mb-1 block text-[11px] font-medium text-slate-800">
                  Overall notes about today
                </label>
                <textarea
                  className="h-20 w-full resize-none rounded border border-slate-200 bg-white p-2 text-xs outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="How did today really go? Wins, frictions, anything to remember for tomorrow…"
                  value={daySummary}
                  onChange={(e) => setDaySummary(e.target.value)}
                />
              </div>

              {/* Per-task review list */}
              <div>
                <div className="mb-1 text-[11px] font-medium text-slate-800">
                  Review today&apos;s tasks
                </div>
                {tasks.length === 0 ? (
                  <div className="rounded border border-dashed border-slate-200 bg-white/60 p-2 text-[11px] text-slate-600">
                    No tasks yet. Use Quick capture above to add tasks, then come
                    back here to review them.
                  </div>
                ) : (
                  <div className="max-h-44 space-y-1 overflow-auto rounded border border-slate-200 bg-white/70 p-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded border border-slate-200 bg-white p-2 text-[11px]"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="font-medium text-slate-900">
                            {task.title}
                          </div>
                          <select
                            className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px]"
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
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-slate-300"
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
                <div className="mt-3 rounded border border-slate-200 bg-white/80 p-2 text-[11px] text-slate-700">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="font-medium">Email draft</div>
                    <button
                      type="button"
                      className="rounded px-1 text-[11px] text-slate-600 hover:bg-slate-50 transition"
                      onClick={() => setEmailDraftOpen(false)}
                    >
                      ✕
                    </button>
                  </div>

                  <label className="mb-1 block">
                    <span className="block text-[11px] font-medium text-slate-800">
                      To (optional)
                    </span>
                    <input
                      type="email"
                      className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-slate-300"
                      placeholder="you@example.com"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                    />
                  </label>

                  <label className="mt-2 block">
                    <span className="block text-[11px] font-medium text-slate-800">
                      Email body
                    </span>
                    <textarea
                      className="mt-0.5 h-24 w-full resize-none rounded border border-slate-200 bg-white p-2 text-[11px] outline-none focus:ring-1 focus:ring-slate-300"
                      value={resumeText}
                      readOnly
                    />
                  </label>

                  <div className="mt-2 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSendEmailDraft}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Send
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyResume}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Copy email text
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600">
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
              <h2 className="text-sm font-semibold text-slate-800">
                2. Timeline &amp; free time
              </h2>
            </div>
            <div className="rounded-lg bg-(--td-card) p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between text-[11px] text-slate-700">
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
                <div className="flex flex-col text-[11px] text-slate-600">
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
                <div className="relative flex-1 overflow-hidden rounded border border-slate-200 bg-white">
                  {/* Free slots */}
                  {freeSlots.map((slot, idx) => {
                    const total = workEndMinutes - workStartMinutes;
                    const top = ((slot.startMinutes - workStartMinutes) / total) * 100;
                    const height =
                      ((slot.endMinutes - slot.startMinutes) / total) * 100;
                    return (
                      <div
                        key={idx}
                        className="absolute left-0 right-0 rounded-sm bg-slate-50"
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
                        className="absolute left-0 right-0 rounded-sm bg-slate-200/80 px-2 py-1 text-[11px] text-slate-900"
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
                <div className="mb-1 font-medium text-slate-800">
                  Free slots
                </div>
                {freeSlots.length === 0 ? (
                  <div className="text-slate-600">
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
                        <span className="text-slate-600">
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
              <h2 className="text-sm font-semibold text-slate-800">
                3. Build today&apos;s plan
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBuildPlan}
                  className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
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
                  className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Copy today&apos;s plan
                </button>
              </div>
            </div>

            {/* Capacity / overload */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-700 shadow-sm">
              <div className="mb-1 font-medium">
                Capacity: {minutesToLabel(totalFreeMinutes)}.{" "}
                {planBlocks.length === 0
                  ? "No tasks planned yet."
                  : `${minutesToLabel(
                      totalPlannedTaskMinutes
                    )} of that is planned.`}
              </div>
              <div className="text-slate-700">{overloadMessage}</div>
            </div>

            {/* Top 3 */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] shadow-sm">
              <div className="mb-1 flex items-center justify-between">
                <div className="font-medium text-slate-800">
                  Top 3 for today
                </div>
                <div className="text-[10px] text-slate-600">
                  Star up to 3 must-do tasks.
                </div>
              </div>
              {topTasks.length === 0 ? (
                <div className="rounded border border-dashed border-slate-200 bg-white/60 p-2 text-slate-600">
                  Star 1–3 tasks in the list below to see them here.
                </div>
              ) : (
                <ul className="space-y-1">
                  {topTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between rounded bg-white/80 px-2 py-1"
                    >
                      <span className="text-slate-900">{task.title}</span>
                      <span className="text-[10px] text-slate-600">
                        {minutesToLabel(task.durationMinutes)} •{" "}
                        {contextLabel(task.context)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Tasks for today */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] shadow-sm">
              <div className="mb-1 flex items-center justify-between">
                <div className="font-medium text-slate-800">
                  Tasks for today
                </div>
                <div className="text-[10px] text-slate-600">
                  Starred tasks appear in Top 3 and get reminders.
                </div>
              </div>
              {tasks.length === 0 ? (
                <div className="rounded border border-dashed border-slate-200 bg-white/60 p-2 text-slate-600">
                  Add tasks with Quick capture on the left to see them here.
                </div>
              ) : (
                <div className="max-h-52 space-y-1 overflow-auto rounded border border-slate-200 bg-white/70 p-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="grid grid-cols-[auto_auto_1fr] items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1"
                    >
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={task.include}
                          onChange={() => handleToggleTaskInclude(task.id)}
                          className="h-3 w-3 rounded border-slate-300 text-slate-600 focus:ring-slate-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleTaskImportant(task.id)}
                          className={`text-xs ${
                            task.isImportant
                              ? "text-amber-500"
                              : "text-slate-400"
                          }`}
                          title="Toggle important"
                        >
                          ★
                        </button>
                      </div>
                      <div className="flex flex-col gap-1">
                        <select
                          className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px]"
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
                          className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px]"
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
                      <div className="truncate text-slate-900">
                        {task.title}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Planned blocks */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] shadow-sm">
              <div className="mb-1 font-medium text-slate-800">
                Planned blocks
              </div>
              {planBlocks.length === 0 ? (
                <div className="rounded border border-dashed border-slate-200 bg-white/60 p-2 text-slate-600">
                  Click &quot;Build plan&quot; to generate a schedule in your free
                  time slots.
                </div>
              ) : (
                <div className="max-h-60 space-y-1 overflow-auto rounded border border-slate-200 bg-white/70 p-2">
                  {planBlocks.map((block, idx) => {
                    let statusLabel = "";
                    let statusClass = "text-slate-600";
                    if (nowMinutes !== null) {
                      if (nowMinutes < block.startMinutes) {
                        const delta = block.startMinutes - nowMinutes;
                        statusLabel = formatCountdown(delta);
                        statusClass = block.isImportant
                          ? "text-slate-800 font-semibold"
                          : "text-slate-600";
                      } else if (
                        nowMinutes >= block.startMinutes &&
                        nowMinutes < block.endMinutes
                      ) {
                        statusLabel = "In progress";
                        statusClass = "text-slate-800 font-semibold";
                      } else {
                        statusLabel = "Done";
                        statusClass = "text-slate-600";
                      }
                    }

                    return (
                      <div
                        key={idx}
                        className="rounded border border-slate-200 bg-white px-2 py-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            {block.isImportant && (
                              <span className="text-[10px] text-amber-500">
                                ★
                              </span>
                            )}
                            <span className="font-medium text-slate-900">
                              {block.taskTitle}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-600">
                            {minutesToTimeString(block.startMinutes)}–
                            {minutesToTimeString(block.endMinutes)} •{" "}
                            {minutesToLabel(
                              block.endMinutes - block.startMinutes
                            )}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-[10px]">
                          <span className="rounded-full bg-(--td-accent-soft) px-2 py-0.5 text-slate-700">
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
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] shadow-sm">
                <div className="mb-1 font-medium text-slate-800">
                  Unscheduled
                </div>
                <p className="mb-1 text-slate-600">
                  These tasks didn&apos;t fit into your free time today:
                </p>
                <ul className="list-disc pl-4">
                  {unscheduled.map((task) => (
                    <li key={task.id}>
                      {task.title}{" "}
                      <span className="text-slate-600">
                        ({minutesToLabel(task.durationMinutes)})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sponsored panel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[11px] text-slate-700 shadow-md">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Sponsored
                  </span>
                  <span className="text-xs font-semibold">
                    Support Today Desk, keep it free.
                  </span>
                </div>
                <span className="text-[10px] text-slate-600">
                  Ad space • Google AdSense ready
                </span>
              </div>

              <p className="mb-2 text-[11px] leading-snug text-slate-700">
                This is a dedicated panel for your ad. When you&apos;re ready,
                replace this text with your{" "}
                <code className="rounded border border-slate-200 bg-slate-50 px-1">
                  &lt;ins class=&quot;adsbygoogle&quot;&gt;
                </code>{" "}
                block and AdSense script.
              </p>

              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-[11px]">
                <p className="mb-1 font-medium text-slate-800">
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
                <p className="mt-2 text-[10px] text-slate-600">
                  When your AdSense account is approved, replace the client and slot IDs above with the values from your AdSense code.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* SEO Content */}
        <section className="mt-12 border-t border-emerald-100 pt-8">
          <h2 className="text-lg font-semibold text-emerald-900 mb-4">
            How Today Desk works
          </h2>

          <ol className="list-decimal list-inside space-y-3 text-sm text-emerald-900 max-w-2xl">
            <li>
              <span className="font-semibold">Paste today's tasks and calendar.</span>{" "}
              Copy your meetings and to-dos into the planner – either by typing, or
              pasting from your calendar's agenda view.
            </li>
            <li>
              <span className="font-semibold">See your real free time.</span>{" "}
              Today Desk builds a simple timeline of your workday and shows your free
              slots, so you can quickly see how much time you actually have.
            </li>
            <li>
              <span className="font-semibold">Build a realistic plan.</span>{" "}
              Move tasks into the planner panel and star up to 3 must-do items for
              today. You end up with a plan that fits your capacity, not a wish list.
            </li>
            <li>
              <span className="font-semibold">Keep everything in one browser tab.</span>{" "}
              Your notes and tasks stay in your browser's local storage. There's no
              login and no account to remember – it's just a tiny front panel for your
              day.
            </li>
          </ol>
        </section>

        <section className="mt-10 grid gap-8 md:grid-cols-2 border-t border-emerald-100 pt-8">
          <div>
            <h2 className="text-lg font-semibold text-emerald-900 mb-4">FAQ</h2>

            <div className="space-y-4 text-sm text-emerald-900">
              <div>
                <h3 className="font-semibold">
                  Do I need an account to use Today Desk?
                </h3>
                <p>
                  No. There is no login and no signup. Everything happens in your
                  browser.
                </p>
              </div>

              <div>
                <h3 className="font-semibold">Is my data stored on a server?</h3>
                <p>
                  Tasks and notes you enter into Today Desk are saved in your browser's{" "}
                  <span className="font-semibold">local storage</span>. They are not
                  automatically sent to our servers.
                </p>
              </div>

              <div>
                <h3 className="font-semibold">
                  How is this different from a normal to-do list?
                </h3>
                <p>
                  Most to-do lists grow forever. Today Desk helps you plan only{" "}
                  <span className="font-semibold">one day at a time</span> by combining
                  your tasks and calendar into a schedule you can actually follow.
                </p>
              </div>

              <div>
                <h3 className="font-semibold">Is Today Desk free to use?</h3>
                <p>
                  Yes. Today Desk is a small, free planner focused on realistic daily
                  planning. In the future there may be optional features, but the core
                  planner is free.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-6 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-600">
          <div className="mb-2">
            <Link href="/" className="underline hover:text-slate-800">Home</Link>
            {" · "}
            <Link href="/about" className="underline hover:text-slate-800">About</Link>
            {" · "}
            <Link href="/how-it-works" className="underline hover:text-slate-800">How it works</Link>
            {" · "}
            <Link href="/privacy" className="underline hover:text-slate-800">Privacy</Link>
          </div>
          <div>
            Today Desk — a tiny front panel for your day. Starred tasks trigger
            gentle reminders (while this tab is open).
          </div>
        </footer>
      </div>
    </main>
    
    <ThemeSwitcher
      themes={THEMES}
      current={themeId}
      onChange={setThemeId}
    />
    </div>
  );
}

interface ThemeSwitcherProps {
  themes: Theme[];
  current: ThemeId;
  onChange: (id: ThemeId) => void;
}

function ThemeSwitcher({ themes, current, onChange }: ThemeSwitcherProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
        title="Change color theme"
      >
        <div className="relative h-6 w-6 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-tr from-emerald-400 via-orange-400 to-purple-500" />
        </div>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-lg p-3 w-44">
          <div className="text-xs font-medium text-slate-500 mb-2">
            Theme
          </div>
          <div className="flex flex-col gap-2">
            {themes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  onChange(theme.id);
                  setOpen(false);
                }}
                className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50 transition ${
                  current === theme.id ? 'border border-slate-300' : ''
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded-full border border-slate-200"
                    style={{ background: theme.accent }}
                  />
                  <span className="text-slate-700">{theme.name}</span>
                </span>
                {current === theme.id && (
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}