import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { GUIDE_SLUGS } from "@/lib/guides/guides";

const PUBLIC = ["/", "/nasil-calisir", "/fiyatlandirma", "/kurallar", "/reklamim-reddedilir-mi", "/reklam-butce-hesaplama", "/rehber", "/gizlilik", "/kvkk", "/kullanim-kosullari"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [...PUBLIC, ...Object.keys(GUIDE_SLUGS).map((s) => `/rehber/${s}`)].map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly", priority: p === "/" ? 1 : 0.6 }));
}
