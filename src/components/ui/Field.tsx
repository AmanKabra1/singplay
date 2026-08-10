"use client";

import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const CONTROL =
  "w-full rounded-xl border bg-surface-2 px-3.5 text-fluid-sm text-text placeholder:text-faint " +
  "transition-colors focus:border-accent focus:outline-none disabled:opacity-50";

/**
 * Label + control + inline error, wired together with aria-describedby so the
 * error is announced rather than merely coloured red (brief §4.2, §4.4).
 */
export function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (props: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
    className: string;
  }) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-fluid-sm font-medium text-muted">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        className: cn(CONTROL, error ? "border-danger" : "border-border"),
      })}

      {hint && !error && (
        <p id={hintId} className="text-xs text-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-xs text-danger">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput(props: ComponentProps<"input">) {
  return <input {...props} className={cn("h-11", props.className)} />;
}

export function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("h-11 pr-11", props.className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-faint hover:text-muted"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function TextArea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn("min-h-24 py-2.5", props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cn("h-11", props.className)} />;
}

/** Banner for errors that belong to the form as a whole, not one field. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-fluid-sm text-danger"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="rounded-xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-fluid-sm text-success"
    >
      {message}
    </p>
  );
}
