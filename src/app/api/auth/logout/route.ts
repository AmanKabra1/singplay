import { jsonOk, route } from "@/lib/api/http";
import { clearSessionCookie } from "@/lib/auth/session";

export const POST = route(async () => {
  await clearSessionCookie();
  return jsonOk({ ok: true });
});
