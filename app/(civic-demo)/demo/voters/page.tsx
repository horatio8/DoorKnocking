import { redirect } from "next/navigation";

// Promoted to /admin (real surface inherits the civic shell now).
export default function DemoVotersRedirect() {
  redirect("/admin");
}
