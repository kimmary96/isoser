import { permanentRedirect } from "next/navigation";

import { DEFAULT_PUBLIC_LANDING } from "@/lib/routes";

export default function HomePage() {
  permanentRedirect(DEFAULT_PUBLIC_LANDING);
}
