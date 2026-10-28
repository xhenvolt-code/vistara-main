import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/neon";
import { syncAuthProfile } from "@/server/auth/sync-profile";

async function AuthCallback() {
  await connection();
  const { data: session, error } = await auth.getSession();

  if (error) {
    throw new Error("Unable to verify the Google sign-in session.", {
      cause: error,
    });
  }

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  await syncAuthProfile(session.user);
  redirect("/");
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<p className="muted">Completing sign-in...</p>}>
      <AuthCallback />
    </Suspense>
  );
}
