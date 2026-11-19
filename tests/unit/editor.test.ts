import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyToAllSizes, DocSchema, fillTemplate, frameToPlan, frameWarnings, parseDoc, planToFrame, scaleLayer, stripAssets, type DocEnv, type EditorDoc, type EditorLayer } from "@/lib/creative/editor";
import { loadCreativeFont } from "@/lib/creative/fonts";
import { LAYOUT_IDS } from "@/lib/creative/layouts";
import { CREATIVE_SIZE_IDS, CREATIVE_SIZES, STORY_UNSAFE } from "@/lib/creative/sizes";
import { runRuleEngine } from "@/lib/engine/rule-engine";
import { liveCheck, liveRules } from "@/lib/engine/live";
import { PLATFORM_IDS, ruleAppliesTo } from "@/lib/platforms";
import { SECTOR_IDS } from "@/lib/sectors";

const jars: Record<string, Map<string, string>> = { a: new Map() };
let jar = "a";
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jars[jar].has(k) ? { name: k, value: jars[jar].get(k)! } : undefined),
    set: (k: string, v: string) => void jars[jar].set(k, v),
    delete: (k: string) => void jars[jar].delete(k),
  }),
}));

const PNG_1PX = `data:image/png;base64,${readFileSync("tests/fixtures/ad.png").toString("base64")}`;

async function env(hasLogo = false): Promise<DocEnv> {
  const f = await loadCreativeFont("manrope");
  return { measure: (_f, w) => (w === 800 ? f.bold.m : f.regular.m), defaultFont: "manrope", hasLogo };
}

async function layoutDoc(layout: (typeof LAYOUT_IDS)[number] = "manset") {
  const { MemoryRepo } = await import("@/lib/data/memory-repo");
  const { creativeContext } = await import("@/lib/creative/service");
  const { docFromLayout } = await import("@/lib/creative/editor-service");
  const ctx = (await creativeContext(new MemoryRepo(), { brandId: null, platform: "meta", sector: "genel", headline: "Sabah kahven artık evde, üç kavrum tek kutuda", body: "Taze çekilmiş çekirdekler, ılık ve yoğun aroma.", cta: "Hemen incele" }))!;
  return { ctx, doc: docFromLayout(ctx, layout) };
}

function pngSize(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { w: v.getUint32(16), h: v.getUint32(20) };
}

