import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/neon";
import { AuthForm } from "../auth-form";

export const metadata = {
  title: "Sign in",
};

async function SignInContent({ searchParams }) {
  await connection();
  const params = await searchParams;
  const { data: session, error } = await auth.getSession();

  if (error) {
    throw new Error("Unable to verify the current authentication session.", {
      cause: error,
    });
  }

  if (session?.user) {
    redirect("/");
  }

  return (
    <>
      <SiteHeader />
      <main className="page-wrap auth-page">
        <AuthForm
          mode="sign-in"
          passwordReset={params?.passwordReset === "1"}
        />
      </main>
      <SiteFooter />
    </>
  );
}

export default function SignInPage({ searchParams }) {
  return (
    <Suspense
      fallback={
        <main className="page-wrap auth-page">
          <p className="muted">Checking your sign-in status…</p>
        </main>
      }
    >
      <SignInContent searchParams={searchParams} />
    </Suspense>
  );
}
