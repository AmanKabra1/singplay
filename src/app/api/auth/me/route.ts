import { jsonOk, route } from "@/lib/api/http";
import { toSessionUser } from "@/lib/auth/account";
import { optionalUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await optionalUser();
  return jsonOk({ user: user ? toSessionUser(user) : null });
});
