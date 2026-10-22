import type { Metadata } from "next";
import { followerShareMeta } from "../../components/creators/shareMeta";
import SharePage from "../../components/creators/SharePage";

export const metadata: Metadata = {
  title: "Your First Month Free | WhatYouAte",
  description: "Get your first month of WhatYouAte free with a creator code.",
  ...followerShareMeta,
};

export default function Share() {
  return <SharePage />;
}
