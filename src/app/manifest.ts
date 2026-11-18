import type { MetadataRoute } from "next";

/** Installable app (P7.4). The share target lets phones send a text, link or creative to a new analysis. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/panel",
    name: "AdScope · Reklam ön kontrolü",
    short_name: "AdScope",
    description: "Reklamını yayınlamadan önce Meta, Google Ads, TikTok politikaları ve Türk reklam mevzuatına göre risk açısından kontrol et.",
    lang: "tr",
    dir: "ltr",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f7fb",
    theme_color: "#0b1b3f",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Yeni analiz", url: "/panel/yeni" },
      { name: "Ücretsiz hızlı kontrol", url: "/reklamim-reddedilir-mi" },
    ],
    share_target: {
      action: "/paylas",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "media", accept: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"] }] },
    },
  };
}
