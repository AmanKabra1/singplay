import type { Metadata } from "next";

import { AdminOverviewScreen } from "@/components/admin/AdminOverviewScreen";
import { adminOverview } from "@/lib/server/analytics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin overview",
  robots: { index: false },
};

export default async function AdminPage() {
  // The layout already enforced the admin role.
  const data = await adminOverview();
  return <AdminOverviewScreen data={data} />;
}
