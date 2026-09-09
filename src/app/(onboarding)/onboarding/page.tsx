import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen";
import { SignInCard } from "@/features/shell/sign-in-card";
import { auth } from "@/server/auth";
import { db } from "@/server/db/client";
import { userSettings } from "@/server/db/schema";

export default async function OnboardingPage() {
  const session = await auth();
  const userId = session?.user?.id;
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

  if (settings?.onboardedAt) {
    redirect("/");
  }

  return (
    <main className="appShell">
      <OnboardingScreen />
    </main>
  );
}
