import type { Metadata } from "next";
import Shell from "../../../../components/creators/Shell";
import OwnerReport from "../../../../components/creators/OwnerReport";

export const metadata: Metadata = {
  title: "Report | WhatYouAte Creators",
  robots: { index: false },
};

export default function OwnerReportPage() {
  return (
    <Shell signedIn wide>
      <OwnerReport />
    </Shell>
  );
}