describe("editor document (P10.1)", () => {
  it("every layout in every size becomes layers that draw the same text lines at the same sizes", async () => {
    const { planFor } = await import("@/lib/creative/service");
    const e = await env();
    for (const layout of LAYOUT_IDS) {
      const { ctx, doc } = await layoutDoc(layout);
      expect(DocSchema.safeParse(doc).success).toBe(true);
      for (const size of CREATIVE_SIZE_IDS) {
        const original = planFor(ctx, layout, size).elements.filter((x) => x.kind === "text");
        const again = frameToPlan(doc, size, e).elements.filter((x) => x.kind === "text");
        expect(again.map((t) => t.kind === "text" && t.lines), `${layout}/${size}`).toEqual(original.map((t) => t.kind === "text" && t.lines));
        again.forEach((t, i) => {
          const o = original[i];
          if (t.kind === "text" && o.kind === "text") expect(Math.abs(t.size - o.size)).toBeLessThan(0.2);
        });
      }
    }
  });

  it("schema refuses foreign colours, families, images, oversized lists and duplicate ids", async () => {
    const { doc } = await layoutDoc();
    const withLayer = (patch: Partial<EditorLayer>) => ({ ...doc, frames: { ...doc.frames, kare: { ...doc.frames.kare, layers: [{ ...doc.frames.kare.layers[0], ...patch }] } } });
    expect(parseDoc(withLayer({ color: "red" }))).toBeNull();
    expect(parseDoc(withLayer({ font: "comic-sans" as never }))).toBeNull();
    expect(parseDoc(withLayer({ id: "Büyük harf" }))).toBeNull();
    expect(parseDoc({ ...doc, assets: { urun: "data:image/svg+xml;base64,PHN2Zz4=" } })).toBeNull();
    expect(parseDoc({ ...doc, assets: { a: PNG_1PX, b: PNG_1PX, c: PNG_1PX, d: PNG_1PX } })).toBeNull();
    const many = Array.from({ length: 25 }, (_, i) => ({ ...doc.frames.kare.layers[0], id: `l-${i}` }));
    expect(parseDoc({ ...doc, frames: { ...doc.frames, kare: { ...doc.frames.kare, layers: many } } })).toBeNull();
    const dup = [doc.frames.kare.layers[0], doc.frames.kare.layers[0]];
    expect(parseDoc({ ...doc, frames: { ...doc.frames, kare: { ...doc.frames.kare, layers: dup } } })).toBeNull();
    expect(parseDoc(doc)).not.toBeNull();
  });

  it("'apply to all sizes' carries a layer proportionally and keeps it inside the 9:16 safe area", () => {
    const centred: EditorLayer = { id: "logo-1", type: "logo", x: 440, y: 440, w: 200, h: 200 };
    for (const to of CREATIVE_SIZE_IDS) {
      const l = scaleLayer(centred, "kare", to);
      const { w, h } = CREATIVE_SIZES[to];
      const area = to === "hikaye" ? { y: STORY_UNSAFE.top, h: h - STORY_UNSAFE.top - STORY_UNSAFE.bottom } : { y: 0, h };
      expect(Math.abs(l.x + l.w / 2 - w / 2)).toBeLessThan(1);
      expect(Math.abs(l.y + l.h / 2 - (area.y + area.h / 2))).toBeLessThan(1);
      expect(l.w).toBe(l.h);
    }
    const text: EditorLayer = { id: "headline-1", type: "text", role: "headline", text: "Başlık", x: 81, y: 900, w: 918, h: 120, size: 100 };
    const wide = scaleLayer(text, "kare", "yatay");
    expect(wide.size).toBeCloseTo(100 * (628 / 1080), 0);
    expect(wide.y + wide.h).toBeLessThanOrEqual(628);
    const story = scaleLayer({ ...text, y: 1080 - 130 }, "kare", "hikaye");
    expect(story.y + story.h).toBeLessThanOrEqual(1920 - STORY_UNSAFE.bottom + 0.5);
    expect(story.y).toBeGreaterThanOrEqual(STORY_UNSAFE.top);
  });

  it("a layout carried from the square size has no 9:16 safe-area warning", async () => {
    const e = await env();
    for (const layout of LAYOUT_IDS) {
      const { doc } = await layoutDoc(layout);
      const all = applyToAllSizes(doc, "kare");
      expect(all.frames.kare).toEqual(doc.frames.kare);
      const warnings = frameWarnings(all, "hikaye", frameToPlan(all, "hikaye", e));
      expect(warnings.filter((w) => w.kind === "safe_area"), layout).toEqual([]);
    }
  });

  it("warns about the 9:16 safe area, layers leaving the canvas, low contrast and text that does not fit", async () => {
    const e = await env();
    const { doc } = await layoutDoc();
    const headline = doc.frames.hikaye.layers.find((l) => l.role === "headline")!;
    const moved: EditorDoc = { ...doc, frames: { ...doc.frames, hikaye: { ...doc.frames.hikaye, layers: doc.frames.hikaye.layers.map((l) => (l.id === headline.id ? { ...l, y: 40, x: 900, color: doc.frames.hikaye.background.color } : l)) } } };
    const kinds = frameWarnings(moved, "hikaye", frameToPlan(moved, "hikaye", e)).map((w) => w.kind);
    expect(kinds).toContain("safe_area");
    expect(kinds).toContain("contrast");
    expect(kinds).toContain("overflow");
    const long = fillTemplate(doc, { headline: "Çok uzun bir başlık ".repeat(12) });
    const plan = frameToPlan(long, "kare", e);
    expect(plan.overflow).toContain("headline");
    const head = plan.elements.find((x) => x.kind === "text" && x.role === "headline");
    expect(head && head.kind === "text" && head.lines.at(-1)?.endsWith("…")).toBe(true);
  });

  it("templates take new copy and hide empty optional slots; stored layouts carry no images", async () => {
    const { doc } = await layoutDoc();
    const withImg: EditorDoc = { ...doc, assets: { urun: PNG_1PX }, frames: { ...doc.frames, kare: { ...doc.frames.kare, background: { color: "#ffffff", asset: "urun" } } } };
    const filled = fillTemplate(withImg, { headline: "Yeni başlık", body: "" });
    expect(filled.frames.dikey.layers.find((l) => l.role === "headline")?.text).toBe("Yeni başlık");
    expect(filled.frames.dikey.layers.find((l) => l.role === "body")?.hidden).toBe(true);
    const bare = stripAssets(withImg);
    expect(bare.assets).toEqual({});
    expect(bare.frames.kare.background.asset).toBeNull();
    expect(JSON.stringify(bare)).not.toContain("base64");
  });

  it("planToFrame turns call-to-action pills into one layer", async () => {
    const { ctx } = await layoutDoc();
    const { planFor } = await import("@/lib/creative/service");
    const frame = planToFrame(planFor(ctx, "manset", "kare"), { cta: "Hemen incele" }, "manrope");
    const cta = frame.layers.filter((l) => l.type === "cta");
    expect(cta).toHaveLength(1);
    expect(cta[0].text).toBe("Hemen incele");
    expect(frame.layers.some((l) => l.type === "text" && l.role === "cta")).toBe(false);
  });
});

