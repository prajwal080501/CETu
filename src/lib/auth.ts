/**
 * Auth is optional: the app runs fully without Clerk keys (preference lists fall
 * back to localStorage). When NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set, Clerk is
 * activated (provider, middleware, sign-in UI, server-backed preference lists).
 */
export const clerkEnabled =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("REPLACE_ME");
