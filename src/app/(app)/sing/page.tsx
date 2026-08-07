import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SingScreen } from "@/components/sing/SingScreen";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sing Along",
  description: "Pick a song, hit play, and sing along with scrolling highlighted lyrics.",
};

export default async function SingPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fsing");
  return <SingScreen />;
}
