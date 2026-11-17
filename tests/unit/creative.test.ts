import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { unzipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRAND_FONT_IDS } from "@/lib/brand/kit";
import { loadCreativeFont } from "@/lib/creative/fonts";
import { buildPlan, LAYOUT_IDS, LAYOUTS, planWarnings, type Plan, type PlanInput } from "@/lib/creative/layouts";
import { CREATIVE_SIZE_IDS, CREATIVE_SIZES, STORY_UNSAFE } from "@/lib/creative/sizes";
import { cleanForFont, fitBlock, measurer, wrap } from "@/lib/creative/text-fit";
import { parseTtf } from "@/lib/creative/ttf";

const jars: Record<string, Map<string, string>> = { a: new Map() };
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jars.a.has(k) ? { name: k, value: jars.a.get(k)! } : undefined),
    set: (k: string, v: string) => void jars.a.set(k, v),
    delete: (k: string) => void jars.a.delete(k),
  }),
}));

const TURKISH = "çğıöşüÇĞİÖŞÜâîû";
const font = (id: string, w: 400 | 800) => parseTtf(readFileSync(`assets/fonts/creative/${id}-${w}.ttf`));

async function input(over: Partial<PlanInput> = {}): Promise<PlanInput> {
  const f = await loadCreativeFont("manrope");
  return {
    headline: "Sabahları ışıldayan cilt için hafif bakım",
    body: "Günlük nemlendirici, şişe başına 60 gün yeter.",
    cta: "Hemen incele",
    brandName: "Çınar Kozmetik",
    tagline: "Doğal ışıltı",
    note: "Kampanya stokla sınırlıdır.",
    primary: "#0b1b3f",
    secondary: "#ff6a4d",
    hasLogo: true,
    regular: f.regular.m,
    bold: f.bold.m,
    ...over,
  };
}

function textBoxes(plan: Plan) {
  return plan.elements.flatMap((e) => (e.kind === "text" ? [{ ...e, h: e.lines.length * e.size * e.lineHeight }] : []));
}

describe("creative fonts and text fitting", () => {
  it("every brand font ships both weights with the full Turkish alphabet", () => {
    for (const id of BRAND_FONT_IDS) {
      for (const w of [400, 800] as const) {
        const m = font(id, w);
        const missing = [...TURKISH].filter((c) => !m.hasChar(c.codePointAt(0)!));
        expect(missing, `${id}-${w}`).toEqual([]);
        expect(m.advance("İ".codePointAt(0)!)).toBeGreaterThan(0);
      }
    }
  });

  it("drops characters the font cannot draw and spells out the lira sign when needed", () => {
    const playfair = [measurer(font("playfair-display", 400)), measurer(font("playfair-display", 800))];
    expect(cleanForFont("Yaz indirimi 😀 399 ₺", playfair)).toEqual({ text: "Yaz indirimi 399 TL", dropped: true });
    expect(cleanForFont("Şık, güçlü ve ılık", playfair)).toEqual({ text: "Şık, güçlü ve ılık", dropped: false });
  });

  it("wraps within the width and shortens text that cannot fit", () => {
    const m = measurer(font("inter", 800));
    const lines = wrap(m, "Sabahları ışıldayan cilt için hafif bakım", 60, 400);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(m.width(l, 60)).toBeLessThanOrEqual(400);
    const fit = fitBlock(m, "çok ".repeat(80).trim(), { maxSize: 80, minSize: 40, width: 400, maxLines: 3, lineHeight: 1.1 });
    expect(fit.overflow).toBe(true);
    expect(fit.lines).toHaveLength(3);
    expect(fit.lines[2].endsWith("…")).toBe(true);
    const ok = fitBlock(m, "Kısa başlık", { maxSize: 80, minSize: 40, width: 600, maxLines: 3, lineHeight: 1.1 });
    expect(ok).toMatchObject({ overflow: false, size: 80 });
  });
});

