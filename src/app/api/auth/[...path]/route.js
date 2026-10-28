import { auth } from "@/server/auth/neon";

export const { GET, POST } = auth.handler();
