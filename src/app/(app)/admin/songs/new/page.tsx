import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { emptySong, SongForm } from "@/components/admin/SongForm";

export const metadata: Metadata = {
  title: "Add a track",
  robots: { index: false },
};

export default function NewSongPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div>
        <Link
          href="/admin/songs"
          className="inline-flex items-center gap-1.5 text-fluid-sm text-muted transition-colors hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to songs
        </Link>
        <h1 className="mt-2 text-fluid-xl font-bold">Add a track</h1>
        <p className="text-fluid-sm text-muted">
          Save the track first, then add its lyrics — the lyrics editor needs an
          ID to attach them to.
        </p>
      </div>

      <SongForm initial={emptySong} />
    </div>
  );
}
