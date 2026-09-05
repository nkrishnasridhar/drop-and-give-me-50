import type { ReactNode } from "react";
import { AppHeader } from "@/features/shell/app-header";
import { SignInCard } from "@/features/shell/sign-in-card";
import { TabBar } from "@/features/shell/tab-bar";
import { auth } from "@/server/auth";

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

  return (
    <main className="appShell appShellWithTabs">
      <AppHeader name={session.user.name} />
      {children}
      <TabBar />
    </main>
  );
}
