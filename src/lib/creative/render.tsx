import "server-only";
import { ImageResponse } from "next/og";
import type { LoadedFont } from "./fonts";
import type { Plan, PlanElement } from "./layouts";

function el(e: PlanElement, s: number, logo: string | null, i: number) {
  switch (e.kind) {
    case "rect":
      return <div key={i} style={{ position: "absolute", left: e.x * s, top: e.y * s, width: e.w * s, height: e.h * s, background: e.fill, borderRadius: (e.radius ?? 0) * s }} />;
    case "circle":
      return <div key={i} style={{ position: "absolute", left: (e.cx - e.r) * s, top: (e.cy - e.r) * s, width: e.r * 2 * s, height: e.r * 2 * s, background: e.fill, borderRadius: e.r * s }} />;
    case "logo":
      if (!logo) return null;
      return (
        <div key={i} style={{ position: "absolute", left: e.x * s, top: e.y * s, width: e.size * s, height: e.size * s, background: "#ffffff", borderRadius: e.size * 0.22 * s, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={e.size * 0.78 * s} height={e.size * 0.78 * s} style={{ objectFit: "contain" }} />
        </div>
      );
    case "image":
      return (
        <div key={i} style={{ position: "absolute", left: e.x * s, top: e.y * s, width: e.w * s, height: e.h * s, display: "flex", overflow: "hidden", borderRadius: (e.radius ?? 0) * s }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={e.src} alt="" width={e.w * s} height={e.h * s} style={{ width: e.w * s, height: e.h * s, objectFit: e.fit }} />
        </div>
      );
    case "text":
      return (
        <div key={i} style={{ position: "absolute", left: e.x * s, top: e.y * s, width: e.w * s, display: "flex", flexDirection: "column", alignItems: e.align === "center" ? "center" : "flex-start", fontFamily: e.font ? `F-${e.font}` : "Brand" }}>
          {e.lines.map((line, j) => (
            <div
              key={j}
              style={{
                display: "flex",
                whiteSpace: "pre",
                fontSize: e.size * s,
                fontWeight: e.weight,
                color: e.color,
                height: e.size * e.lineHeight * s,
                lineHeight: `${e.size * e.lineHeight * s}px`,
                textDecoration: e.underline ? "underline" : "none",
              }}
            >
              {line}
            </div>
          ))}
        </div>
      );
  }
}

/**
 * Renders a plan to PNG with the brand font embedded. `scale` < 1 is used for previews.
 * `extraFonts` are the other families an editor layer may name (`font` on a text element).
 */
export async function renderPlanPng(plan: Plan, font: LoadedFont, opts: { scale?: number; logoDataUrl?: string | null; extraFonts?: LoadedFont[] } = {}): Promise<Uint8Array> {
  const s = opts.scale ?? 1;
  const width = Math.round(plan.w * s);
  const height = Math.round(plan.h * s);
  const res = new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width, height, background: plan.background, fontFamily: "Brand", overflow: "hidden" }}>
        {plan.elements.map((e, i) => el(e, s, opts.logoDataUrl ?? null, i))}
      </div>
    ),
    {
      width,
      height,
      fonts: [
        { name: "Brand", data: font.regular.data, weight: 400, style: "normal" },
        { name: "Brand", data: font.bold.data, weight: 800, style: "normal" },
        ...(opts.extraFonts ?? []).flatMap((f) => [
          { name: `F-${f.id}`, data: f.regular.data, weight: 400 as const, style: "normal" as const },
          { name: `F-${f.id}`, data: f.bold.data, weight: 800 as const, style: "normal" as const },
        ]),
      ],
    },
  );
  return new Uint8Array(await res.arrayBuffer());
}
