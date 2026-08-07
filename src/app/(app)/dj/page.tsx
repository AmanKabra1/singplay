import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DjPanel } from "@/components/dj/DjPanel";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DJ booth",
  description: "Two decks, a crossfader and an effects rack — your own private mix.",
};

export default async function DjPage() {
  // The booth is per-user and sandboxed (brief §3.5), so it needs an account.
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fdj");

  return <DjPanel />;
}
