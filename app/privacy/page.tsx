import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-emerald-50 px-4 py-8 text-sm text-emerald-900">
      <div className="mx-auto max-w-2xl rounded-xl border border-emerald-200 bg-white/80 p-4 shadow-sm">
        <h1 className="mb-3 text-lg font-semibold text-emerald-950">
          Privacy & Cookies – Today Desk
        </h1>
        <p className="mb-2">
          Today Desk is a simple planning tool. We don&apos;t ask you to create
          an account and we don&apos;t store your data on our servers.
        </p>
        <p className="mb-2">
          The tasks and notes you enter stay in your browser&apos;s local
          storage so they are available only on this device.
        </p>
        <p className="mb-2">
          We use Google AdSense to show ads. AdSense may use cookies and similar
          technologies to show you more relevant ads and to measure performance.
          You can manage your ad settings in your Google account.
        </p>
        <p className="mb-2">
          If you have questions about this page, you can contact me using the
          details on my GitHub profile.
        </p>
        <p className="mt-4 text-xs text-emerald-700">
          Back to{" "}
          <Link href="/" className="underline">
            Today Desk
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
