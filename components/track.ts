// Light, privacy-friendly traffic counting for whatyouate.app. Each event adds 1 to a daily count in
// public.web_events_daily (app repo: supabase/attribution.sql). Nothing about the visitor is sent or kept: no cookies,
// no ids, no IP, no user agent. Only (today, source, event, page) and a +1.
//
// A browser session gets one source, picked once and kept in sessionStorage (so it ends when the tab closes):
//   1. a short link (/play, /tt, /yt, /ig, /fb; see SHORT_LINKS), ?via=share on links people share, or ?src=<source>
//   2. otherwise where the visitor came from (document.referrer, or the in-app browser's name when there's no referrer)
// Every event that session carries that source, so the owner page can say "TikTok brought 40 visits and 3 App Store taps".
//
// Everything here is safe to call anywhere: it never throws, does nothing during prerender, and if the database
// function isn't installed yet the calls just fail quietly.
import { SUPABASE_URL, SUPABASE_KEY } from "./supabaseConfig";
import { appStoreLink, APP_STORE_URL } from "./site";
import { GAMES } from "./games/catalog";

export type TrackEvent = "visit" | "game_open" | "game_play" | "app_click" | "share";

// Keep in step with the list in web_event (attribution.sql). Anything else is sent as "other".
const SOURCES = [
  "tiktok", "youtube", "instagram", "facebook", "video", "tiktok-video", "youtube-video", "instagram-video",
  "share", "google", "other-search", "direct", "other",
] as const;
export type Source = (typeof SOURCES)[number];

/** The short links. Each is a tiny page (app/<name>/page.tsx) that counts the visit, then sends people on.
 *  `path` is the page the visit is counted under (the database only knows /, /games and /play; anything else is
 *  /other). `app` links also count an App Store tap and go straight on to the App Store. */
type ShortLinkDef = { to: string; source: Source; label: string; path?: string; app?: boolean };
export const SHORT_LINKS = {
  "/play": { to: "/games", source: "video", label: "the games", path: "/play" },   // the end card on the game videos
  "/tt": { to: "/", source: "tiktok", label: "WhatYouAte" },       // bio links
  "/yt": { to: "/", source: "youtube", label: "WhatYouAte" },
  "/ig": { to: "/", source: "instagram", label: "WhatYouAte" },
  "/fb": { to: "/", source: "facebook", label: "WhatYouAte" },
  // Instagram's bio has room for several links: the app, the games and the creator program, each counted as Instagram
  "/ig/app": { to: APP_STORE_URL, source: "instagram", label: "the App Store", app: true },
  "/ig/play": { to: "/games", source: "instagram", label: "the games", path: "/games" },
  "/ig/creators": { to: "/creators", source: "instagram", label: "the Creators Program", path: "/other" },
  // TikTok has one bio link (/tt); these are there for when it should point somewhere else
  "/tt/app": { to: APP_STORE_URL, source: "tiktok", label: "the App Store", app: true },
  "/tt/play": { to: "/games", source: "tiktok", label: "the games", path: "/games" },
  "/tt/creators": { to: "/creators", source: "tiktok", label: "the Creators Program", path: "/other" },
} satisfies Record<string, ShortLinkDef>;
export type ShortLinkPath = keyof typeof SHORT_LINKS;

/** Where a short link ends up: a page on the site, or for an app link the App Store, tagged "bio-<source>". */
export function shortLinkTarget(from: ShortLinkPath): string {
  const link: ShortLinkDef = SHORT_LINKS[from];
  return link.app ? appStoreLink(`bio-${link.source}`) : link.to;
}

const PREFIX = "wya-t:";
const GAME_SLUGS = new Set(GAMES.map((g) => g.slug));

// ---- Small safe helpers ------------------------------------------------------------------

const inBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

// sessionStorage can be missing or throw (private mode, blocked storage). Fall back to memory for this page load.
const memory = new Map<string, string>();
function read(key: string): string | null {
  try { return window.sessionStorage.getItem(PREFIX + key) ?? memory.get(key) ?? null; } catch { return memory.get(key) ?? null; }
}
function write(key: string, value: string) {
  memory.set(key, value);
  try { window.sessionStorage.setItem(PREFIX + key, value); } catch {}
}

/** Counts only on the real site. Local dev and preview links print to the console instead of touching the numbers. */
function isLive() {
  try { return /(^|\.)whatyouate\.app$/.test(window.location.hostname); } catch { return false; }
}

