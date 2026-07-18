"use client";

import { useUser, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

/**
 * Header auth controls. Rendered only when Clerk is enabled (see layout). Uses
 * useUser() to branch since this SDK version doesn't ship <SignedIn>/<SignedOut>.
 */
export function AuthButtons() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return null;
  if (isSignedIn) return <UserButton />;
  return (
    <>
      <SignInButton mode="modal">
        <button className="hover:text-blue-600">Sign in</button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="rounded-md bg-blue-600 px-3 py-1 text-white hover:bg-blue-700">
          Sign up
        </button>
      </SignUpButton>
    </>
  );
}
