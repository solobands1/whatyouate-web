import type { MetadataRoute } from "next";

// Built into /sitemap.xml at build time (the site is a static export). Public pages only: creator
// accounts, the dashboard, kit and profile are behind a login, and /c/CODE pages are per creator.
export const dynamic = "force-static";

const BASE = "https://whatyouate.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/games`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/games/snack-merge`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/games/beat-the-crash`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/games/cart-rush`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/games/berry-dash`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/games/food-fling`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/games/food-fight`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/games/sugar-showdown`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/games/fridge-raid`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/games/pea-tanks`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/games/food-rally`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/games/kitchen-golf`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/creators`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/creators/example`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/creators/join`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE}/creators/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
