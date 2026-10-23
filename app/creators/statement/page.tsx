import type { Metadata } from "next";
import Redirect from "../../../components/creators/Redirect";

// The old single live statement; statements are now issued per payout at /creators/statements.
export const metadata: Metadata = { title: "Statements | WhatYouAte Creators", robots: { index: false } };

export default function OldStatement() {
  return <Redirect to="/creators/statements" />;
}
