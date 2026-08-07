import type { Metadata } from "next";

import { ProfileScreen } from "@/components/account/ProfileScreen";
import { toSessionUser } from "@/lib/auth/account";
import { requirePageUser } from "@/lib/auth/page-guard";
import { getPracticeStats } from "@/lib/server/library";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile & settings",
  description: "Your SingPlay account, appearance and security settings.",
};

export default async function ProfilePage() {
  const user = await requirePageUser("/profile");
  const stats = await getPracticeStats(user.id);

  return (
    <ProfileScreen
      user={toSessionUser(user)}
      hasPassword={user.passwordHash !== null}
      memberSince={user.createdAt.toISOString()}
      stats={stats}
    />
  );
}
