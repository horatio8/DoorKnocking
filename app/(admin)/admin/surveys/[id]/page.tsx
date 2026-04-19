import { redirect } from "next/navigation";

export default function SurveyDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/admin/surveys/${params.id}/edit`);
}
