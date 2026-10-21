import type { Metadata } from "next";
import Shell from "../../../components/creators/Shell";
import ExampleDashboard from "../../../components/creators/ExampleDashboard";

export const metadata: Metadata = {
  title: "Example Dashboard | WhatYouAte Creators",
  description: "See what the WhatYouAte creator dashboard looks like, with example numbers.",
};

export default function ExamplePage() {
  return (
    <Shell>
      <ExampleDashboard />
    </Shell>
  );
}
