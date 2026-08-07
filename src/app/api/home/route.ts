import { jsonOk, route } from "@/lib/api/http";
import { recentlyPlayed } from "@/lib/server/library";
import { browseSections } from "@/lib/server/songs";
import { currentViewer } from "@/lib/server/viewer";
import type { BrowseSection } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const { user, viewer } = await currentViewer();

  const [sections, recent] = await Promise.all([
    browseSections(viewer),
    user ? recentlyPlayed({ id: user.id, isAuthenticated: true }, 12) : Promise.resolve([]),
  ]);

  // "Jump back in" only makes sense once there's history, and it belongs at the
  // top when there is.
  const shelves: BrowseSection[] =
    recent.length > 0
      ? [{ key: "recent", title: "Jump back in", songs: recent }, ...sections]
      : sections;

  return jsonOk({ sections: shelves });
});
