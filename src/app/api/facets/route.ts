import { jsonOk, route } from "@/lib/api/http";
import { catalogFacets } from "@/lib/server/songs";

export const dynamic = "force-dynamic";

/** Browse filters, derived from what's actually in the catalog. */
export const GET = route(async () => jsonOk(await catalogFacets()));
