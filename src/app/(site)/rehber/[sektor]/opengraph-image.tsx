import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { GUIDE_SLUGS, isGuideSlug } from "@/lib/guides/guides";
import { SECTOR_INFO } from "@/lib/sectors";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AdScope sektör rehberi";

export function generateStaticParams() {
  return Object.keys(GUIDE_SLUGS).map((sektor) => ({ sektor }));
}

export default async function Image({ params }: { params: Promise<{ sektor: string }> }) {
  const { sektor } = await params;
  const label = isGuideSlug(sektor) ? SECTOR_INFO[GUIDE_SLUGS[sektor]].long : "Reklam";
  const font = await readFile(join(process.cwd(), "assets/fonts/creative/manrope-800.ttf"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0b1b3f", color: "#fbf8f3", fontFamily: "Manrope" }}>
        <div style={{ fontSize: 34, color: "#ff8a6e" }}>AdScope · Sektör rehberi</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 76, lineHeight: 1.05 }}>{label}</div>
          <div style={{ fontSize: 40, color: "#d6dcea" }}>Riskli ifadeler, güvenli yazım ve resmî kaynaklar</div>
        </div>
        <div style={{ fontSize: 26, color: "#aab4cc" }}>Risk değerlendirmesidir, hukuki görüş değildir.</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Manrope", data: font, weight: 800, style: "normal" }] },
  );
}
