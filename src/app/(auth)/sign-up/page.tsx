import { redirect } from "next/navigation";

// There is no separate sign-up: a first sign-in with a new e-mail creates the account (ADR-033). Old links keep working.
export default function SignUpPage() {
  redirect("/sign-in");
}
