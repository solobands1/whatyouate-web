import type { Metadata } from "next";
import Shell from "../../../components/creators/Shell";
import EmailTest from "../../../components/creators/EmailTest";

export const metadata: Metadata = {
  title: "Test Emails | WhatYouAte Creators",
  robots: { index: false },
};

export default function EmailTestPage() {
  return (
    <Shell narrow>
      <EmailTest />
    </Shell>
  );
}
