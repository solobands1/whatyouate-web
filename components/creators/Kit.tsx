"use client";

import Image from "next/image";
import { useState } from "react";
import { Card } from "./Shell";
import CodeCard from "./CodeCard";
import CreatorNav from "./CreatorNav";
import Gate from "./Gate";
import type { Dash } from "./api";
import { APP_STORE_URL, BODY, INK } from "../site";

const KIT = "/creators/kit";
const VIDEOS = [
  { slug: "log-a-meal", title: "Log A Meal In Seconds", note: "14 seconds" },
  { slug: "patterns", title: "What's Behind Your Low-Energy Days?", note: "15 seconds" },
  { slug: "nightly-check-in", title: "One Minute A Night", note: "15 seconds" },
];
const BRAND = [
  { file: "whatyouate-logo.png", label: "Logo", note: "Icon and name" },
  { file: "whatyouate-wordmark.png", label: "Wordmark", note: "Name only" },
  { file: "whatyouate-icon.png", label: "App Icon", note: "1024 x 1024" },
];
const SHOTS = Array.from({ length: 10 }, (_, i) => `whatyouate-${String(i + 1).padStart(2, "0")}`);

const IDEAS = [
  { hook: "I tracked what I ate and how I felt for two weeks. Here's what lined up.", how: "Show a few meals you logged, then the pattern the app found." },
  { hook: "Why I stopped guessing my trigger foods.", how: "Talk about what you tried before, then show your Patterns screen." },
  { hook: "The lunch that was wrecking my afternoons.", how: "Log your lunch, then show your energy check-in later that day." },
  { hook: "What I eat in a day, and how I actually felt after.", how: "A normal day of meals, logged as you go, with your nightly check-in at the end." },
  { hook: "One minute a night. Here's what it showed me.", how: "Film the nightly check-in, then what the app noticed after a week." },
];

const captions = (code: string) => [
  {
    label: "Instagram",
    text: `I've been logging what I eat and how I feel with WhatYouAte, and it's been eye-opening. It started showing me which foods leave me tired or bloated.\n\nUse code ${code} for your first month free. Link in my bio. @whatyouate.app\n\n#ad #foodjournal #guthealth`,
  },
  {
    label: "TikTok",
    text: `Two weeks of tracking my food and energy. Here's what lined up 👀 Code ${code} gets you a free month of @whatyouate. #ad #foodjournal #guthealth #whatieatinaday`,
  },
  {
    label: "Story",
    text: `Been using WhatYouAte to figure out what actually gives me energy. Code ${code} for a free month 👇 @whatyouate.app #ad`,
  },
];

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
    } catch {}
  };
  return { copied, copy };
}

function H2({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3 mt-11">
      <h2 className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>{children}</h2>
      {sub && <p className="mt-1 text-[14px] leading-[1.55]" style={{ color: BODY }}>{sub}</p>}
    </div>
  );
}

function SmallCopy({ on, onClick, label = "Copy" }: { on: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
      style={{ background: on ? "#15803D" : INK }}
    >
      {on ? "Copied" : label}
    </button>
  );
}

export default function Kit() {
  return <Gate>{(d) => <KitView C={d.creator} />}</Gate>;
}

