import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { ResetPasswordForm } from "./form";

export const metadata = { title: "Choose a new password" };

async function ResetPasswordContent({ searchParams }) {
  await connection();
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";

  return (
    <div className="auth-page-content">
      <ResetPasswordForm token={token} />
      <Link className="text-link" href="/auth/forgot-password">
        Request a new reset link
      </Link>
    </div>
  );
}

export default function ResetPasswordPage({ searchParams }) {
  return (
    <>
      <SiteHeader />
      <main className="page-wrap auth-page">
        <Suspense fallback={<p className="muted">Loading password reset...</p>}>
          <ResetPasswordContent searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
