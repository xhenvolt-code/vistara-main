import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { AuthForm } from "../auth-form";

export const metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-wrap auth-page">
        <AuthForm mode="sign-in" />
      </main>
      <SiteFooter />
    </>
  );
}
