import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Today Desk – One clear plan for your day",
  description:
    "Today Desk is a free online day planner. Paste today's tasks and calendar, see your free time, and build a realistic plan – no login, no integrations.",
  keywords: [
    "daily planner",
    "online day planner",
    "plan my day",
    "realistic day planning",
    "calendar and tasks planner",
    "productivity",
  ],
  metadataBase: new URL("https://today-desk.vercel.app"),
  openGraph: {
    title: "Today Desk – One clear plan for your day",
    description:
      "Free online day planner that turns your messy to-do list and calendar into one realistic plan. No login. No integrations. All in your browser.",
    url: "https://today-desk.vercel.app",
    siteName: "Today Desk",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Today Desk – One clear plan for your day",
    description:
      "Paste your tasks and calendar, see your free time, and build a realistic plan in minutes.",
  },
  other: {
    "google-adsense-account": "ca-pub-6846589122417205",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          id="adsense-script"
          async
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6846589122417205"
          crossOrigin="anonymous"
        />
        <Script
          id="ga4-loader"
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-H0WCC2CFCM"
        />
        <Script id="ga4-config" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-H0WCC2CFCM', {
              page_path: window.location.pathname,
            });
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
