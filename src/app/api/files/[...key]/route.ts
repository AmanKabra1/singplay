import { route } from "@/lib/api/http";
import { contentTypeFromKey, readLocalFile } from "@/lib/storage";

type Ctx = { params: Promise<{ key: string[] }> };

/**
 * Serves files written by the local-development storage fallback.
 *
 * Range requests are honoured because `<audio>` relies on them for seeking —
 * without a 206 response the browser can only ever play a track from the start.
 */
export const GET = route<Ctx>(async (request, { params }) => {
  const { key } = await params;
  const path = key.join("/");

  const file = await readLocalFile(path);
  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = contentTypeFromKey(path);
  const total = file.byteLength;
  const body = new Uint8Array(file);
  const range = request.headers.get("range");

  const headers: Record<string, string> = {
    "content-type": contentType,
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=31536000, immutable",
  };

  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (match) {
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;

    if (Number.isNaN(start) || start > end || start >= total) {
      return new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${total}` },
      });
    }

    const slice = body.subarray(start, end + 1);
    return new Response(slice, {
      status: 206,
      headers: {
        ...headers,
        "content-range": `bytes ${start}-${end}/${total}`,
        "content-length": String(slice.byteLength),
      },
    });
  }

  return new Response(body, {
    status: 200,
    headers: { ...headers, "content-length": String(total) },
  });
});

export const HEAD = route<Ctx>(async (_request, { params }) => {
  const { key } = await params;
  const file = await readLocalFile(key.join("/"));
  if (!file) return new Response(null, { status: 404 });

  return new Response(null, {
    status: 200,
    headers: {
      "content-type": contentTypeFromKey(key.join("/")),
      "content-length": String(file.byteLength),
      "accept-ranges": "bytes",
    },
  });
});