function KitView({ C }: { C: Dash["creator"] }) {
  const { copied, copy } = useCopy();
  const link = `https://whatyouate.app/c/${C.code}`;

  return (
    <div>
      <CreatorNav />
      <h1 className="mt-8 text-[clamp(28px,4.4vw,40px)] font-bold leading-[1.1] tracking-[-0.04em]">Creator Kit</h1>
      <p className="mt-3 text-[16px] leading-[1.65]" style={{ color: BODY }}>
        Everything you need to share WhatYouAte: your links, a card to hand out, captions, post ideas, videos, logos and screenshots.
      </p>

      {/* Links */}
      <H2>Your Links</H2>
      <Card className="divide-y divide-[#16233B]/[0.06]">
        {[
          { key: "code", label: "Your Creator Code", value: C.code },
          { key: "link", label: "Your Link", value: link.replace("https://", "") },
          { key: "store", label: "App Store", value: "apps.apple.com/app/whatyouate", copyText: APP_STORE_URL },
        ].map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium" style={{ color: BODY }}>{r.label}</p>
              <p className="truncate text-[15.5px] font-semibold" style={{ color: INK }}>{r.value}</p>
            </div>
            <SmallCopy on={copied === r.key} onClick={() => copy(r.key, r.copyText ?? (r.key === "link" ? link : r.value))} />
          </div>
        ))}
      </Card>
      <p className="mt-2.5 text-[13px] leading-[1.55]" style={{ color: BODY }}>
        Put your link in your bio. It shows your followers your code and sends them to the App Store.
      </p>

      {/* Printable card */}
      <H2 sub="For clients, friends and anyone you see in person. They point their iPhone camera at the QR code and it opens your page.">Share In Person</H2>
      <CodeCard code={C.code} />

      {/* Captions */}
      <H2 sub="Your code is already filled in. Edit them so they sound like you.">Captions</H2>
      <div className="flex flex-col gap-3">
        {captions(C.code).map((c) => (
          <Card key={c.label} className="px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: "#8FA3C0" }}>{c.label}</p>
              <SmallCopy on={copied === c.label} onClick={() => copy(c.label, c.text)} />
            </div>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-[1.6]" style={{ color: INK }}>{c.text}</p>
          </Card>
        ))}
      </div>

      {/* Ideas */}
      <H2 sub="Use the app for a week or two first, so you have real patterns to show.">Post Ideas</H2>
      <Card className="divide-y divide-[#16233B]/[0.06]">
        {IDEAS.map((i) => (
          <div key={i.hook} className="px-6 py-4">
            <p className="text-[15.5px] font-semibold leading-[1.45]" style={{ color: INK }}>&ldquo;{i.hook}&rdquo;</p>
            <p className="mt-1 text-[14px] leading-[1.55]" style={{ color: BODY }}>{i.how}</p>
          </div>
        ))}
      </Card>

      {/* Talking points */}
      <H2>What To Say</H2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="px-6 py-5">
          <p className="text-[14px] font-bold" style={{ color: "#15803D" }}>Say</p>
          <ul className="mt-2.5 flex flex-col gap-2 text-[14.5px] leading-[1.55]" style={{ color: INK }}>
            <li>It&apos;s a food and feeling journal.</li>
            <li>You log meals, then a one-minute check-in at night.</li>
            <li>It shows what lines up with your good and bad days.</li>
            <li>My code gets you the first month free.</li>
          </ul>
        </Card>
        <Card className="px-6 py-5">
          <p className="text-[14px] font-bold" style={{ color: "#C2410C" }}>Don&apos;t Say</p>
          <ul className="mt-2.5 flex flex-col gap-2 text-[14.5px] leading-[1.55]" style={{ color: INK }}>
            <li>That it treats, cures or fixes anything, including IBS.</li>
            <li>That it&apos;s a diet or weight-loss app.</li>
            <li>That results are guaranteed.</li>
            <li>Anything that sounds like medical advice.</li>
          </ul>
        </Card>
      </div>

      {/* Disclosure */}
      <H2 sub="Required on every post, video and story that mentions WhatYouAte.">Label It As Sponsored</H2>
      <Card className="divide-y divide-[#16233B]/[0.06]">
        <div className="px-6 py-4">
          <p className="text-[15.5px] font-semibold" style={{ color: INK }}>Instagram</p>
          <p className="mt-1 text-[14px] leading-[1.55]" style={{ color: BODY }}>Turn on the paid partnership label when you post, or start your caption with #ad.</p>
        </div>
        <div className="px-6 py-4">
          <p className="text-[15.5px] font-semibold" style={{ color: INK }}>TikTok</p>
          <p className="mt-1 text-[14px] leading-[1.55]" style={{ color: BODY }}>Turn on Disclose post content and choose Branded content, or add #ad to your caption.</p>
        </div>
        <div className="px-6 py-4">
          <p className="text-[15.5px] font-semibold" style={{ color: INK }}>In Person Or By Message</p>
          <p className="mt-1 text-[14px] leading-[1.55]" style={{ color: BODY }}>Sharing with clients, friends or in a newsletter? Just mention that you earn a commission if they subscribe.</p>
        </div>
      </Card>

      {/* Tagging */}
      <H2 sub="So we can find your post, share it and thank you.">Tag Us</H2>
      <Card className="divide-y divide-[#16233B]/[0.06]">
        <div className="px-6 py-4">
          <p className="text-[15.5px] font-semibold" style={{ color: INK }}>Instagram</p>
          <p className="mt-1 text-[14px] leading-[1.55]" style={{ color: BODY }}>
            Tag @whatyouate.app, and invite @whatyouate.app as a collaborator (Tag people, then Invite collaborator). The post then shows on both accounts.
          </p>
        </div>
        <div className="px-6 py-4">
          <p className="text-[15.5px] font-semibold" style={{ color: INK }}>TikTok</p>
          <p className="mt-1 text-[14px] leading-[1.55]" style={{ color: BODY }}>Tag @whatyouate in your caption.</p>
        </div>
      </Card>

      {/* Videos */}
      <H2 sub="Real recordings of the app, sized 1080 x 1920 for TikTok, Instagram Reels and Stories. Post them as they are, no cropping needed. They're silent, so you can add your own sound or voiceover.">Videos</H2>
      <Card className="divide-y divide-[#16233B]/[0.06]">
        {VIDEOS.map((v) => (
          <div key={v.slug} className="flex items-center gap-4 px-5 py-4">
            <Image src={`${KIT}/thumbs/video-${v.slug}.jpg`} alt="" width={56} height={100} className="h-[100px] w-[56px] shrink-0 rounded-lg object-cover ring-1 ring-[#16233B]/[0.06]" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-[1.35]" style={{ color: INK }}>{v.title}</p>
              <p className="mt-0.5 text-[13px]" style={{ color: BODY }}>{v.note}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] font-semibold">
                <a href={`${KIT}/videos/whatyouate-${v.slug}.mp4`} download style={{ color: "#2F6FC4" }}>Ready To Post</a>
                <a href={`${KIT}/videos/screen-${v.slug}.mp4`} download style={{ color: "#2F6FC4" }}>Screen Only</a>
              </div>
            </div>
          </div>
        ))}
      </Card>
      <p className="mt-2.5 text-[13px] leading-[1.55]" style={{ color: BODY }}>
        Ready To Post has a headline and our logo at the end. Screen Only is just the app, to use in your own video.
      </p>

      {/* Logo */}
      <H2 sub="Transparent PNGs for light backgrounds. Some photo viewers show transparent areas as black, so the dark text can look hidden there. Once you add it to your post or design, it looks right.">Logo</H2>
      <Card className="divide-y divide-[#16233B]/[0.06]">
        {BRAND.map((b) => (
          <div key={b.file} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-28 shrink-0 items-center justify-center rounded-xl bg-white px-2 ring-1 ring-[#16233B]/[0.06]">
                <Image src={`${KIT}/brand/${b.file}?v=4`} alt="" width={96} height={40} className="max-h-10 w-auto object-contain" />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold" style={{ color: INK }}>{b.label}</p>
                <p className="text-[13px]" style={{ color: BODY }}>{b.note}</p>
              </div>
            </div>
            <a href={`${KIT}/brand/${b.file}?v=4`} download={b.file} className="shrink-0 text-[14px] font-semibold" style={{ color: "#2F6FC4" }}>Download</a>
          </div>
        ))}
      </Card>

      {/* Assets */}
      <H2 sub="Free to use in your posts.">Screenshots</H2>
      <Card className="px-5 py-5">
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
          {SHOTS.map((s) => (
            <a key={s} href={`${KIT}/screenshots/${s}.png`} download className="shrink-0 snap-start">
              <Image src={`${KIT}/thumbs/${s}.jpg`} alt="WhatYouAte screenshot" width={110} height={239} className="rounded-xl ring-1 ring-[#16233B]/[0.06]" />
            </a>
          ))}
        </div>
        <p className="mt-2 text-[13px]" style={{ color: BODY }}>App Store screenshots. Tap one to download it.</p>
        <a
          href={`${KIT}/whatyouate-creator-kit.zip`}
          download
          className="mt-5 flex w-full items-center justify-center rounded-full px-5 py-3.5 text-[14.5px] font-semibold text-white transition hover:opacity-90"
          style={{ background: INK }}
        >
          Download Everything (15 MB)
        </a>
      </Card>
    </div>
  );
}
