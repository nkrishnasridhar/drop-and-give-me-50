import { signOut } from "@/server/auth";

export function AppHeader({ name }: { name: string | null | undefined }) {
  return (
    <div className="appHeader">
      <span>{name ?? "You"}</span>
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
  );
}
