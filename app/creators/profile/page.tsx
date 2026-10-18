import type { Metadata } from "next";
import Shell, { Eyebrow } from "../../../components/creators/Shell";
import ProfileForm from "../../../components/creators/ProfileForm";

export const metadata: Metadata = {
  title: "Profile | WhatYouAte Creators",
  robots: { index: false },
};

export default function Profile() {
  return (
    <Shell narrow>
      <Eyebrow>Creator dashboard</Eyebrow>
      <h1 className="mt-5 text-[clamp(30px,4.6vw,44px)] font-bold leading-[1.08] tracking-[-0.04em]">Your profile</h1>
      <div className="mt-9">
        <ProfileForm />
      </div>
    </Shell>
  );
}
