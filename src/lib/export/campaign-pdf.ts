import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import { PACKAGE_NOTE, RISK_LABEL, type VariantCheck, type VariantText } from "@/lib/campaign/variants";
import { PDF_DISCLAIMER } from "./pdf";

/**
 * Check report inside the campaign package (P9.1): every suggested ad with its rule-engine result,
 * the matched rule cards and the safe version. Same embedded fonts as the analysis report.
 */

const C = { ink: "#13213c", muted: "#56607a", line: "#ddd4c4", red: "#b23a21", amber: "#8a5600", green: "#2b6a4c" };
const RISK_COLOR = { ok: C.green, yellow: C.amber, red: C.red } as const;

export interface CampaignPdfInput {
  productName: string;
  brandName: string | null;
  platformLabel: string;
  sectorLabel: string;
  layoutLabel: string;
  createdAt: string;
  variants: (VariantText & VariantCheck & { n: number; picked: boolean })[];
  notes: string[];
}

export async function buildCampaignPdf(p: CampaignPdfInput): Promise<Buffer> {
  const dir = join(process.cwd(), "assets", "fonts");
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 64, left: 52, right: 52 },
    bufferPages: true,
    info: { Title: "AdScope kampanya paketi kontrol raporu", Author: "AdScope", Subject: PDF_DISCLAIMER, Creator: "AdScope" },
  });
  doc.registerFont("body", readFileSync(join(dir, "Manrope-Regular.ttf")));
  doc.registerFont("bold", readFileSync(join(dir, "Manrope-Bold.ttf")));
  doc.registerFont("display", readFileSync(join(dir, "Fraunces-SemiBold.ttf")));
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const ensure = (h: number) => {
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
  };
  const text = (s: string, o: { size?: number; color?: string; font?: string; indent?: number } = {}) =>
    doc.font(o.font ?? "body").fontSize(o.size ?? 10).fillColor(o.color ?? C.ink).text(s, left + (o.indent ?? 0), doc.y, { width: width - (o.indent ?? 0), lineGap: 2 });

  const date = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(p.createdAt));
  doc.font("display").fontSize(17).fillColor(C.ink).text("AdScope", left, doc.y);
  doc.font("bold").fontSize(8.5).fillColor(C.ink).text(PDF_DISCLAIMER, left, 58, { width, align: "right" });
  doc.font("body").fontSize(8.5).fillColor(C.muted).text(date, left, 70, { width, align: "right" });
  doc.y = 100;
  doc.font("display").fontSize(22).fillColor(C.ink).text("Kampanya paketi kontrol raporu", left, doc.y, { width });
  doc.moveDown(0.2);
  text([p.productName, p.brandName, p.sectorLabel, p.platformLabel, `Yerleşim: ${p.layoutLabel}`].filter(Boolean).join(" · "), { size: 9.5, color: C.muted });
  doc.moveDown(0.6);
  const counts = { red: p.variants.filter((v) => v.risk === "red").length, yellow: p.variants.filter((v) => v.risk === "yellow").length };
  text(
    `${p.variants.length} metin kural motorundan geçti: ${counts.red} kırmızı bayraklı, ${counts.yellow} sarı bayraklı. Görsele dönüştürülen metinler "Görselde" ile işaretli. Kırmızı bayrak yalnızca doğrulanmış (active) kural kartına dayanır; doğrulanmamış kartlar bu raporda bayrak üretmez.`,
    { size: 10 },
  );
  for (const n of p.notes) {
    doc.moveDown(0.3);
    text(n, { size: 9, color: C.muted });
  }

  for (const v of p.variants) {
    ensure(110);
    doc.moveDown(0.9);
    const y0 = doc.y;
    doc.font("bold").fontSize(8).fillColor(RISK_COLOR[v.risk]).text(`${v.n}. METİN · ${RISK_LABEL[v.risk].toUpperCase()} · ${p.platformLabel} kural puanı ${v.metaScore}${v.picked ? " · GÖRSELDE" : ""}`, left + 12, y0, { width: width - 12 });
    doc.font("bold").fontSize(11).fillColor(C.ink).text(v.headline, left + 12, doc.y + 2, { width: width - 12 });
    if (v.primaryText) text(v.primaryText, { size: 9.5, indent: 12 });
    if (v.cta) text(`Çağrı: ${v.cta}`, { size: 9, color: C.muted, indent: 12 });
    if (v.issues.length) text(`Eşleşen kural kartları: ${v.issues.join(" · ")}`, { size: 9, color: RISK_COLOR[v.risk], indent: 12 });
    if (v.safe) text(`Güvenli sürüm: ${[v.safe.headline, v.safe.primaryText].filter(Boolean).join(" — ")}`, { size: 9, indent: 12 });
    if (doc.y > y0) doc.rect(left, y0, 3, doc.y - y0).fill(RISK_COLOR[v.risk]);
  }

  ensure(60);
  doc.moveDown(1.2);
  text(PACKAGE_NOTE, { size: 9, font: "bold" });
  text("Görseldeki ürün iddiaları, fiyatlar ve kampanya koşulları senin sorumluluğundadır; yayından önce açılış sayfasıyla tutarlı olduğunu kontrol et.", { size: 9, color: C.muted });

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 40;
    doc.moveTo(left, y - 8).lineTo(left + width, y - 8).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font("body").fontSize(7.5).fillColor(C.muted).text(`${PDF_DISCLAIMER} Reklamın onaylanacağını garanti etmez.`, left, y, { width: width - 60, lineBreak: false, height: 12 });
    doc.text(`${i + 1} / ${range.count}`, left + width - 60, y, { width: 60, align: "right", lineBreak: false, height: 12 });
  }
  doc.end();
  return done;
}
