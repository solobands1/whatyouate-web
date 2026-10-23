import type { Metadata } from "next";
import Shell from "../../../components/creators/Shell";
import Owner from "../../../components/creators/Owner";

export const metadata: Metadata = {
  title: "Owner | WhatYouAte Creators",
  robots: { index: false },
};

export default function OwnerPage() {
  return (
    <Shell signedIn full>
      <Owner />
    </Shell>
  );
}
