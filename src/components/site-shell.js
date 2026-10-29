import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
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
        <Link href="/passes">Access passes</Link>
        <Link href="/admin">Admin</Link>
      </nav>
      <Link className="header-action" href="/auth/sign-in">
        Sign in
      </Link>
    </header>
  );
}

export function SiteFooter() {
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
      </footer>
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
        <Link href="/passes" aria-label="Passes">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 1 4 17.5z" />
            <path d="M4 7h16M8 11h8m-8 4h5" />
          </svg>
          <span>Passes</span>
        </Link>
        <Link href="/auth/sign-in" aria-label="Account">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          <span>Account</span>
        </Link>
        <Link href="/admin" aria-label="Administration">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span>Admin</span>
        </Link>
      </nav>
    </>
  );
}
