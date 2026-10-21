import type { Metadata } from "next";
import Shell from "../../../components/creators/Shell";
import Dashboard from "../../../components/creators/Dashboard";

export const metadata: Metadata = {
  title: "Dashboard | WhatYouAte Creators",
  robots: { index: false },
};

export default function DashboardPage() {
  return (
    <Shell>
      <Dashboard />
    </Shell>
  );
}