function clampSource(v: string | null | undefined): Source {
  const s = (v ?? "").trim().toLowerCase();
  return (SOURCES as readonly string[]).includes(s) ? (s as Source) : "other";
}

// ---- Where the visitor came from ---------------------------------------------------------

type Platform = "tiktok" | "youtube" | "instagram" | "facebook";

/** The app whose in-app browser this is, when it says so in its name. Used only to classify, never sent. */
function inAppBrowser(): Platform | null {
  try {
    const ua = navigator.userAgent;
    if (/musical_ly|Bytedance|TikTok/i.test(ua)) return "tiktok";
    if (/Instagram/i.test(ua)) return "instagram";
    if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "facebook";
  } catch {}
  return null;
}

/** "self" for our own pages, null when there's no referrer. */
function referrerKind(): Platform | "google" | "other-search" | "other" | "self" | null {
  let host = "";
  try {
    if (!document.referrer) return null;
    host = new URL(document.referrer).hostname.toLowerCase();
  } catch { return null; }
  const is = (d: string) => host === d || host.endsWith(`.${d}`);
  if (is("whatyouate.app")) return "self";
  if (is("tiktok.com")) return "tiktok";
  if (is("youtube.com") || is("youtu.be")) return "youtube";
  if (is("instagram.com")) return "instagram";
  if (is("facebook.com") || is("fb.com") || is("fb.me") || is("messenger.com")) return "facebook";
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return "google";
  if (is("bing.com") || is("duckduckgo.com") || is("search.yahoo.com") || is("ecosia.org") || is("search.brave.com") || is("yandex.com") || is("startpage.com")) return "other-search";
  return "other";
}

/** The platform behind a click, from the referrer or the in-app browser. */
function platform(): Platform | null {
  const r = referrerKind();
  if (r === "tiktok" || r === "youtube" || r === "instagram" || r === "facebook") return r;
  return inAppBrowser();
}

/** A source named in the address: ?via=share on shared links, or ?src=<source>. */
function sourceFromAddress(): Source | null {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("via") === "share") return "share";
    const src = q.get("src");
    if (src) return clampSource(src);
  } catch {}
  return null;
}

function sourceFromReferrer(): Source {
  const r = referrerKind();
  if (r && r !== "self") return r;
  return inAppBrowser() ?? "direct";
}

/** This session's source. The address wins (a short link or a shared link is a clear signal); otherwise it's set once. */
export function sessionSource(): Source {
  if (!inBrowser()) return "direct";
  const named = sourceFromAddress();
  if (named) { write("src", named); return named; }
  const kept = read("src");
  if (kept) return clampSource(kept);
  const found = sourceFromReferrer();
  write("src", found);
  return found;
}

// ---- Pages -------------------------------------------------------------------------------

/** The page as the database counts it: /, /games, /games/<slug>, /play, or /other for everything else. */
export function trackPath(pathname: string): string {
  const p = (pathname || "/").replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/games" || p === "/play") return p;
  const m = /^\/games\/([a-z0-9-]+)$/.exec(p);
  if (m) return GAME_SLUGS.has(m[1]) ? p : "/games/other";
  return "/other";
}

/** The creator and owner area is private and isn't counted. */
const skipped = (pathname: string) => pathname.startsWith("/creators");

// ---- Sending -----------------------------------------------------------------------------

/** Adds 1 to today's count. Resolves either way; never rejects. `keepalive` lets it finish while the page is leaving. */
function send(event: TrackEvent, source: Source, path: string, keepalive = false): Promise<void> {
  if (!inBrowser()) return Promise.resolve();
  if (!isLive()) {
    try { console.debug("[track]", event, source, path); } catch {}
    return Promise.resolve();
  }
  try {
    return fetch(`${SUPABASE_URL}/rest/v1/rpc/web_event`, {
      method: "POST",
      keepalive,
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_source: source, p_event: event, p_path: path.slice(0, 64) }),
    }).then(() => undefined, () => undefined);
  } catch {
    return Promise.resolve();
  }
}

/** Counts one event for this session's source. With `once`, only the first call per browser session counts. */
export function track(event: TrackEvent, opts: { path?: string; once?: string; keepalive?: boolean } = {}): Promise<void> {
  try {
    if (!inBrowser()) return Promise.resolve();
    const pathname = window.location.pathname;
    if (skipped(pathname)) return Promise.resolve();
    if (opts.once) {
      if (read(`once:${opts.once}`)) return Promise.resolve();
      write(`once:${opts.once}`, "1");
    }
    return send(event, sessionSource(), opts.path ?? trackPath(pathname), opts.keepalive);
  } catch {
    return Promise.resolve();
  }
}

