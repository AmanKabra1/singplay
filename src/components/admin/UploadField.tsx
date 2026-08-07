"use client";

import { CheckCircle2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { InlineError, Spinner } from "@/components/ui/States";
import { apiFetch, errorMessage } from "@/lib/api/client";

type UploadTarget = {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  local: boolean;
  maxBytes: number;
};

/**
 * File upload for audio and cover art.
 *
 * Two steps: ask our API for a target, then PUT the file straight to it. With R2
 * configured that second request goes browser → bucket, which is the only way a
 * file bigger than a serverless function's 4.5 MB body limit can be uploaded at
 * all. Pasting a URL by hand stays available either way — some catalogs are
 * already hosted somewhere sensible.
 */
export function UploadField({
  kind,
  label,
  value,
  hint,
  error,
  onChange,
}: {
  kind: "audio" | "cover";
  label: string;
  value: string;
  hint?: string;
  error?: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    setJustUploaded(false);
    setProgress(0);

    try {
      const target = await apiFetch<UploadTarget>("/api/admin/uploads", {
        method: "POST",
        body: {
          kind,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        },
      });

      await putWithProgress(target.uploadUrl, file, setProgress);

      onChange(target.publicUrl);
      setJustUploaded(true);
    } catch (cause) {
      setUploadError(errorMessage(cause, "The upload failed. Try again."));
    } finally {
      setUploading(false);
      // Let the same file be picked again after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Field label={label} hint={hint} error={error}>
        {(props) => (
          <div className="flex gap-2">
            <TextInput
              {...props}
              value={value}
              onChange={(event) => {
                onChange(event.target.value);
                setJustUploaded(false);
              }}
              placeholder={
                kind === "audio" ? "https://…/track.mp3" : "https://…/cover.jpg"
              }
            />
            <Button
              variant="secondary"
              className="shrink-0"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Spinner className="size-4" />
              ) : (
                <Upload className="size-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {uploading ? `${progress}%` : "Upload"}
              </span>
            </Button>
          </div>
        )}
      </Field>

      <input
        ref={inputRef}
        type="file"
        accept={kind === "audio" ? "audio/*" : "image/*"}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {uploading && (
        <div
          className="h-1 overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={`Uploading ${label}`}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {uploadError && <InlineError message={uploadError} />}

      {justUploaded && !uploadError && (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          Uploaded. Remember to save the track.
        </p>
      )}

      {value && kind === "cover" && (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Cover preview"
            className="size-16 rounded-lg border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex items-center gap-1 text-xs text-faint hover:text-danger"
          >
            <X className="size-3.5" aria-hidden="true" />
            Remove
          </button>
        </div>
      )}

      {value && kind === "audio" && (
        // A quick listen before saving catches a wrong or broken file
        // immediately, rather than when a listener hits it.
        <audio src={value} controls preload="none" className="w-full">
          <track kind="captions" />
        </audio>
      )}
    </div>
  );
}

/**
 * `fetch` can't report upload progress, and an audio file is big enough that a
 * silent multi-second wait reads as a hang — hence XHR.
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("content-type", file.type || "application/octet-stream");

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`The storage service rejected the file (${request.status}).`));
    });
    request.addEventListener("error", () =>
      reject(new Error("The upload connection failed.")),
    );
    request.addEventListener("abort", () => reject(new Error("The upload was cancelled.")));

    request.send(file);
  });
}
