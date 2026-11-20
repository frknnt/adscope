import type { MetadataRoute } from "next";
import { siteIndexable, siteUrl } from "@/lib/env";

/** Closed to search engines unless SITE_INDEXABLE=true (the site stays private until launch). */
export default function robots(): MetadataRoute.Robots {
  if (!siteIndexable()) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/panel", "/yonetim", "/api", "/inceleme", "/onay"] }, sitemap: `${siteUrl()}/sitemap.xml` };
}
