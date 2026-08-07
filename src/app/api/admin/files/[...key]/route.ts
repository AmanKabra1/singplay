import { ApiError, jsonOk, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { validateUpload, writeLocalFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ key: string[] }> };

/**
 * Local-development upload sink, used only when R2 isn't configured. Production
 * uploads bypass this route entirely and go browser → R2 via a presigned URL.
 */
export const PUT = route<Ctx>(async (request, { params }) => {
  await requireAdmin();

  const { key } = await params;
  const path = key.join("/");
  const kind = path.startsWith("audio/") ? "audio" : "cover";
  const contentType = request.headers.get("content-type") ?? "application/octet-stream";

  const maxBytes = validateUpload(kind, contentType);

  const buffer = new Uint8Array(await request.arrayBuffer());
  if (buffer.byteLength > maxBytes) {
    throw ApiError.badRequest(
      `That file is too large. Maximum is ${Math.round(maxBytes / 1024 / 1024)} MB.`,
    );
  }

  await writeLocalFile(path, buffer);
  return jsonOk({ ok: true, key: path, publicUrl: `/api/files/${path}` });
});
