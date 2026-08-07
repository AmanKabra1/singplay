import type { Metadata } from "next";

import { AdminUsersScreen } from "@/components/admin/AdminUsersScreen";
import { requirePageAdmin } from "@/lib/auth/page-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "User management",
  robots: { index: false },
};

export default async function AdminUsersPage() {
  // The current admin's id is passed down so the UI can refuse to offer
  // self-demotion — the API enforces the same rule regardless.
  const admin = await requirePageAdmin("/admin/users");
  return <AdminUsersScreen currentAdminId={admin.id} />;
}
