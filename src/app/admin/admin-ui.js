import Image from "next/image";
import Link from "next/link";

const navigation = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/movies", label: "Movie library" },
  { href: "/admin/movies/new", label: "Upload movie" },
  { href: "/admin/catalogue", label: "Rights & genres" },
  { href: "/admin/products", label: "Access products" },
  { href: "/admin/payments", label: "Purchases & payments" },
  { href: "/admin/finance", label: "Revenue shares" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/storage", label: "Object storage" },
  { href: "/admin/audit", label: "Audit history" },
  { href: "/admin/settings", label: "System settings" },
];

export function AdminShell({ access, children }) {
  if (access.status !== "authorized") {
    return (
      <main className="page-wrap admin-page">
        <AdminAccessNotice status={access.status} />
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
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
        <p className="admin-sidebar-label">Control room</p>
        <nav aria-label="Administration" className="admin-nav">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link className="admin-back-link" href="/">
          Back to the site
        </Link>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <span>Vistara administration</span>
          <span className="admin-role-badge">
            {access.role === "superadmin" ? "Superadmin" : "Administrator"}
          </span>
        </header>
        <main className="admin-content">{children}</main>
      </div>
      <nav aria-label="Mobile administration" className="admin-mobile-nav">
        {navigation.slice(0, 5).map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function AdminAccessNotice({ status }) {
  if (status === "unauthenticated") {
    return (
      <section className="admin-message">
        <h1>Sign in to continue</h1>
        <p>Administrator access requires a Vistara account on the allowlist.</p>
        <Link className="button-primary" href="/auth/sign-in">
          Sign in
        </Link>
      </section>
    );
  }

  if (status === "not-configured") {
    return (
      <section className="admin-message">
        <h1>Administrator access needs setup</h1>
        <p>
          Add administrator addresses to <code>ADMIN_EMAILS</code> and
          superadministrator addresses to <code>SUPERADMIN_EMAILS</code> in
          the server environment.
        </p>
      </section>
    );
  }

  return (
    <section className="admin-message">
      <h1>Access denied</h1>
      <p>This account is not authorized to manage Vistara.</p>
      <Link className="text-link" href="/">
        Return to Vistara
      </Link>
    </section>
  );
}

export function AdminPageHeading({ eyebrow = "Control room", title, children }) {
  return (
    <div className="admin-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function formatAdminCurrency(amount, currency = "UGX") {
  return `${currency} ${Number(amount).toLocaleString("en-UG")}`;
}
