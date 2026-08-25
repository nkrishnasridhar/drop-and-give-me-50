import { LogForm } from "@/features/logging/log-form";
import { createCaller } from "@/server/api/root";
import { auth, signIn, signOut } from "@/server/auth";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Drop and Give Me 50</h1>
        <p style={{ opacity: 0.6, maxWidth: "32ch" }}>Sign in to start logging.</p>
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
        >
          <button
            type="submit"
            style={{ padding: "0.75rem 1.5rem", fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}
          >
            Sign in with Google
          </button>
        </form>
      </main>
    );
  }

  const caller = await createCaller();
  const variationList = await caller.variations.list();

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        gap: "2rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "24rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ opacity: 0.6 }}>{session.user.name}</span>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button type="submit" style={{ opacity: 0.6, cursor: "pointer", background: "none", border: "none", color: "inherit" }}>
            Sign out
          </button>
        </form>
      </div>

      <LogForm variations={variationList} />
    </main>
  );
}
