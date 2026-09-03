import { LogScreen } from "@/features/logging/log-screen";
import type { ClientSetSource } from "@/domain/set";
import { createCaller } from "@/server/api/root";
import { auth, signIn, signOut } from "@/server/auth";

function parseArmedReps(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) return undefined;
  return parsed;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await auth();
  const params = await searchParams;
  const armedReps = parseArmedReps(
    typeof params.reps === "string" ? params.reps : undefined,
  );
  const source: ClientSetSource =
    params.source === "shortcut" ? "shortcut" : "app";

  if (!session?.user) {
    return (
      <main className="appShell">
        <div className="authCard">
          <h1>Drop and Give Me 50</h1>
          <p>Sign in to start logging. The set is the whole workout.</p>
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button type="submit" className="signInButton">
              Sign in with Google
            </button>
          </form>
        </div>
      </main>
    );
  }

  const caller = await createCaller();
  const variationList = (await caller.variations.list()).map((row) => ({
    id: row.id,
    name: row.name,
    family: row.family,
    intensityFactor: row.intensityFactor,
    difficulty: row.difficulty,
    primaryEmphasis: row.primaryEmphasis,
    sortOrder: row.sortOrder,
  }));

  return (
    <main className="appShell">
      <div className="appHeader">
        <span>{session.user.name}</span>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button type="submit" className="signOutButton">
            Sign out
          </button>
        </form>
      </div>
      <LogScreen
        variations={variationList}
        armedReps={armedReps}
        source={source}
      />
    </main>
  );
}
