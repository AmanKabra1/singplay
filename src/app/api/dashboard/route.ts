import { jsonOk, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/guards";
import {
  continuePracticing,
  getPracticeStats,
  listFavorites,
  listPlaylists,
  practiceTrend,
  recentlyPlayed,
} from "@/lib/server/library";

export const dynamic = "force-dynamic";

/** Everything the dashboard renders, in one request (brief §3.6). */
export const GET = route(async () => {
  const user = await requireUser();
  const viewer = { id: user.id, isAuthenticated: true };

  const [recent, favorites, playlists, practice, stats, trend] = await Promise.all([
    recentlyPlayed(viewer, 12),
    listFavorites(viewer, 12),
    listPlaylists(user.id),
    continuePracticing(viewer, 6),
    getPracticeStats(user.id),
    practiceTrend(user.id),
  ]);

  return jsonOk({
    recent,
    favorites,
    playlists: playlists.slice(0, 6),
    playlistCount: playlists.length,
    practice,
    stats,
    trend,
  });
});
