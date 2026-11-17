import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import type { AnalysisDetail, ReportBranding } from "@/lib/data/types";
import { PLATFORM_SHORT } from "@/lib/platforms";
import { SECTOR_LABEL } from "@/lib/sectors";

/**
 * Server-side branded PDF report. Fonts are embedded (Manrope + Fraunces, SIL OFL) so Turkish
 * characters render everywhere. Nothing from the report is logged.
 */

const C = {
  ink: "#13213c",
  soft: "#3d4c6b",
  muted: "#56607a",
  line: "#ddd4c4",
  card: "#fffdf9",
  coral: "#e2553a",
  coralDeep: "#b23a21",
  coralTint: "#fbe2d9",
  amber: "#8a5600",
  amberTint: "#faefd3",
  info: "#2c5784",
  infoTint: "#e4ecf5",
  green: "#2b6a4c",
  greenTint: "#e0efe6",
};
const SEV = {
  red: { label: "Kırmızı bayrak", color: C.coralDeep, tint: C.coralTint },
  yellow: { label: "Sarı bayrak", color: C.amber, tint: C.amberTint },
  info: { label: "Bilgilendirme", color: C.info, tint: C.infoTint },
} as const;
const LEVEL = { low: "Düşük", medium: "Orta", high: "Yüksek" } as const;
const DOMAIN = { meta_policy: "Platform politikası", tr_law: "Türk reklam mevzuatı", creative_quality: "Kreatif kalite" } as const;
const STATUS = { active: "Doğrulandı", requires_review: "Doğrulanmadı (bilgi amaçlı)", draft: "Taslak", retired: "Kullanımdan kalktı" } as const;
export const PDF_DISCLAIMER = "Risk değerlendirmesidir, hukuki görüş değildir.";

let fonts: { regular: Buffer; bold: Buffer; display: Buffer } | null = null;
function loadFonts() {
  if (!fonts) {
    const dir = join(process.cwd(), "assets", "fonts");
    fonts = {
      regular: readFileSync(join(dir, "Manrope-Regular.ttf")),
      bold: readFileSync(join(dir, "Manrope-Bold.ttf")),
      display: readFileSync(join(dir, "Fraunces-SemiBold.ttf")),
    };
  }
  return fonts;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(iso));
}

/** pdfkit embeds only JPEG and PNG. */
function embeddable(mime: string | undefined) {
  return mime === "image/jpeg" || mime === "image/png";
}

