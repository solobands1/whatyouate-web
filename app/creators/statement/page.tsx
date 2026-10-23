import type { Metadata } from "next";
import Shell from "../../../components/creators/Shell";
import Statement from "../../../components/creators/Statement";

export const metadata: Metadata = {
  title: "Statement | WhatYouAte Creators",
  robots: { index: false },
};

export default function StatementPage() {
  return (
    <Shell signedIn wide>
      <Statement />
    </Shell>
  );
}
