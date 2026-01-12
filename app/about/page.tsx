import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About – Today Desk",
  description:
    "Learn why Today Desk was created, how it works, and how this simple daily planner stays private and calm.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-(--td-bg) px-4 py-8 text-sm text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <h1 className="mb-4 text-2xl font-semibold text-slate-900">
            Today Desk – a calm daily planner in your browser
          </h1>

          <p className="mb-6 text-slate-700 leading-relaxed">
            Today Desk is a simple daily planner that helps you turn a noisy to-do list into one realistic day.
          </p>

          <p className="mb-8 text-slate-700 leading-relaxed">
            There's no login, no integrations and no account to manage. You paste today's tasks and calendar, see your free time, and build a plan that actually fits – all in your browser.
          </p>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Why I created Today Desk
            </h2>
            <ul className="space-y-2 text-slate-700">
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span><strong>Fast</strong> – open, paste, plan, done.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span><strong>Calm</strong> – no dashboards, badges or notifications competing for attention.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span><strong>Private</strong> – your tasks stay on your device, not on my servers.</span>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              What Today Desk does
            </h2>
            <ul className="space-y-2 text-slate-700">
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span>Combines tasks and calendar into one simple view.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span>Shows your free time blocks so you see what actually fits today.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span>Lets you build a realistic schedule with a single click.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span>Helps you gently review your day so tomorrow can be a little clearer.</span>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              What Today Desk doesn't do
            </h2>
            <ul className="space-y-2 text-slate-700">
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span>No accounts, passwords or logins.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span>No long-term project management or team features.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span>No complex automation or integrations to set up.</span>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Privacy first
            </h2>
            <p className="mb-4 text-slate-700 leading-relaxed">
              Your tasks and notes are stored only in your browser's local storage. Today Desk does not store user data on a backend database. Google Analytics and Google AdSense may be used in a limited way for basic analytics and to support the free service.
            </p>
            <p className="text-slate-700 leading-relaxed">
              You can read the full details on the <Link href="/privacy" className="underline text-slate-600 hover:text-slate-800">Privacy & Cookies page</Link>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              How Today Desk is supported
            </h2>
            <p className="mb-4 text-slate-700 leading-relaxed">
              Today Desk is free and will show a small, non-intrusive ad in the Sponsored panel on the main page. There are no popups or full-screen ads.
            </p>
            <p className="mb-4 text-slate-700 leading-relaxed">
              Two simple ways to support Today Desk:
            </p>
            <ul className="space-y-2 text-slate-700">
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span>Share the tool with a friend or colleague.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-500">•</span>
                <span>Come back and use it whenever you need a clear view of your day.</span>
              </li>
            </ul>
          </section>

          <div className="mt-8 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-600">
              Back to{" "}
              <Link href="/" className="underline hover:text-slate-800">
                Today Desk
              </Link>
              {" • "}
              <Link href="/how-it-works" className="underline hover:text-slate-800">
                How it works
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
