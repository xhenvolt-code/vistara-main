import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { signOut } from "@/app/auth/actions";
import { auth } from "@/server/auth/neon";
import { MobileMoreNavigation } from "./mobile-more-navigation";

function FooterCredit() {
  return (
    <p className="site-attribution">
      Designed with{" "}
      <svg
        aria-label="love"
        className="site-attribution-heart"
        role="img"
        viewBox="0 0 24 24"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
      </svg>{" "}
      by <strong>Xhenvolt Uganda</strong>
      <span className="site-attribution-security">Secured by Neon Auth</span>
    </p>
  );
}

async function getSignedInUser() {
  await connection();
  const { data: session, error } = await auth.getSession();

  if (error) {
    throw new Error("Unable to verify the current authentication session.", {
      cause: error,
    });
  }

  return session?.user ?? null;
}

async function SiteHeaderContent() {
  const user = await getSignedInUser();

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Vistara home">
        <Image
          alt=""
          className="brand-icon"
          height={34}
          src="/vistara-icon.png"
          width={34}
        />
        <span className="brand-name">VISTARA<span>.</span></span>
      </Link>
      <nav aria-label="Main navigation" className="site-nav">
        <Link href="/movies">Discover</Link>
        <Link href="/passes">Subscriptions</Link>
        <Link href="/admin">Admin</Link>
      </nav>
      <div className="header-account-actions">
        {user && (
          <span className="header-account" title={user.email || "Signed in"}>
            {user.email || "Signed in"}
          </span>
        )}
        {user ? (
          <form action={signOut}>
            <button className="header-action" type="submit">
              Sign out
            </button>
          </form>
        ) : (
          <Link className="header-action" href="/auth/sign-in">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

function SiteHeaderFallback() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Vistara home">
        <Image
          alt=""
          className="brand-icon"
          height={34}
          src="/vistara-icon.png"
          width={34}
        />
        <span className="brand-name">VISTARA<span>.</span></span>
      </Link>
      <nav aria-label="Main navigation" className="site-nav">
        <Link href="/movies">Discover</Link>
        <Link href="/passes">Subscriptions</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </header>
  );
}

export function SiteHeader() {
  return (
    <Suspense fallback={<SiteHeaderFallback />}>
      <SiteHeaderContent />
    </Suspense>
  );
}

async function SiteFooterContent() {
  const user = await getSignedInUser();

  return (
    <>
      <footer className="site-footer">
        <Link className="brand" href="/">
          <Image
            alt=""
            className="brand-icon"
            height={34}
            src="/vistara-icon.png"
            width={34}
          />
          <span className="brand-name">VISTARA<span>.</span></span>
        </Link>
        <p>Stories worth staying in for.</p>
        <span>Uganda · UGX</span>
        <FooterCredit />
      </footer>
      <FooterCredit />
      <nav aria-label="Mobile navigation" className="mobile-bottom-nav">
        <Link href="/" aria-label="Home">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
          </svg>
          <span>Home</span>
        </Link>
        <Link href="/movies" aria-label="Discover">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 4.2 4.2" />
          </svg>
          <span>Discover</span>
        </Link>
        <Link href="/passes" aria-label="Subscriptions">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 1 4 17.5z" />
            <path d="M4 7h16M8 11h8m-8 4h5" />
          </svg>
          <span>Subscriptions</span>
        </Link>
        <MobileMoreNavigation
          user={
            user
              ? { email: user.email ?? null, name: user.name ?? null }
              : null
          }
        />
      </nav>
    </>
  );
}

function SiteFooterFallback() {
  return (
    <>
      <footer className="site-footer">
        <Link className="brand" href="/">
          <Image
            alt=""
            className="brand-icon"
            height={34}
            src="/vistara-icon.png"
            width={34}
          />
          <span className="brand-name">VISTARA<span>.</span></span>
        </Link>
        <p>Stories worth staying in for.</p>
        <span>Uganda · UGX</span>
        <FooterCredit />
      </footer>
      <FooterCredit />
      <nav aria-label="Mobile navigation" className="mobile-bottom-nav">
        <Link href="/" aria-label="Home">
          <span>Home</span>
        </Link>
        <Link href="/movies" aria-label="Discover">
          <span>Discover</span>
        </Link>
        <Link href="/passes" aria-label="Subscriptions">
          <span>Subscriptions</span>
        </Link>
        <MobileMoreNavigation user={null} />
      </nav>
    </>
  );
}

export function SiteFooter() {
  return (
    <Suspense fallback={<SiteFooterFallback />}>
      <SiteFooterContent />
    </Suspense>
  );
}