describe("editor rendering and download (memory backend)", () => {
  beforeEach(async () => {
    const { __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
    __resetMemoryStoreForTests();
    jars.a.clear();
    jar = "a";
  });

  async function signedIn(email = "duzenle@example.com", key = "a") {
    jar = key;
    jars[key] ??= new Map();
    const { MemoryRepo } = await import("@/lib/data/memory-repo");
    const repo = new MemoryRepo();
    await repo.signUp({ email, password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
    return repo;
  }

  it("preview is the same drawing as the download, scaled; one credit per request id; layout kept without images", async () => {
    const { renderDoc, exportDoc, docContext } = await import("@/lib/creative/editor-service");
    const repo = await signedIn();
    const { doc } = await layoutDoc("bant");
    const withImg: EditorDoc = { ...doc, assets: { "urun-1": PNG_1PX }, frames: { ...doc.frames, kare: { ...doc.frames.kare, layers: [...doc.frames.kare.layers, { id: "image-1", type: "image", x: 500, y: 300, w: 400, h: 400, asset: "urun-1" }] } } };
    const ctx = (await docContext(repo, withImg))!;
    const small = await renderDoc(ctx, withImg, "kare", 0.5);
    expect(pngSize(small.png)).toEqual({ w: 540, h: 540 });
    const before = await repo.getBalance();
    const id = randomUUID();
    const a = await exportDoc(repo, { requestId: id, doc: withImg, size: "hepsi", label: "Alt bant" });
    const b = await exportDoc(repo, { requestId: id, doc: withImg, size: "hepsi", label: "Alt bant" });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.generation.id).toBe(a.generation.id);
    expect(await repo.getBalance()).toBe(before - 1);
    const file = await repo.readGenerationFile(a.generation.id, (a.generation.output.files as { path: string }[])[0].path);
    const zip = unzipSync(file!.bytes);
    expect(Object.keys(zip).sort()).toEqual(["adscope-alt-bant-1080x1080.png", "adscope-alt-bant-1080x1350.png", "adscope-alt-bant-1080x1920.png", "adscope-alt-bant-1200x628.png"]);
    expect(pngSize(zip["adscope-alt-bant-1080x1920.png"])).toEqual({ w: 1080, h: 1920 });
    const stored = parseDoc(a.generation.output.doc);
    expect(stored?.assets).toEqual({});
    expect(stored?.frames.kare.layers.some((l) => l.id === "image-1")).toBe(true);
  });

  it("refuses a fake image, a foreign brand and an empty balance without charging", async () => {
    const { exportDoc } = await import("@/lib/creative/editor-service");
    const repo = await signedIn();
    const { doc } = await layoutDoc();
    const before = await repo.getBalance();
    const fake = await exportDoc(repo, { requestId: randomUUID(), doc: { ...doc, assets: { urun: `data:image/png;base64,${Buffer.from("not a png at all").toString("base64")}` } }, size: "kare", label: "x" });
    expect(fake.ok).toBe(false);
    const foreign = await exportDoc(repo, { requestId: randomUUID(), doc: { ...doc, brandId: randomUUID() }, size: "kare", label: "x" });
    expect(foreign.ok).toBe(false);
    expect(await repo.getBalance()).toBe(before);
    for (let i = 0; i < before; i++) expect((await exportDoc(repo, { requestId: randomUUID(), doc, size: "kare", label: "x" })).ok).toBe(true);
    const none = await exportDoc(repo, { requestId: randomUUID(), doc, size: "kare", label: "x" });
    expect(none.ok).toBe(false);
    expect(await repo.listGenerations("creative")).toHaveLength(before);
  });

  it("brand templates: 30 per brand, own brand only, invisible to other accounts", async () => {
    const repo = await signedIn();
    const brand = (await repo.createBrand({ name: "Çınar", sector: "genel", tone: "samimi" }))!;
    const { doc } = await layoutDoc();
    const body = { brandId: brand.id, name: "Duyuru", doc: stripAssets({ ...doc, brandId: brand.id }) as unknown as Record<string, unknown> };
    for (let i = 0; i < 30; i++) expect((await repo.createBrandTemplate({ ...body, name: `Şablon ${i}` })).status).toBe("created");
    expect((await repo.createBrandTemplate(body)).status).toBe("limit");
    expect((await repo.createBrandTemplate({ ...body, brandId: randomUUID() })).status).toBe("brand_not_found");
    const list = await repo.listBrandTemplates(brand.id);
    expect(list).toHaveLength(30);
    expect(parseDoc(list[0].doc)).not.toBeNull();

    const other = await signedIn("baskasi@example.com", "b");
    expect(await other.listBrandTemplates()).toEqual([]);
    expect(await other.getBrandTemplate(list[0].id)).toBeNull();
    expect(await other.deleteBrandTemplate(list[0].id)).toBe(false);
    jar = "a";
    expect(await repo.deleteBrandTemplate(list[0].id)).toBe(true);
    expect((await repo.createBrandTemplate(body)).status).toBe("created");
    // Deleting the brand removes its templates.
    await repo.deleteBrand(brand.id);
    expect(await repo.listBrandTemplates()).toEqual([]);
  });

  it("a template preview places new copy and shrinks text that no longer fits", async () => {
    const { creativeContext } = await import("@/lib/creative/service");
    const { docFromTemplate, docWarnings } = await import("@/lib/creative/editor-service");
    const repo = await signedIn();
    const { doc } = await layoutDoc();
    const ctx = (await creativeContext(repo, { brandId: null, platform: "meta", sector: "genel", headline: "Bu başlık şablondakinden çok daha uzun ve kutuya sığmak için küçülmesi gerekiyor, belki kısaltılması da", body: "", cta: "Al" }))!;
    const filled = docFromTemplate(ctx, stripAssets(doc))!;
    expect(filled.frames.kare.layers.find((l) => l.role === "body")?.hidden).toBe(true);
    // The longer headline shrinks inside the template's box instead of spilling out of it.
    const e = await env();
    const slot = filled.frames.kare.layers.find((l) => l.role === "headline")!;
    const head = frameToPlan(filled, "kare", e).elements.find((x) => x.kind === "text" && x.role === "headline");
    expect(head?.kind === "text" && head.size < slot.size!).toBe(true);
    expect(head?.kind === "text" && head.lines.length * head.size * head.lineHeight <= slot.h + 0.5).toBe(true);
    expect(Array.isArray(await docWarnings(ctx, filled, "kare"))).toBe(true);
    expect(docFromTemplate(ctx, { nope: true })).toBeNull();
  });
});

describe("live compliance hints (P10.2)", () => {
  const TEXTS = [
    "7 günde 5 kilo ver! Garantili sonuç, %70 indirim. En etkili detoks çayı. Hemen sipariş ver.",
    "Kesin çözüm, yan etkisi yok. Doktorlar öneriyor.",
    "Ağrısız lazer epilasyon, %100 kalıcı sonuç. Ünlülerin tercihi.",
    "Kredi notun ne olursa olsun anında onay, faizsiz kredi!",
    "Bu kursla 30 günde garantili iş sahibi ol.",
    "Sabah kahven artık evde, üç kavrum tek kutuda.",
    "#işbirliği bu ürünü çok sevdim, sen de dene",
  ];

  it("gives the same findings in the browser as the server's rule check, for every sector and platform", async () => {
    const { MemoryRepo } = await import("@/lib/data/memory-repo");
    const repo = new MemoryRepo();
    for (const sector of SECTOR_IDS) {
      const serverRules = await repo.getRules(sector);
      for (const platform of PLATFORM_IDS) {
        const rules = serverRules.filter((r) => ruleAppliesTo(r, platform));
        expect(liveRules(sector, platform).map((r) => r.id).sort()).toEqual(rules.map((r) => r.id).sort());
        for (const text of TEXTS) {
          const server = runRuleEngine({ headline: "", primaryText: text, description: "", flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false } }, rules)
            .filter((f) => f.ruleId && f.matchedText)
            .map((f) => [f.ruleId, f.severity, f.matchedText]);
          expect(liveCheck(text, sector, platform).map((f) => [f.ruleId, f.severity, f.matchedText])).toEqual(server);
        }
      }
    }
  });

  it("levels follow the card status and the safe version removes the phrase", () => {
    const found = liveCheck(TEXTS[0], "takviye_gida", "meta");
    expect(found.length).toBeGreaterThan(0);
    for (const f of found) {
      const rule = liveRules("takviye_gida", "meta").find((r) => r.id === f.ruleId)!;
      if (rule.status !== "active") expect(f.severity).toBe("info");
      expect(f.unverified).toBe(rule.status !== "active");
      // The flagged phrase is gone (another phrase of the same card may still be listed on its own).
      if (f.safeText) expect(liveCheck(f.safeText, "takviye_gida", "meta").some((g) => g.ruleId === f.ruleId && g.matchedText === f.matchedText)).toBe(false);
    }
    expect(found.some((f) => f.safeText)).toBe(true);
    expect(liveCheck("   ", "genel", "meta")).toEqual([]);
  });
});
