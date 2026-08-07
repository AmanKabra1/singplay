import type { ReactNode } from "react";

import { MiniPlayer } from "@/components/player/MiniPlayer";
import { NowPlaying } from "@/components/player/NowPlaying";
import { PlayerKeyboardShortcuts } from "@/components/player/PlayerControls";
import { QueuePanel } from "@/components/player/QueuePanel";
import { BottomTabs } from "@/components/shell/BottomTabs";
import { Sidebar } from "@/components/shell/Sidebar";
import { SignupPrompt } from "@/components/shell/SignupPrompt";
import { TopBar } from "@/components/shell/TopBar";
import { VerifyEmailBanner } from "@/components/shell/VerifyEmailBanner";

/**
 * The application shell (brief §4.1).
 *
 * One tree at every breakpoint: the sidebar appears at `lg`, the tab bar
 * disappears at the same point, and the main column's bottom padding is driven
 * by the `--player-h` / `--tabbar-h` custom properties so a docked player never
 * hides the last row of a list.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-focusable">
        Skip to content
      </a>

      <Sidebar />

      <div className="lg:pl-64">
        <TopBar />
        <VerifyEmailBanner />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[110rem] px-4 py-5 lg:px-8 lg:py-7"
          style={{
            paddingBottom: "calc(var(--player-h) + var(--tabbar-h) + 2rem)",
          }}
        >
          {children}
        </main>
      </div>

      <MiniPlayer />
      <BottomTabs />
      <NowPlaying />
      <QueuePanel />
      <SignupPrompt />
      <PlayerKeyboardShortcuts />
    </div>
  );
}
