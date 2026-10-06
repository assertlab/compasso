import { SignUp } from "@clerk/nextjs";

export const metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return <SignUp />;
}
