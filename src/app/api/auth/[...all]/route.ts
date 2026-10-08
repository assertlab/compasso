import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/ba/auth";

// SPIKE (ADR-033): lazy so that importing the route never needs env vars.
export const GET = (req: Request) => toNextJsHandler(getAuth()).GET(req);
export const POST = (req: Request) => toNextJsHandler(getAuth()).POST(req);
