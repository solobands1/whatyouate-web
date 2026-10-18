import type { Metadata } from "next";
import Shell, { Eyebrow } from "../../../components/creators/Shell";
import JoinForm from "../../../components/creators/JoinForm";
import { BODY } from "../../../components/site";

export const metadata: Metadata = {
  title: "Join | WhatYouAte Creators",
  description: "Join the WhatYouAte creator program and get your own code.",
};

export default function Join() {
  return (
    <Shell narrow>
      <Eyebrow>Creators</Eyebrow>
      <h1 className="mt-5 text-[clamp(30px,4.6vw,44px)] font-bold leading-[1.08] tracking-[-0.04em]">Get your code</h1>
      <p className="mt-4 text-[17px] leading-[1.7]" style={{ color: BODY }}>
        Takes about a minute. Your followers get their first month free with your code.
      </p>
      <div className="mt-9">
        <JoinForm />
      </div>
    </Shell>
  );
}
