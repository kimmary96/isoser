import { redirect } from "next/navigation";

export default function NewActivityPage() {
  redirect("/dashboard/activities/__new__");
}
