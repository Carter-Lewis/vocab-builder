import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk only attaches session state here. Auth is enforced where data is read:
// every API route calls requireUser(), and app pages render behind <SignedInGate>.
export default clerkMiddleware({ signInUrl: "/sign-in", signUpUrl: "/sign-up" });

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
