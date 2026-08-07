import { jsonOk, route } from "@/lib/api/http";
import { requireSong } from "@/lib/server/songs";
import { currentViewer } from "@/lib/server/viewer";

export const dynamic = "force-dynamic";

export const GET = route<{ params: Promise<{ id: string }> }>(
  async (_request, { params }) => {
    const { id } = await params;
    const { viewer } = await currentViewer();
    return jsonOk({ song: await requireSong(id, viewer) });
  },
);
