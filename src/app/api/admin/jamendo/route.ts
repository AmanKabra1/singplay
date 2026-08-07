import { and, eq, inArray } from "drizzle-orm";

import { getDb, songs } from "@/db";
import { jsonOk, readJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { getJamendoTrack, jamendoEnabled, searchJamendo } from "@/lib/jamendo";
import { LIMITS, limit } from "@/lib/rate-limit";
import { newId } from "@/lib/utils";
import { jamendoImportSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Browse the Creative Commons catalog and pull tracks into our own library
 * (brief §0 Option A). Tracks already imported are flagged so the admin doesn't
 * have to remember what they've taken.
 */
export const GET = route(async (request) => {
  await requireAdmin();

  if (!jamendoEnabled()) {
    return jsonOk({
      configured: false,
      items: [],
      message:
        "Add JAMENDO_CLIENT_ID to .env.local to browse the Creative Commons catalog.",
    });
  }

  const url = new URL(request.url);
  const results = await searchJamendo({
    query: url.searchParams.get("q") ?? undefined,
    tag: url.searchParams.get("tag") ?? undefined,
    order:
      (url.searchParams.get("order") as "popularity_total" | "releasedate_desc") ??
      "popularity_total",
    limit: Math.min(Number(url.searchParams.get("limit") ?? 24) || 24, 50),
  });

  const existing = results.length
    ? await getDb()
        .select({ externalId: songs.externalId })
        .from(songs)
        .where(
          and(
            eq(songs.source, "jamendo"),
            inArray(
              songs.externalId,
              results.map((track) => track.externalId),
            ),
          ),
        )
    : [];

  const imported = new Set(existing.map((row) => row.externalId));

  return jsonOk({
    configured: true,
    items: results.map((track) => ({ ...track, imported: imported.has(track.externalId) })),
  });
});

export const POST = route(async (request) => {
  limit(request, "write", LIMITS.write);
  const admin = await requireAdmin();
  const body = jamendoImportSchema.parse(await readJson(request));

  const db = getDb();
  const alreadyThere = new Set(
    (
      await db
        .select({ externalId: songs.externalId })
        .from(songs)
        .where(
          and(eq(songs.source, "jamendo"), inArray(songs.externalId, body.externalIds)),
        )
    ).map((row) => row.externalId),
  );

  const results: { externalId: string; status: "imported" | "skipped" | "failed" }[] = [];

  for (const externalId of body.externalIds) {
    if (alreadyThere.has(externalId)) {
      results.push({ externalId, status: "skipped" });
      continue;
    }
    try {
      const track = await getJamendoTrack(externalId);
      if (!track) {
        results.push({ externalId, status: "failed" });
        continue;
      }
      await db.insert(songs).values({
        id: newId(),
        title: track.title,
        artist: track.artist,
        album: track.album,
        genre: track.genre,
        mood: track.mood,
        releaseYear: track.releaseYear,
        decade: track.decade,
        durationSec: track.durationSec,
        coverUrl: track.coverUrl,
        audioUrl: track.audioUrl,
        previewUrl: null,
        source: "jamendo",
        externalId: track.externalId,
        licenseNote: track.licenseNote,
        isPublished: body.publish,
        createdBy: admin.id,
      });
      results.push({ externalId, status: "imported" });
    } catch (error) {
      // One bad track shouldn't abandon the rest of the batch.
      console.error("[jamendo] import failed", externalId, error);
      results.push({ externalId, status: "failed" });
    }
  }

  return jsonOk({
    results,
    imported: results.filter((r) => r.status === "imported").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
  });
});
