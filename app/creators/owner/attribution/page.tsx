import type { Metadata } from "next";
import Shell from "../../../../components/creators/Shell";
import OwnerAttribution from "../../../../components/creators/OwnerAttribution";

export const metadata: Metadata = {
  title: "Attribution | WhatYouAte Creators",
  robots: { index: false },
};

export default function OwnerAttributionPage() {
  return (
    <Shell signedIn full>
      <OwnerAttribution />
    </Shell>
  );
}
