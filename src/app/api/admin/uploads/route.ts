import { jsonOk, readJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { LIMITS, limit } from "@/lib/rate-limit";
import { createUploadTarget } from "@/lib/storage";
import { uploadTargetSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Hands the browser a URL to PUT the file to.
 *
 * With R2 configured that's a presigned URL straight to the bucket, which is
 * what makes >4.5 MB audio uploads possible at all on serverless hosting. Without
 * it, the same call returns a local endpoint that accepts the identical PUT.
 */
export const POST = route(async (request) => {
  limit(request, "write", LIMITS.write);
  await requireAdmin();

  const body = uploadTargetSchema.parse(await readJson(request));
  const target = await createUploadTarget(
    body.kind,
    body.fileName,
    body.contentType,
    body.size,
  );

  return jsonOk(target);
});
