import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader } from "@/features/shell/app-header";
import { SignInCard } from "@/features/shell/sign-in-card";
import { TabBar } from "@/features/shell/tab-bar";
import { auth } from "@/server/auth";
import { db } from "@/server/db/client";
import { userSettings } from "@/server/db/schema";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="appShell">
        <SignInCard />
      </main>
    );
  }

  const userId = session.user.id;
  if (!userId) {
    return (
      <main className="appShell">
        <SignInCard />
      </main>
    );
  }

  const [settings] = await db
    .select({ onboardedAt: userSettings.onboardedAt })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  if (!settings?.onboardedAt) {
    redirect("/onboarding");
  }

  return (
    <main className="appShell appShellWithTabs">
      <AppHeader name={session.user.name} />
      {children}
      <TabBar />
    </main>
  );
}
