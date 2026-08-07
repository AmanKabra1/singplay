"use client";

import { usePathname } from "next/navigation";

import { ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useUiStore, type SignupReason } from "@/store/ui";

const COPY: Record<Exclude<SignupReason, null>, { title: string; body: string }> = {
  playback: {
    title: "That's the end of the preview",
    body: "Guests get a 30-second taste of each track. Create a free account to listen all the way through — and to keep your place across devices.",
  },
  karaoke: {
    title: "Sing-along mode needs an account",
    body: "Karaoke tracks your practice streak and remembers where you stopped in every song, so it needs somewhere to save that.",
  },
  dj: {
    title: "The DJ decks need an account",
    body: "Your decks, cue points and mixes are personal to you. Sign up free and the booth is yours.",
  },
  playlist: {
    title: "Save this to a playlist",
    body: "Create a free account to build playlists, reorder them, and pick them up on any device.",
  },
  favorite: {
    title: "Save your favourites",
    body: "Create a free account to keep a library of the tracks you love.",
  },
};

/**
 * Shown when a guest hits a gated feature, instead of silently doing nothing
 * (brief §2.1). Carries the current page as `next` so sign-up returns here.
 */
export function SignupPrompt() {
  const reason = useUiStore((s) => s.signupReason);
  const close = useUiStore((s) => s.closeSignupPrompt);
  const pathname = usePathname();

  const copy = reason ? COPY[reason] : null;
  const next = encodeURIComponent(pathname || "/");

  return (
    <Modal
      open={Boolean(copy)}
      onClose={close}
      title={copy?.title ?? ""}
      size="sm"
      footer={
        <>
          <ButtonLink href={`/login?next=${next}`} variant="secondary" onClick={close}>
            I already have an account
          </ButtonLink>
          <ButtonLink href={`/signup?next=${next}`} onClick={close}>
            Sign up free
          </ButtonLink>
        </>
      }
    >
      <p className="text-fluid-sm leading-relaxed text-muted">{copy?.body}</p>
    </Modal>
  );
}
