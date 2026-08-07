import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ApiError } from "@/lib/api/http";
import { env } from "@/lib/env";

/**
 * Object storage for admin-uploaded audio and cover art.
 *
 * Production uses Cloudflare R2 with **presigned PUT URLs**, so the file goes
 * browser -> R2 directly. That matters: Vercel caps a serverless request body
 * at 4.5 MB, which most audio files exceed, so proxying uploads through our own
 * API would fail on exactly the files this feature exists for.
 *
 * When R2 isn't configured (fresh clone, local dev) the same client-side code
 * path still works — `createUploadTarget` hands back a local endpoint that
 * accepts the identical PUT and writes to ./.storage instead.
 */

const LOCAL_ROOT = join(process.cwd(), ".storage");
const MAX_AUDIO_BYTES = 60 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/flac",
  "audio/mp4",
  "audio/aac",
];

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

export type UploadKind = "audio" | "cover";

export type UploadTarget = {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  /** True when the browser must PUT to our own API instead of straight to R2. */
  local: boolean;
  maxBytes: number;
};

let client: S3Client | undefined;

function s3() {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.r2.accessKeyId!,
        secretAccessKey: env.r2.secretAccessKey!,
      },
    });
  }
  return client;
}

function extensionFor(fileName: string) {
  const match = /\.([a-z0-9]{1,8})$/i.exec(fileName);
  return match ? match[1]!.toLowerCase() : "bin";
}

export function validateUpload(kind: UploadKind, contentType: string, size?: number) {
  const allowed = kind === "audio" ? ALLOWED_AUDIO_TYPES : ALLOWED_IMAGE_TYPES;
  const maxBytes = kind === "audio" ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;

  if (!allowed.includes(contentType)) {
    throw ApiError.badRequest(
      kind === "audio"
        ? "Unsupported audio format. Use MP3, WAV, OGG, FLAC or M4A."
        : "Unsupported image format. Use JPG, PNG, WebP or AVIF.",
    );
  }
  if (size != null && size > maxBytes) {
    throw ApiError.badRequest(
      `That file is too large. Maximum is ${Math.round(maxBytes / 1024 / 1024)} MB.`,
    );
  }
  return maxBytes;
}

export async function createUploadTarget(
  kind: UploadKind,
  fileName: string,
  contentType: string,
  size?: number,
): Promise<UploadTarget> {
  const maxBytes = validateUpload(kind, contentType, size);
  const key = `${kind}/${new Date().getFullYear()}/${crypto.randomUUID()}.${extensionFor(fileName)}`;

  if (!env.r2.configured) {
    return {
      key,
      uploadUrl: `/api/admin/files/${key}`,
      publicUrl: `/api/files/${key}`,
      local: true,
      maxBytes,
    };
  }

  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: env.r2.bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 600 },
  );

  return {
    key,
    uploadUrl,
    publicUrl: `${env.r2.publicBaseUrl}/${key}`,
    local: false,
    maxBytes,
  };
}

// --- Local development fallback -------------------------------------------

/** Rejects `..` and absolute paths so a crafted key can't escape ./.storage. */
function resolveLocal(key: string) {
  const normalised = normalize(key).replace(/^([/\\])+/, "");
  if (normalised.startsWith("..") || normalised.includes(`..${sep}`)) {
    throw ApiError.badRequest("Invalid file path.");
  }
  return join(LOCAL_ROOT, normalised);
}

export async function writeLocalFile(key: string, data: Uint8Array) {
  const target = resolveLocal(key);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
}

export async function readLocalFile(key: string) {
  try {
    return await readFile(resolveLocal(key));
  } catch {
    return null;
  }
}

export function contentTypeFromKey(key: string) {
  const ext = extensionFor(key);
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
    m4a: "audio/mp4",
    aac: "audio/aac",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    avif: "image/avif",
  };
  return map[ext] ?? "application/octet-stream";
}
