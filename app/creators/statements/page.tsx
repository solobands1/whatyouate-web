import type { Metadata } from "next";
import Shell from "../../../components/creators/Shell";
import Statements from "../../../components/creators/Statement";

export const metadata: Metadata = {
  title: "Statements | WhatYouAte Creators",
  robots: { index: false },
};

export default function StatementsPage() {
  return (
    <Shell signedIn wide>
      <Statements />
    </Shell>
  );
}
