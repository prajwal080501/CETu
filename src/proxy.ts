import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { clerkEnabled } from "@/lib/auth";

/**
 * Clerk middleware only runs when keys are configured. Without them we pass
 * every request through untouched, so the app works fully unauthenticated.
 * (Next.js 16 names this file `proxy.ts`; it was `middleware.ts` on <=15.)
 */
export default clerkEnabled ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
