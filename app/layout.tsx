import type { Metadata, Viewport } from "next";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/fraunces";
import "./globals.css";

import { ToastProvider } from "@/components/ui/toast";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { getCurrentUser } from "@/lib/auth";
import { listNotifications, unreadNotificationCount } from "@/lib/queries";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "iwannalearn — learn the exact thing you're stuck on",
    template: "%s · iwannalearn",
  },
  description:
    "Ask for the one skill you need in plain words. Get a short, specific video built for your situation — or find one that's already answered.",
  openGraph: {
    title: "iwannalearn",
    description:
      "Request-driven learning: tell us what you want to learn, we make the video that fits your exact situation.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#fbf7ef",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const notifications = user ? listNotifications(user.id, 8) : [];
  const unread = user ? unreadNotificationCount(user.id) : 0;

  return (
    <html lang="en">
      <body className="min-h-dvh">
        <ToastProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
          >
            Skip to content
          </a>
          <SiteHeader user={user} notifications={notifications} unread={unread} />
          <main id="main" className="pb-20 md:pb-0">
            {children}
          </main>
          <SiteFooter />
          <MobileTabBar signedIn={Boolean(user)} />
        </ToastProvider>
      </body>
    </html>
  );
}
