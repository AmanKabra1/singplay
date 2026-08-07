"use client";

import { KeyRound, Search, ShieldCheck, Trash2, UserX, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button, IconButton } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { clearFetchCache, useFetch } from "@/lib/hooks/useFetch";
import { cn, initials, relativeTime } from "@/lib/utils";
import { toast } from "@/store/ui";

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: "user" | "admin";
  status: "active" | "suspended";
  verified: boolean;
  hasPassword: boolean;
  createdAt: string;
  plays30d: number;
};

type Response = {
  items: AdminUser[];
  total: number;
  limit: number;
  offset: number;
};

const PAGE_SIZE = 25;

/** User management (brief §3.7). */
export function AdminUsersScreen({ currentAdminId }: { currentAdminId: string }) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(draft.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [draft]);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (query) params.set("q", query);
    return `/api/admin/users?${params}`;
  }, [query, page]);

  const { data, loading, error, refetch } = useFetch<Response>(url, { cached: false });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  async function patch(user: AdminUser, changes: Partial<Pick<AdminUser, "role" | "status">>) {
    setBusyId(user.id);
    try {
      await apiFetch(`/api/admin/users/${user.id}`, { method: "PATCH", body: changes });
      toast.success("Account updated", user.email);
      refetch();
    } catch (cause) {
      toast.error("Couldn't update that account", errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function sendReset(user: AdminUser) {
    setBusyId(user.id);
    try {
      const result = await apiFetch<{ message: string }>(
        `/api/admin/users/${user.id}`,
        { method: "POST" },
      );
      toast.success("Reset link sent", result.message);
    } catch (cause) {
      toast.error("Couldn't send a reset link", errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await apiFetch(`/api/admin/users/${deleting.id}`, { method: "DELETE" });
      clearFetchCache("/api/admin/users");
      toast.success("Account deleted", deleting.email);
      setDeleting(null);
      setConfirmation("");
      refetch();
    } catch (cause) {
      toast.error("Couldn't delete that account", errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-fluid-xl font-bold">Users</h1>
        <p className="text-fluid-sm text-muted">
          {data ? `${data.total} account${data.total === 1 ? "" : "s"}` : "Manage accounts"}
        </p>
      </header>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
          aria-hidden="true"
        />
        <label htmlFor="admin-user-search" className="sr-only">
          Search users
        </label>
        <input
          id="admin-user-search"
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search by name or email…"
          className="h-11 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 text-fluid-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </div>

      {loading && !data && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <ErrorState
          description={error.message}
          offline={error.isOffline}
          onRetry={refetch}
        />
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          icon={<Users className="size-8" />}
          title={query ? "No accounts match that search" : "No accounts yet"}
          description={
            query ? "Try a different name or email." : "Accounts appear here as people sign up."
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {data.items.map((user) => {
              const isSelf = user.id === currentAdminId;
              const busy = busyId === user.id;

              return (
                <li
                  key={user.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3",
                    user.status === "suspended" && "opacity-70",
                    busy && "opacity-60",
                  )}
                >
                  <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-xs font-bold text-white">
                    {user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatarUrl} alt="" className="size-full object-cover" />
                    ) : (
                      initials(user.displayName)
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-fluid-sm font-medium">
                      <span className="truncate">{user.displayName}</span>
                      {isSelf && (
                        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-muted">
                          You
                        </span>
                      )}
                      {user.role === "admin" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-accent-soft">
                          <ShieldCheck className="size-3" aria-hidden="true" />
                          Admin
                        </span>
                      )}
                      {user.status === "suspended" && (
                        <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-danger">
                          Suspended
                        </span>
                      )}
                      {!user.verified && (
                        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-warning">
                          Unverified
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                    <p className="truncate text-[0.7rem] text-faint">
                      Joined {relativeTime(user.createdAt)} · {user.plays30d} play
                      {user.plays30d === 1 ? "" : "s"} in 30 days ·{" "}
                      {user.hasPassword ? "password" : "Google sign-in"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy || isSelf}
                      title={
                        isSelf
                          ? "You can't change your own role"
                          : user.role === "admin"
                            ? "Remove admin access"
                            : "Grant admin access"
                      }
                      onClick={() =>
                        patch(user, { role: user.role === "admin" ? "user" : "admin" })
                      }
                    >
                      <ShieldCheck className="size-4" aria-hidden="true" />
                      {user.role === "admin" ? "Demote" : "Make admin"}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy || isSelf}
                      title={
                        isSelf
                          ? "You can't suspend your own account"
                          : user.status === "active"
                            ? "Block sign-in for this account"
                            : "Restore access"
                      }
                      onClick={() =>
                        patch(user, {
                          status: user.status === "active" ? "suspended" : "active",
                        })
                      }
                    >
                      <UserX className="size-4" aria-hidden="true" />
                      {user.status === "active" ? "Suspend" : "Restore"}
                    </Button>

                    {user.hasPassword && (
                      <IconButton
                        label={`Send a password reset link to ${user.email}`}
                        size="sm"
                        disabled={busy}
                        onClick={() => sendReset(user)}
                      >
                        <KeyRound className="size-4" aria-hidden="true" />
                      </IconButton>
                    )}

                    <IconButton
                      label={`Delete ${user.email}`}
                      size="sm"
                      disabled={busy || isSelf}
                      onClick={() => setDeleting(user)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                disabled={page === 0 || loading}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                Previous
              </Button>
              <p className="text-fluid-sm text-muted" aria-live="polite">
                Page {page + 1} of {totalPages}
              </p>
              <Button
                variant="secondary"
                disabled={page + 1 >= totalPages || loading}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <Modal
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          setConfirmation("");
        }}
        title="Delete this account?"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleting(null);
                setConfirmation("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busyId === deleting?.id}
              disabled={confirmation.trim().toUpperCase() !== "DELETE"}
              onClick={confirmDelete}
            >
              Delete account
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-fluid-sm leading-relaxed text-muted">
            <span className="font-medium text-text">{deleting?.email}</span> and
            everything tied to it — playlists, favourites, history and practice
            stats — will be permanently removed. Type{" "}
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
    </div>
  );
}
