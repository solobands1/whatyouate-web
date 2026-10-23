"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Menu from "../Menu";
import { isOwner, signOut } from "./api";

/**
 * The header menu on signed-in creator pages: Support and Log Out, nothing from the public site.
 * Owners also get links to the owner page and their own dashboard.
 */
export default function CreatorMenu() {
  const router = useRouter();
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    isOwner().then(setOwner);
  }, []);
  const links = [
    ...(owner
      ? [
          { label: "Owner", href: "/creators/owner" },
          { label: "Dashboard", href: "/creators/dashboard" },
        ]
      : []),
    { label: "Support", href: "mailto:support@whatyouate.app" },
  ];
  return (
    <Menu
      links={links}
      onLogOut={async () => {
        await signOut().catch(() => {});
        router.push("/creators/login");
      }}
    />
  );
}
