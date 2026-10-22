"use client";

import { useRouter } from "next/navigation";
import Menu from "../Menu";
import { signOut } from "./api";

/** The header menu on signed-in creator pages: Support and Log Out, nothing from the public site. */
export default function CreatorMenu() {
  const router = useRouter();
  return (
    <Menu
      links={[{ label: "Support", href: "mailto:support@whatyouate.app" }]}
      onLogOut={async () => {
        await signOut().catch(() => {});
        router.push("/creators/login");
      }}
    />
  );
}
