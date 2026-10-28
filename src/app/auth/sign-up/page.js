import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { AuthForm } from "../auth-form";

export const metadata = {
  title: "Create account",
};

export default function SignUpPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-wrap auth-page">
        <AuthForm mode="sign-up" />
      </main>
      <SiteFooter />
    </>
  );
}
