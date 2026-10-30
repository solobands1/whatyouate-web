import type { Metadata } from "next";
import Shell from "../../../../components/creators/Shell";
import OwnerOutreach from "../../../../components/creators/OwnerOutreach";

export const metadata: Metadata = {
  title: "Outreach | WhatYouAte Creators",
  robots: { index: false },
};

export default function OwnerOutreachPage() {
  return (
    <Shell signedIn full>
      <OwnerOutreach />
    </Shell>
  );
}
