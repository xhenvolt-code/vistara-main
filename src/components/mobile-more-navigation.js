"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";

export function MobileMoreNavigation({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const firstLinkRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    firstLinkRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {isOpen && (
        <>
          <button
            aria-label="Close more navigation"
            className="mobile-more-backdrop"
            onClick={() => {
              setIsOpen(false);
              triggerRef.current?.focus();
            }}
            tabIndex={-1}
            type="button"
          />
          <nav
            aria-label="More navigation"
            className="mobile-more-drawer"
            id="mobile-more-drawer"
          >
            {user ? (
              <span className="mobile-more-account">
                Signed in as {user.email || user.name || "Vistara member"}
              </span>
            ) : (
              <Link
                href="/auth/sign-in"
                onClick={() => setIsOpen(false)}
                ref={firstLinkRef}
              >
                Sign in
              </Link>
            )}
            <Link
              href="/admin"
              onClick={() => setIsOpen(false)}
              ref={user ? firstLinkRef : null}
            >
              Admin
            </Link>
            {user ? (
              <form action={signOut}>
                <button type="submit">Sign out</button>
              </form>
            ) : (
              <Link href="/auth/sign-up" onClick={() => setIsOpen(false)}>
                Create account
              </Link>
            )}
          </nav>
        </>
      )}
      <button
        aria-controls="mobile-more-drawer"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close more navigation" : "Open more navigation"}
        className="mobile-more-trigger"
        onClick={() => setIsOpen((open) => !open)}
        ref={triggerRef}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </svg>
        <span>More</span>
      </button>
    </>
  );
}
