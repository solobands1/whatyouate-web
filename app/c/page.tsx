import type { Metadata } from "next";
import SharePage from "../../components/creators/SharePage";

export const metadata: Metadata = {
  title: "Your first month free | WhatYouAte",
  description: "Get your first month of WhatYouAte free with a creator code.",
};

export default function Share() {
  return <SharePage />;
}
