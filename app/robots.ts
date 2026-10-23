import type { MetadataRoute } from "next";

// Built into /robots.txt. Creator account pages are private and stay out of search.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/creators/dashboard", "/creators/kit", "/creators/profile", "/creators/login", "/creators/email-test", "/creators/statement"],
    },
    sitemap: "https://whatyouate.app/sitemap.xml",
  };
}
