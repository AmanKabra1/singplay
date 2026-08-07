import type { Metadata } from "next";

import { AdminSongsScreen } from "@/components/admin/AdminSongsScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Song management",
  robots: { index: false },
};

export default function AdminSongsPage() {
  return <AdminSongsScreen />;
}
