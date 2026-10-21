import type { Metadata } from "next";
import Shell from "../../../components/creators/Shell";
import Kit from "../../../components/creators/Kit";

export const metadata: Metadata = {
  title: "Creator Kit | WhatYouAte Creators",
  robots: { index: false },
};

export default function KitPage() {
  return (
    <Shell>
      <Kit />
    </Shell>
  );
}
