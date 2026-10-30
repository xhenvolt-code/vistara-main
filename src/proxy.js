import { auth } from "@/server/auth/neon";

export const proxy = auth.middleware();

export const config = {
  matcher: ["/auth/callback", "/admin", "/admin/:path*"],
};
