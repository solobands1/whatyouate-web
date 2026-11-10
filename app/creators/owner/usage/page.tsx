import type { Metadata } from "next";
import Shell from "../../../../components/creators/Shell";
import OwnerUsage from "../../../../components/creators/OwnerUsage";

export const metadata: Metadata = {
  title: "Users | WhatYouAte Creators",
  robots: { index: false },
};

export default function OwnerUsagePage() {
  return (
    <Shell signedIn full>
      <OwnerUsage />
    </Shell>
  );
}