export async function buildReportPdf(
  a: AnalysisDetail,
  branding: ReportBranding | null,
  opts: { creative?: { bytes: Uint8Array; mime: string } | null } = {},
): Promise<Buffer> {
  const f = loadFonts();
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 64, left: 52, right: 52 },
    bufferPages: true,
    info: { Title: "AdScope reklam ön kontrol raporu", Author: branding?.agencyName || "AdScope", Subject: PDF_DISCLAIMER, Creator: "AdScope" },
  });
  doc.registerFont("body", f.regular);
  doc.registerFont("bold", f.bold);
  doc.registerFont("display", f.display);

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const ensure = (h: number) => {
    if (doc.y + h > bottom()) doc.addPage();
  };
  const heading = (text: string) => {
    ensure(60);
    doc.moveDown(0.8);
    doc.font("display").fontSize(15).fillColor(C.ink).text(text, left, doc.y, { width });
    doc.moveDown(0.35);
  };
  const para = (text: string, o: { size?: number; color?: string; font?: string; indent?: number } = {}) => {
    doc.font(o.font ?? "body").fontSize(o.size ?? 10).fillColor(o.color ?? C.ink).text(text, left + (o.indent ?? 0), doc.y, { width: width - (o.indent ?? 0), lineGap: 2 });
  };

  // Header ----------------------------------------------------------------------
  const top = doc.y;
  let logoDrawn = false;
  if (branding?.logo && embeddable(branding.logo.mime)) {
    try {
      doc.image(Buffer.from(branding.logo.bytes), left, top, { fit: [120, 40] });
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }
  if (!logoDrawn) {
    doc.circle(left + 11, top + 11, 9).lineWidth(2).strokeColor(C.ink).stroke();
    doc.moveTo(left + 17.5, top + 17.5).lineTo(left + 24, top + 24).stroke();
    doc.font("display").fontSize(17).fillColor(C.ink).text(branding?.brandName || "AdScope", left + 32, top + 2);
  }
  doc.font("body").fontSize(8.5).fillColor(C.muted).text(fmtDate(a.completedAt ?? a.createdAt), left, top + 2, { width, align: "right" });
  doc.font("bold").fontSize(8.5).fillColor(C.ink).text(PDF_DISCLAIMER, left, top + 14, { width, align: "right" });
  doc.y = top + 52;
  doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.8).strokeColor(C.line).stroke();
  doc.moveDown(0.8);
  doc.font("display").fontSize(22).fillColor(C.ink).text("Reklam ön kontrol raporu", left, doc.y, { width });
  const sub = [
    a.headline || a.primaryText.slice(0, 80),
    SECTOR_LABEL[a.sector],
    PLATFORM_SHORT[a.platform],
    branding?.brandName && logoDrawn ? branding.brandName : null,
    branding?.agencyName ? `Hazırlayan: ${branding.agencyName}` : null,
  ].filter(Boolean);
  doc.moveDown(0.2);
  para(sub.join(" · "), { size: 9.5, color: C.muted });

  // Scores -------------------------------------------------------------------------
  doc.moveDown(0.9);
  const boxW = (width - 16) / 3;
  const boxY = doc.y;
  const boxes: [string, string, string][] = [
    [`${PLATFORM_SHORT[a.platform]} ret riski`, String(a.metaRiskScore ?? "—"), a.metaRiskLevel ? LEVEL[a.metaRiskLevel] : ""],
    ["Türk mevzuatı riski", String(a.legalFindingCount ?? 0), a.legalRiskLevel ? `${LEVEL[a.legalRiskLevel]} · doğrulanmış bulgu` : ""],
    ["Kreatif skoru", `${a.creativeScore ?? "—"}`, "100 üzerinden"],
  ];
  boxes.forEach(([label, value, note], i) => {
    const x = left + i * (boxW + 8);
    doc.roundedRect(x, boxY, boxW, 74, 8).fillAndStroke(C.card, C.line);
    doc.font("bold").fontSize(8.5).fillColor(C.muted).text(label, x + 12, boxY + 10, { width: boxW - 24 });
    doc.font("display").fontSize(26).fillColor(C.ink).text(value, x + 12, boxY + 24, { width: boxW - 24 });
    doc.font("body").fontSize(8.5).fillColor(C.soft).text(note, x + 12, boxY + 56, { width: boxW - 24 });
  });
  doc.y = boxY + 88;
  if (a.scoreBreakdown?.legal.reason) para(a.scoreBreakdown.legal.reason, { size: 8.5, color: C.soft });

  // Ad -------------------------------------------------------------------------------
  heading("İncelenen reklam");
  if (opts.creative && embeddable(opts.creative.mime)) {
    ensure(170);
    try {
      const y0 = doc.y;
      doc.image(Buffer.from(opts.creative.bytes), left, y0, { fit: [150, 150] });
      doc.y = y0;
      const tx = left + 166;
      if (a.headline) doc.font("bold").fontSize(11).fillColor(C.ink).text(a.headline, tx, doc.y, { width: width - 166 });
      doc.font("body").fontSize(10).fillColor(C.ink).text(a.primaryText, tx, doc.y + 2, { width: width - 166, lineGap: 2 });
      if (a.description) doc.font("body").fontSize(9).fillColor(C.soft).text(a.description, tx, doc.y + 4, { width: width - 166 });
      doc.y = Math.max(doc.y, y0 + 156);
    } catch {
      /* unreadable image: text only */
    }
  } else {
    if (a.headline) para(a.headline, { font: "bold", size: 11 });
    para(a.primaryText);
    if (a.description) para(a.description, { size: 9, color: C.soft });
    if (a.mediaType === "video") para("Video analizi: kareler raporun web sürümünde.", { size: 8.5, color: C.muted });
  }
  if (a.transcript) {
    doc.moveDown(0.4);
    para("Videodaki konuşma ve ekran yazıları", { font: "bold", size: 8.5, color: C.muted });
    para(a.transcript, { size: 9.5 });
  }
  if (a.landingUrl) {
    doc.moveDown(0.3);
    para(`Açılış sayfası: ${a.landingUrl}`, { size: 8.5, color: C.muted });
  }

  // Findings -------------------------------------------------------------------------
  heading(`Bulgular · ${a.findings.length}`);
  if (!a.findings.length) {
    para("Aktif kural kartlarına göre işaretlenen bir ifade bulunmadı. Bu, reklamın onaylanacağı anlamına gelmez.", { color: C.soft });
  }
  for (const fd of a.findings) {
    const sev = SEV[fd.severity];
    doc.font("body").fontSize(9.5);
    const body = [fd.explanation, fd.suggestion ? `Öneri: ${fd.suggestion}` : ""].filter(Boolean).join("\n");
    const h = doc.heightOfString(body, { width: width - 22, lineGap: 2 }) + 52 + (fd.matchedText ? 14 : 0) + (fd.rule ? 14 : 0);
    ensure(Math.min(h, 260));
    const y0 = doc.y;
    const page0 = doc.bufferedPageRange().count;
    doc.font("bold").fontSize(8).fillColor(sev.color).text(`${sev.label.toUpperCase()} · ${DOMAIN[fd.domain]}`, left + 12, y0, { width: width - 12 });
    doc.font("bold").fontSize(10.5).fillColor(C.ink).text(fd.title, left + 12, doc.y + 2, { width: width - 12 });
    if (fd.matchedText) doc.font("body").fontSize(9).fillColor(C.coralDeep).text(`“${fd.matchedText}”`, left + 12, doc.y + 1, { width: width - 12 });
    doc.font("body").fontSize(9.5).fillColor(C.ink).text(body, left + 12, doc.y + 2, { width: width - 22, lineGap: 2 });
    if (fd.rule) {
      doc
        .font("body")
        .fontSize(8)
        .fillColor(C.muted)
        .text(`${fd.rule.id} v${fd.rule.version} · ${STATUS[fd.rule.status]} · ${fd.rule.sourceOrg}: ${fd.rule.sourceTitle}`, left + 12, doc.y + 3, { width: width - 12 });
    }
    // Severity bar next to the finding (only when it did not break across pages).
    if (doc.bufferedPageRange().count === page0) doc.rect(left, y0, 3, doc.y - y0).fill(sev.color);
    doc.moveDown(0.9);
  }

  // Safe text and variants ---------------------------------------------------------------
  const safe = a.variants.find((v) => v.kind === "safe");
  if (safe) {
    heading("Güvenli metin önerisi");
    const text = [safe.headline, safe.primaryText, safe.description].filter(Boolean).join("\n");
    doc.font("body").fontSize(10);
    const h = doc.heightOfString(text, { width: width - 24, lineGap: 2 }) + 20;
    ensure(h);
    const y0 = doc.y;
    doc.roundedRect(left, y0, width, h, 8).fill(C.greenTint);
    doc.font("body").fontSize(10).fillColor(C.ink).text(text, left + 12, y0 + 10, { width: width - 24, lineGap: 2 });
    doc.y = y0 + h + 4;
    para(`Aynı kural kartlarıyla yeniden tarandı: ${safe.recheckRed} kırmızı, ${safe.recheckYellow} sarı bayrak.`, { size: 8.5, color: C.muted });
  }
  const variants = a.variants.filter((v) => v.kind === "variant");
  if (variants.length) {
    heading("Türkçe varyantlar");
    for (const v of variants) {
      const text = [v.headline, v.primaryText, v.description].filter(Boolean).join("\n");
      doc.font("body").fontSize(9.5);
      ensure(doc.heightOfString(text, { width, lineGap: 2 }) + 30);
      para(v.tone, { font: "bold", size: 8.5, color: C.coralDeep });
      para(text, { size: 9.5 });
      para(`Yeniden tarama: ${v.recheckRed === 0 && v.recheckYellow === 0 ? "bayrak yok" : `${v.recheckRed} kırmızı, ${v.recheckYellow} sarı`}`, { size: 8, color: C.muted });
      doc.moveDown(0.6);
    }
  }

  const dm = a.scoreBreakdown?.dm;
  if (dm) {
    heading("WhatsApp / DM şablonları");
    const rows: [string, string][] = [
      ["Müşterinin ilk mesajı", dm.first_message],
      ["Hazır sorular", dm.starter_questions.join(" · ")],
      ["Otomatik karşılama", dm.auto_greeting],
      ["Mesai dışı yanıt", dm.away_message],
    ];
    for (const [k, v] of rows) {
      doc.font("body").fontSize(9.5);
      ensure(doc.heightOfString(v, { width, lineGap: 2 }) + 24);
      para(k, { font: "bold", size: 8.5, color: C.muted });
      para(v, { size: 9.5 });
      doc.moveDown(0.5);
    }
  }

  if (a.appeal) {
    heading("İtiraz asistanı");
    para(a.appeal.recommendation === "new_ad" ? "Öneri: itiraz yerine düzeltilmiş yeni reklam" : "Öneri: itiraz edilebilir", { font: "bold" });
    para(a.appeal.explanation_tr, { size: 9.5, color: C.soft });
    doc.moveDown(0.4);
    para("Türkçe taslak", { font: "bold", size: 8.5, color: C.muted });
    para(a.appeal.draft_tr, { size: 9.5 });
  }

  // Footer on every page --------------------------------------------------------------
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Writing inside the bottom margin would otherwise make pdfkit add a page.
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 40;
    doc.moveTo(left, y - 8).lineTo(left + width, y - 8).lineWidth(0.5).strokeColor(C.line).stroke();
    doc
      .font("body")
      .fontSize(7.5)
      .fillColor(C.muted)
      .text(`${PDF_DISCLAIMER} Reklamın onaylanacağını garanti etmez. · Rapor ${a.id.slice(0, 8)} · ${a.engineVersion ?? ""}`, left, y, {
        width: width - 60,
        lineBreak: false,
        height: 12,
      });
    doc.text(`${i + 1} / ${range.count}`, left + width - 60, y, { width: 60, align: "right", lineBreak: false, height: 12 });
  }

  doc.end();
  return done;
}
