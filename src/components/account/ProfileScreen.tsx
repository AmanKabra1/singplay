"use client";

import { AlertTriangle, KeyRound, LogOut, Trash2, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  Field,
  FormError,
  FormSuccess,
  TextInput,
} from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { StrengthMeter } from "@/components/auth/StrengthMeter";
import { apiFetch, errorMessage, RequestError } from "@/lib/api/client";
import { clearFetchCache } from "@/lib/hooks/useFetch";
import type { PracticeStatsDTO, SessionUser } from "@/lib/types";
import { formatDuration, initials } from "@/lib/utils";
import { toast } from "@/store/ui";

/** Profile & settings (brief §6.9). */
export function ProfileScreen({
  user,
  hasPassword,
  memberSince,
  stats,
}: {
  user: SessionUser;
  hasPassword: boolean;
  memberSince: string;
  stats: PracticeStatsDTO;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-wrap items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-fluid-lg font-bold text-white">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initials(user.displayName)
          )}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-fluid-xl font-bold">{user.displayName}</h1>
          <p className="truncate text-fluid-sm text-muted">{user.email}</p>
          <p className="text-xs text-faint">
            {user.role === "admin" && "Administrator · "}
            Member since{" "}
            {new Date(memberSince).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
            {user.verified ? "" : " · email not confirmed"}
          </p>
        </div>
      </header>

      <section aria-label="Your singing" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Streak" value={`${stats.currentStreak}d`} />
        <Stat label="Best streak" value={`${stats.longestStreak}d`} />
        <Stat label="Songs practised" value={String(stats.songsPracticed)} />
        <Stat label="Time singing" value={formatDuration(stats.totalPracticeSec)} />
      </section>

      <ProfileForm user={user} />

      {hasPassword ? (
        <PasswordForm />
      ) : (
        <Panel
          icon={<KeyRound className="size-4" />}
          title="Password"
          description="This account signs in with Google, so there's no password to manage here."
        >
          <p className="text-fluid-sm text-muted">
            To add a password, sign out and use “Forgot password” with{" "}
            <span className="font-medium text-text">{user.email}</span> — the reset
            link lets you set one.
          </p>
        </Panel>
      )}

      <SessionActions />
      <DangerZone />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-xs uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-1 text-fluid-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Panel({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-fluid-lg font-bold">
        <span className="text-accent-soft" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-fluid-sm leading-relaxed text-muted">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProfileForm({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const dirty =
    displayName.trim() !== user.displayName || avatarUrl !== (user.avatarUrl ?? "");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setSuccess(null);
    setFieldErrors({});

    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        body: { displayName: displayName.trim(), avatarUrl },
      });
      setSuccess("Your profile has been updated.");
      // The top bar reads the name and avatar from the session cookie, which the
      // API just re-minted — refresh so the shell picks it up.
      router.refresh();
    } catch (error) {
      if (error instanceof RequestError) setFieldErrors(error.fieldErrors);
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      icon={<UserCog className="size-4" />}
      title="Profile"
      description="How you appear across SingPlay."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormError message={formError} />
        <FormSuccess message={success} />

        <Field label="Display name" required error={fieldErrors.displayName}>
          {(props) => (
            <TextInput
              {...props}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
              autoComplete="name"
            />
          )}
        </Field>

        <Field
          label="Avatar image URL"
          hint="Optional. Paste a link to a square image."
          error={fieldErrors.avatarUrl}
        >
          {(props) => (
            <TextInput
              {...props}
              type="url"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://…"
            />
          )}
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={busy} disabled={!dirty}>
            Save changes
          </Button>
          {dirty && (
            <Button
              variant="ghost"
              onClick={() => {
                setDisplayName(user.displayName);
                setAvatarUrl(user.avatarUrl ?? "");
                setFieldErrors({});
                setFormError(null);
              }}
            >
              Discard
            </Button>
          )}
        </div>
      </form>
    </Panel>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);

    // Checked here rather than server-side: the confirmation field only exists
    // in this form, so it's the only place that knows about it.
    if (newPassword !== confirm) {
      setFieldErrors({ confirm: "Those two passwords don't match." });
      return;
    }

    setBusy(true);
    try {
      const result = await apiFetch<{ message: string }>("/api/profile/password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      setSuccess(result.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (error) {
      if (error instanceof RequestError) setFieldErrors(error.fieldErrors);
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      icon={<KeyRound className="size-4" />}
      title="Password"
      description="Choose something you don't use anywhere else."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormError message={formError} />
        <FormSuccess message={success} />

        <Field label="Current password" required error={fieldErrors.currentPassword}>
          {(props) => (
            <TextInput
              {...props}
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
          )}
        </Field>

        <Field
          label="New password"
          required
          error={fieldErrors.password ?? fieldErrors.newPassword}
          hint="At least 8 characters, with a letter and a number."
        >
          {(props) => (
            <TextInput
              {...props}
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          )}
        </Field>

        {newPassword.length > 0 && <StrengthMeter value={newPassword} />}

        <Field label="Confirm new password" required error={fieldErrors.confirm}>
          {(props) => (
            <TextInput
              {...props}
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
            />
          )}
        </Field>

        <Button
          type="submit"
          loading={busy}
          disabled={!currentPassword || !newPassword}
          className="self-start"
        >
          Update password
        </Button>
      </form>
    </Panel>
  );
}

function SessionActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      clearFetchCache();
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error("Couldn't sign out", errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <Panel icon={<LogOut className="size-4" />} title="Session">
      <Button variant="secondary" loading={busy} onClick={signOut}>
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </Button>
    </Panel>
  );
}

function DangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function deleteAccount() {
    setBusy(true);
    setFormError(null);
    try {
      await apiFetch("/api/profile", { method: "DELETE" });
      clearFetchCache();
      router.push("/");
      router.refresh();
    } catch (error) {
      setFormError(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-danger/30 bg-danger/5 p-5">
      <h2 className="flex items-center gap-2 text-fluid-lg font-bold text-danger">
        <AlertTriangle className="size-4" aria-hidden="true" />
        Delete account
      </h2>
      <p className="mt-1 text-fluid-sm leading-relaxed text-muted">
        Removes your account along with your playlists, favourites, listening
        history and practice stats. This can&apos;t be undone.
      </p>
      <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden="true" />
        Delete my account
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete your account?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              // Typing the word is the confirmation — a lone "are you sure"
              // button is too easy to click through on something irreversible.
              disabled={confirmation.trim().toUpperCase() !== "DELETE"}
              onClick={deleteAccount}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormError message={formError} />
          <p className="text-fluid-sm leading-relaxed text-muted">
            Everything tied to this account goes with it. Type{" "}
            <span className="font-mono font-semibold text-text">DELETE</span> to
            confirm.
          </p>
          <Field label="Confirmation">
            {(props) => (
              <TextInput
                {...props}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            )}
          </Field>
        </div>
      </Modal>
    </section>
  );
}
