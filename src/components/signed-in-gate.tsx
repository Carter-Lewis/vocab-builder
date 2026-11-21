"use client";

import { RedirectToSignIn, useAuth } from "@clerk/nextjs";

/**
 * Renders children only once Clerk confirms a session, so pages never fetch
 * before auth is known. Data is still protected server-side in every API route.
 */
export function SignedInGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <RedirectToSignIn />;
  return children;
}
