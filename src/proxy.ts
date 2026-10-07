import { clerkMiddleware } from "@clerk/nextjs/server";

// The proxy only makes the Clerk session available to `auth()`. It does NOT
// decide who may see what: path matching can diverge from how Next routes a
// request, so every protected page, route handler and Server Action checks
// access itself via `requireWorkspaceContext()` (src/server/workspace-context.ts).
// Point Clerk redirects (e.g. auth().redirectToSignIn()) at our own pages instead of
// the hosted Account Portal, which is what Clerk uses when no sign-in URL is configured.
export default clerkMiddleware({ signInUrl: "/sign-in", signUpUrl: "/sign-up" });

export const config = {
  matcher: [
    // Skip Next internals and static files (icons, manifest, fonts, ...).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
