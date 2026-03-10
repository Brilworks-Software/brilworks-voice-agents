import { redirect } from "next/navigation";

export default function AuthSignInPage() {
  redirect("/auth/login");
}
