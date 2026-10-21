import type { Metadata } from "next";
import Shell, { Eyebrow } from "../../../components/creators/Shell";
import LoginForm from "../../../components/creators/LoginForm";

export const metadata: Metadata = {
  title: "Log In | WhatYouAte Creators",
  description: "Log in to your WhatYouAte creator dashboard.",
};

export default function Login() {
  return (
    <Shell narrow>
      <div className="-mt-8 sm:-mt-12">
      <Eyebrow>Creators</Eyebrow>
      <h1 className="mt-5 text-[clamp(30px,4.6vw,44px)] font-bold leading-[1.08] tracking-[-0.04em]">Log In</h1>
      <div className="mt-9">
        <LoginForm />
      </div>
      </div>
    </Shell>
  );
}
