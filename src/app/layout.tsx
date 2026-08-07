import type { Metadata, Viewport } from "next";

import { PlayerBridge } from "@/components/providers/PlayerBridge";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { OfflineBanner } from "@/components/shell/OfflineBanner";
import { Toaster } from "@/components/ui/Toaster";
import { toSessionUser } from "@/lib/auth/account";
import { optionalUser } from "@/lib/auth/guards";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SingPlay — listen, sing along, mix",
    template: "%s · SingPlay",
  },
  description:
    "A free music player with synced-lyric karaoke practice and a personal DJ booth, built on a Creative Commons catalog.",
  applicationName: "SingPlay",
};

export const viewport: Viewport = {
  themeColor: "#09090f",
  // The player and karaoke stage are laid out for the viewport, not a zoomed
  // page — but zoom stays enabled, because disabling it is an accessibility bug.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Reading the session here means every page — server or client — starts with
  // the same idea of who is signed in, with no auth flash on first paint.
  const user = await optionalUser();

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">
        <SessionProvider user={user ? toSessionUser(user) : null}>
          <PlayerBridge />
          <OfflineBanner />
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
