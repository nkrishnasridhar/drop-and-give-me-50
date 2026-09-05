import { signIn } from "@/server/auth";

export function SignInCard() {
  return (
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
  );
}
