import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How Today Desk works – Today Desk",
  description:
    "Step-by-step guide to using Today Desk: paste tasks and calendar, see your free time, and build a realistic daily plan.",
};

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-(--td-bg) px-4 py-8 text-sm text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <h1 className="mb-4 text-2xl font-semibold text-slate-900">
            How Today Desk works – 3 steps to a realistic day
          </h1>

          <p className="mb-8 text-slate-700 leading-relaxed">
            Today Desk helps you plan your day in three simple steps: paste today's info, see your timeline & free time, and build today's plan. Each step is designed to give you a clear, realistic view of what you can actually accomplish today.
          </p>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              1. Paste today's info
            </h2>
            <div className="space-y-4 text-slate-700">
              <p>
                <strong>Quick capture</strong> – Type tasks as they come to mind. Each task gets a duration and context (deep work, admin, calls, errands, or other). You can star important tasks to prioritize them.
              </p>
              <p>
                <strong>Calendar for today</strong> – Copy events from your calendar and paste them here. There's no direct integration – you manually copy events like "09:30-10:00 Standup" or "15:00 1:1 with manager" from your calendar's agenda view.
              </p>
              <p>
                <strong>Notes & review</strong> – At the end of the day, add brief notes about how things went and review your tasks. This helps you notice patterns and improve tomorrow's planning.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              2. Timeline & free time
            </h2>
            <div className="space-y-4 text-slate-700">
              <p>
                <strong>Work day setup</strong> – Set your work hours (default 09:00-17:00) and choose your day type (workday, admin, creative, or light) to adjust your energy and focus expectations.
              </p>
              <p>
                <strong>Parse day</strong> – Click this button to process your calendar events and tasks. Today Desk shows your workday timeline with events blocked out and highlights your free time slots.
              </p>
              <p>
                <strong>Free slots</strong> – The middle column shows exactly when you have gaps between events. This helps you see what's realistically possible today, not just what you wish you could do.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              3. Build today's plan
            </h2>
            <div className="space-y-4 text-slate-700">
              <p>
                <strong>Top 3 tasks</strong> – Star up to 3 important tasks. These appear in the Top 3 section and get gentle reminders while you have Today Desk open.
              </p>
              <p>
                <strong>Build plan</strong> – Click this button and Today Desk automatically schedules your tasks into your free time slots, creating a realistic outline for your day.
              </p>
              <p>
                <strong>Copy today's plan</strong> – Once built, copy your plan to use wherever you need it – in your calendar, notes app, or to share with others.
              </p>
              <p>
                The goal is a kind, realistic outline rather than a perfect schedule. Today Desk helps you see what fits, not force everything into an impossible timeline.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Tips for using Today Desk
            </h2>
            <ul className="space-y-2 text-slate-700">
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span><strong>Keep it light</strong> – paste, glance, adjust. Don't overthink it.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span><strong>Use it once per day</strong> – in the morning or before focused work sessions.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span><strong>Review briefly</strong> – at the end of the day, notice what worked and what didn't.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span><strong>Be realistic</strong> – if you consistently can't finish everything, consider reducing your task list or adjusting expectations.</span>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Today Desk vs. other tools
            </h2>
            <p className="text-slate-700 leading-relaxed">
              Today Desk is not meant to replace your main calendar or project management tool. Instead, it provides a calm, one-day view that helps you see what's actually possible today. Use it alongside your existing tools to get a clearer perspective on your immediate priorities and time constraints.
            </p>
          </section>

          <div className="mt-8 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-600">
              Back to{" "}
              <Link href="/" className="underline hover:text-slate-800">
                Today Desk
              </Link>
              {" • "}
              <Link href="/about" className="underline hover:text-slate-800">
                About
              </Link>
              {" • "}
              <Link href="/privacy" className="underline hover:text-slate-800">
                Privacy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
