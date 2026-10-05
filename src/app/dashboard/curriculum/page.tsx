import { redirect } from "next/navigation";

// Curriculum became the Quizzes subtab of Pledgeship; keep old links working.
export default function CurriculumRedirect() {
  redirect("/dashboard/pledgeship?tab=quizzes");
}
