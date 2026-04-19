import { redirect } from "next/navigation";

export default function NewSurveyRedirect() {
  redirect("/admin/surveys");
}
