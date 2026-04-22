import { redirect } from "next/navigation";

import { DEFAULT_PUBLIC_LANDING } from "@/lib/routes";

export default function HomePage() {
  redirect(DEFAULT_PUBLIC_LANDING);
}
