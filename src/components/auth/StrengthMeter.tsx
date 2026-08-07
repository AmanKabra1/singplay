"use client";

import { passwordStrength } from "@/lib/auth/password-strength";
import { cn } from "@/lib/utils";

const LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"] as const;
const TONES = ["bg-danger", "bg-danger", "bg-warning", "bg-accent-soft", "bg-success"] as const;

/**
 * Password strength meter, shared by sign-up and change-password.
 *
 * The bars are decorative; the announcement is the text below them, so the
 * information isn't carried by colour alone (brief §4.4).
 */
export function StrengthMeter({ value }: { value: string }) {
  const score = passwordStrength(value);

  return (
    <div>
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              index < score ? TONES[score] : "bg-surface-3",
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-muted" aria-live="polite">
        Password strength: {LABELS[score]}
      </p>
    </div>
  );
}
