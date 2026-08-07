import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchScreen } from "@/components/search/SearchScreen";
import { SongListSkeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the SingPlay catalog by title, artist, album or lyric snippet.",
};

/**
 * `SearchScreen` reads the query string with `useSearchParams`, which needs a
 * Suspense boundary above it so the shell can still be prerendered.
 */
export default function SearchPage() {
  return (
    <Suspense fallback={<SongListSkeleton count={10} />}>
      <SearchScreen />
    </Suspense>
  );
}