describe("creative layouts", () => {
  it("offers at least eight distinct layouts in four sizes", () => {
    expect(LAYOUTS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(LAYOUT_IDS).size).toBe(LAYOUT_IDS.length);
    expect(CREATIVE_SIZES.kare).toMatchObject({ w: 1080, h: 1080 });
    expect(CREATIVE_SIZES.dikey).toMatchObject({ w: 1080, h: 1350 });
    expect(CREATIVE_SIZES.hikaye).toMatchObject({ w: 1080, h: 1920 });
    expect(CREATIVE_SIZES.yatay).toMatchObject({ w: 1200, h: 628 });
  });

  it("keeps every text inside the canvas and the 9:16 safe area, without overflow, for ordinary text", async () => {
    const base = await input();
    for (const layout of LAYOUT_IDS) {
      for (const size of CREATIVE_SIZE_IDS) {
        const plan = buildPlan(layout, size, base);
        const where = `${layout}/${size}`;
        expect(plan.overflow, where).toEqual([]);
        for (const t of textBoxes(plan)) {
          expect(t.x, where).toBeGreaterThanOrEqual(0);
          expect(t.x + t.w, where).toBeLessThanOrEqual(plan.w + 1);
          expect(t.y, where).toBeGreaterThanOrEqual(0);
          expect(t.y + t.h, where).toBeLessThanOrEqual(plan.h + 1);
          for (const line of t.lines) expect((t.weight === 800 ? base.bold : base.regular).width(line, t.size), `${where} ${t.role}`).toBeLessThanOrEqual(t.w + 1);
        }
        expect(planWarnings(plan, size), where).toEqual([]);
        expect(textBoxes(plan).some((t) => t.role === "headline" && t.lines.join(" ").includes("ışıldayan"))).toBe(true);
      }
    }
  });

  it("warns when the text is too long for a layout", async () => {
    const long = await input({ headline: "Bu yaz sezonunun en hafif, en ferah ve en uzun süre kalıcı nemlendiricisi şimdi yüzde yirmi indirimle", body: "Uzun açıklama ".repeat(20) });
    const warnings = LAYOUT_IDS.flatMap((l) => planWarnings(buildPlan(l, "yatay", long), "yatay"));
    expect(warnings.some((w) => w.kind === "overflow")).toBe(true);
  });

  it("flags text in the story's unsafe bands and low-contrast text", () => {
    const plan: Plan = {
      w: 1080,
      h: 1920,
      background: "#ffffff",
      overflow: [],
      elements: [
        { kind: "text", role: "brand", x: 80, y: 60, w: 400, lines: ["Çınar"], size: 40, weight: 800, color: "#0b1b3f", on: "#ffffff", align: "left", lineHeight: 1.2 },
        { kind: "text", role: "body", x: 80, y: 900, w: 900, lines: ["Soluk metin"], size: 40, weight: 400, color: "#dddddd", on: "#ffffff", align: "left", lineHeight: 1.3 },
      ],
    };
    const w = planWarnings(plan, "hikaye");
    expect(w.find((x) => x.kind === "safe_area")?.message).toContain(`${STORY_UNSAFE.top}`);
    expect(w.find((x) => x.kind === "contrast")?.message).toContain("Metin");
    expect(planWarnings(plan, "kare").some((x) => x.kind === "safe_area")).toBe(false);
  });

  it("renders a PNG of the exact size with Turkish text", async () => {
    const { renderPlanPng } = await import("@/lib/creative/render");
    const f = await loadCreativeFont("manrope");
    const plan = buildPlan("manset", "yatay", await input({ hasLogo: false, headline: "Ğüşİöç ılık İstanbul" }));
    const png = await renderPlanPng(plan, f, { scale: 0.5 });
    expect([...png.slice(1, 4)].map((c) => String.fromCharCode(c)).join("")).toBe("PNG");
    const v = new DataView(png.buffer, png.byteOffset);
    expect([v.getUint32(16), v.getUint32(20)]).toEqual([600, 314]);
  });
});

describe("creative download credits (memory backend)", () => {
  beforeEach(async () => {
    const { __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
    __resetMemoryStoreForTests();
    jars.a.clear();
  });

  async function signedIn() {
    const { MemoryRepo } = await import("@/lib/data/memory-repo");
    const repo = new MemoryRepo();
    await repo.signUp({ email: "gorsel@example.com", password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
    return repo;
  }
  const req = { brandId: null, platform: "meta" as const, sector: "genel" as const, headline: "Yaz koleksiyonu geldi", body: "Hafif kumaşlar, ferah renkler.", cta: "Keşfet" };

  it("charges one credit once per request and stores a private ZIP with all four sizes", async () => {
    const { exportCreative } = await import("@/lib/creative/service");
    const repo = await signedIn();
    const before = await repo.getBalance();
    const id = randomUUID();
    const a = await exportCreative(repo, { requestId: id, layout: "etiket", size: "hepsi", req });
    const b = await exportCreative(repo, { requestId: id, layout: "etiket", size: "hepsi", req });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.generation.id).toBe(a.generation.id);
    expect(await repo.getBalance()).toBe(before - 1);
    const files = a.generation.output.files as { path: string; name: string }[];
    expect(files).toHaveLength(1);
    const file = await repo.readGenerationFile(a.generation.id, files[0].path);
    expect(file?.mime).toBe("application/zip");
    expect(Object.keys(unzipSync(file!.bytes)).sort()).toEqual(["adscope-etiket-1080x1080.png", "adscope-etiket-1080x1350.png", "adscope-etiket-1080x1920.png", "adscope-etiket-1200x628.png"]);
    // A path that is not listed in the generation is never served.
    expect(await repo.readGenerationFile(a.generation.id, files[0].path.replace(/[^/]+$/, "baska.png"))).toBeNull();
  });

  it("refuses without credit and stores nothing", async () => {
    const { exportCreative } = await import("@/lib/creative/service");
    const repo = await signedIn();
    const n = await repo.getBalance();
    for (let i = 0; i < n; i++) expect((await exportCreative(repo, { requestId: randomUUID(), layout: "manset", size: "kare", req })).ok).toBe(true);
    const none = await exportCreative(repo, { requestId: randomUUID(), layout: "manset", size: "kare", req });
    expect(none.ok).toBe(false);
    expect(await repo.listGenerations("creative")).toHaveLength(n);
  });
});