/** Called on every page change (components/Tracker.tsx): the visit, once per source, and the game opened, once per game. */
export function pageView(pathname: string) {
  try {
    if (!inBrowser() || skipped(pathname) || pathname in SHORT_LINKS) return;
    const source = sessionSource();
    track("visit", { once: `visit:${source}`, path: trackPath(pathname) });
    const m = /^\/games\/([a-z0-9-]+)\/?$/.exec(pathname);
    if (m && GAME_SLUGS.has(m[1])) track("game_open", { once: `open:${m[1]}`, path: `/games/${m[1]}` });
  } catch {}
}

/** The first finished round of a game this session (called from the shared game kit). */
export function trackGamePlay(game: string) {
  if (GAME_SLUGS.has(game)) track("game_play", { once: `play:${game}`, path: `/games/${game}` });
}

/** The short link pages: set the source, count the visit, then replace the address with the real page. */
export function followShortLink(from: ShortLinkPath) {
  if (!inBrowser()) return;
  const link: ShortLinkDef = SHORT_LINKS[from];
  const go = () => { try { window.location.replace(shortLinkTarget(from)); } catch {} };
  try {
    let source: Source = link.source;
    // The game videos' end card: say which app the video was watched in when we can tell.
    if (from === "/play") {
      const p = platform();
      if (p === "tiktok" || p === "youtube" || p === "instagram") source = `${p}-video`;
    }
    write("src", source);
    write(`once:visit:${source}`, "1");
    const counted = [send("visit", source, link.path ?? "/", true)];
    if (link.app) counted.push(send("app_click", source, link.path ?? "/", true));
    const sent = Promise.all(counted);
    // Give the count a moment to leave (it can also finish after we've moved on), then go.
    Promise.race([sent, new Promise((r) => setTimeout(r, 600))]).then(go, go);
  } catch {
    go();
  }
}

// ---- App Store and share links -----------------------------------------------------------

/** The App Store campaign for a page plus this session's source, e.g. "games-snack-merge-tiktok". Apple allows 40 characters. */
export function campaignWithSource(base: string): string {
  const source = inBrowser() ? sessionSource() : "direct";
  const b = (GAME_SLUGS.has(base) ? `games-${base}` : base).replace(/[^a-z0-9-]/gi, "").toLowerCase() || "site";
  return `${b.slice(0, 40 - source.length - 1)}-${source}`;
}

function pageCampaign(pathname: string): string {
  const p = (pathname || "/").replace(/\/+$/, "");
  if (!p) return "home";
  if (p.startsWith("/c/") || p === "/c") return "creator-page";
  return p.slice(1).split("/").join("-").slice(0, 24);
}

/** One click listener for the whole site (components/Tracker.tsx). Any App Store link gets this session's source added to
 *  its campaign just before it opens, and the tap is counted. Offer-code redeem links are left alone. */
export function onDocumentClick(e: MouseEvent) {
  try {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const a = target.closest("a[href]");
    if (!(a instanceof HTMLAnchorElement)) return;
    const url = new URL(a.href);
    if (url.hostname !== "apps.apple.com" || !url.pathname.includes("/app/")) return;
    if (skipped(window.location.pathname)) return;
    const base = a.dataset.wyaCt || url.searchParams.get("ct") || pageCampaign(window.location.pathname);
    a.dataset.wyaCt = base;
    a.href = appStoreLink(campaignWithSource(base));
    track("app_click", { keepalive: true });
  } catch {}
}

/** Adds ?via=share to every whatyouate.app link in a share message, so visits from shared scores and rooms count as shares. */
export function tagShareText(text: string): string {
  try {
    return text.replace(
      /((?:https?:\/\/)?(?:www\.)?whatyouate\.app)(\/[^\s?#]*)?(\?[^\s#]*)?/gi,
      (m: string, host: string, path: string | undefined, query: string | undefined, at: number) =>
        /[\w@.-]/.test(text.charAt(at - 1)) || (query && /[?&]via=/.test(query)) ? m   // part of an email or another domain, or already tagged
          : `${host}${path || "/"}${query ? `${query}&` : "?"}via=share`,
    );
  } catch {
    return text;
  }
}
