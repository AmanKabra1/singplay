"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Spinner } from "./States";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon" | "icon-lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-soft active:bg-accent-soft disabled:bg-accent/50",
  secondary:
    "bg-surface-2 text-text hover:bg-surface-3 border border-border disabled:opacity-50",
  ghost: "text-muted hover:text-text hover:bg-surface-2 disabled:opacity-40",
  danger: "bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30",
  outline: "border border-border-strong text-text hover:bg-surface-2 hover:border-accent",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-fluid-sm gap-1.5 rounded-lg",
  md: "tap px-4 text-fluid-sm gap-2 rounded-xl",
  lg: "min-h-12 px-6 text-fluid-base gap-2 rounded-xl",
  icon: "tap w-11 rounded-xl justify-center",
  "icon-lg": "h-14 w-14 rounded-full justify-center",
};

const BASE =
  "inline-flex items-center justify-center font-medium transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft " +
  "disabled:cursor-not-allowed select-none";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
};

export type ButtonProps = CommonProps &
  Omit<ComponentProps<"button">, "children" | "className">;

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export type ButtonLinkProps = CommonProps &
  Omit<ComponentProps<typeof Link>, "children" | "className">;

export function ButtonLink({
  variant = "primary",
  size = "md",
  children,
  className,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </Link>
  );
}

/**
 * Icon-only button. `label` is required and becomes the accessible name —
 * without it a screen reader announces nothing but "button" (brief §4.4).
 */
export function IconButton({
  label,
  size = "icon",
  variant = "ghost",
  className,
  ...rest
}: ButtonProps & { label: string }) {
  return (
    <Button
      aria-label={label}
      title={label}
      size={size}
      variant={variant}
      className={cn("shrink-0", className)}
      {...rest}
    />
  );
}
