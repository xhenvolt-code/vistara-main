import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { ForgotPasswordForm } from "./form";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-wrap auth-page">
        <div className="auth-page-content">
          <ForgotPasswordForm />
          <Link className="text-link" href="/auth/sign-in">
            Back to sign in
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
