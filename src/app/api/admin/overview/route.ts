import { jsonOk, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { adminOverview } from "@/lib/server/analytics";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  return jsonOk(await adminOverview());
});
