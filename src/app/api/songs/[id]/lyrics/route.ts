import { jsonOk, route } from "@/lib/api/http";
import { getLyrics, requireSong } from "@/lib/server/songs";
import { currentViewer } from "@/lib/server/viewer";

export const dynamic = "force-dynamic";

export const GET = route<{ params: Promise<{ id: string }> }>(
  async (_request, { params }) => {
    const { id } = await params;
    const { viewer } = await currentViewer();

    // 404 on an unknown song rather than quietly returning empty lyrics, so the
    // karaoke screen can tell "no such track" from "no sync data yet".
    await requireSong(id, viewer);
    return jsonOk(await getLyrics(id));
  },
);
