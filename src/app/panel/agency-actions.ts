"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, getRepo } from "@/lib/data";
import { emailConfigured, getEmailProvider } from "@/lib/email/provider";
import { normalizeBannedWords } from "@/lib/engine/brand-voice";
import { siteUrl } from "@/lib/env";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { SECTOR_IDS } from "@/lib/sectors";
import { validateImage } from "@/lib/security/file-validation";
import { hashToken, newToken, TOKEN_RE } from "@/lib/security/tokens";
import { buildReportPdf } from "@/lib/export/pdf";
import { hashKey, rateLimit } from "@/lib/security/rate-limit";
import type { ActionState } from "./actions";

async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/giris");
  return u;
}

// Finding feedback ("bu uyarı yanlış") ----------------------------------------------------
const feedbackSchema = z.object({
  analysisId: z.uuid(),
  findingId: z.string().min(1).max(80),
  verdict: z.enum(["wrong", "unclear", "helpful"]),
  reason: z.enum(["not_in_ad", "context_ok", "rule_outdated", "other"]).optional(),
  note: z.string().trim().max(500, "Not en fazla 500 karakter olabilir.").optional(),
});

export async function findingFeedbackAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = feedbackSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geri bildirim gönderilemedi." };
  const d = parsed.data;
  const ok = await getRepo().saveFindingFeedback(d.analysisId, {
    findingId: d.findingId,
    verdict: d.verdict,
    reason: d.verdict === "wrong" ? (d.reason ?? "other") : null,
    note: d.note || null,
  });
  if (!ok) return { error: "Geri bildirim kaydedilemedi. Lütfen tekrar deneyin." };
  return { error: null, ok: d.verdict === "helpful" ? "Teşekkürler, kaydettik." : "Teşekkürler. Kural kartını gözden geçirirken bu bildirimi dikkate alacağız." };
}

// Brands: voice, banned words, logo ---------------------------------------------------------
const brandSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Marka adı gerekli.").max(80),
  sector: z.enum(SECTOR_IDS),
  tone: z.enum(["samimi", "kurumsal", "genc"]),
  bannedWords: z.string().max(2000).default(""),
  voiceNotes: z.string().trim().max(600, "Marka sesi notu en fazla 600 karakter olabilir.").default(""),
  preferredCta: z.string().trim().max(140, "Çağrı cümlesi en fazla 140 karakter olabilir.").default(""),
});

export async function saveBrandAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const raw = Object.fromEntries(form);
  if (!raw.id) delete raw.id;
  const parsed = brandSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Lütfen alanları kontrol edin." };
  const d = parsed.data;
  const input = {
    name: d.name,
    sector: d.sector,
    tone: d.tone,
    bannedWords: normalizeBannedWords(d.bannedWords),
    voiceNotes: d.voiceNotes || null,
    preferredCta: d.preferredCta || null,
  };
  const repo = getRepo();
  let id = d.id;
  if (id) {
    if (!(await repo.updateBrand(id, input))) return { error: "Marka güncellenemedi. Aynı adda başka bir marka olabilir." };
  } else {
    const b = await repo.createBrand(input);
    if (!b) return { error: "Marka eklenemedi. Aynı adda başka bir marka olabilir." };
    id = b.id;
  }
  const logo = form.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 1024 * 1024) return { error: "Logo en fazla 1 MB olabilir. Marka bilgileri kaydedildi." };
    const bytes = new Uint8Array(await logo.arrayBuffer());
    const check = validateImage(bytes, logo.type);
    if (!check.ok) return { error: "Logo okunamadı. PNG veya JPG yükleyin. Marka bilgileri kaydedildi." };
    if (!(await repo.setBrandLogo(id, { bytes, mime: check.meta.mime, ext: check.ext }))) return { error: "Logo yüklenemedi. Marka bilgileri kaydedildi." };
  } else if (form.get("removeLogo") === "on") {
    await repo.setBrandLogo(id, null);
  }
  revalidatePath("/panel/markalar");
  return { error: null, ok: d.id ? "Marka güncellendi." : "Marka eklendi." };
}

export async function deleteBrandAction(form: FormData) {
  await requireUser();
  const id = z.uuid().safeParse(form.get("id"));
  if (id.success) await getRepo().deleteBrand(id.data);
  revalidatePath("/panel/markalar");
}

// Team (agency mode) -------------------------------------------------------------------------
export async function inviteMemberAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const u = await requireUser();
  const email = z.email("Geçerli bir e-posta adresi girin.").safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: email.error.issues[0]?.message ?? "Geçerli bir e-posta adresi girin." };
  const { token, hash } = newToken();
  const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();
  const res = await getRepo().createTeamInvite(email.data, hash, expiresAt);
  if (res === "self") return { error: "Kendinizi ekibe davet edemezsiniz." };
  if (res === "exists") return { error: "Bu kişi zaten ekipte." };
  if (res === "limit") return { error: "Ekip en fazla 10 kişi olabilir (bekleyen davetler dahil)." };
  if (res !== "ok") return { error: "Davet oluşturulamadı. Lütfen tekrar deneyin." };
  const link = `${siteUrl()}/panel/ekip/katil?davet=${token}`;
  revalidatePath("/panel/ekip");
  const mailer = emailConfigured() ? getEmailProvider() : null;
  if (mailer) {
    const sent = await mailer.send({
      idempotencyKey: `team-invite:${hash}`,
      to: email.data,
      subject: "AdScope ekibine davet edildiniz",
      text: `${u.email} sizi AdScope ekibine davet etti. Ekip analizlerini ve raporlarını görüntüleyebilirsiniz.\n\nDaveti kabul etmek için (7 gün geçerli):\n${link}\n\nHesabın yoksa önce bu e-posta adresiyle kayıt ol, sonra bağlantıyı yeniden aç.\n\nBu daveti beklemiyorsanız e-postayı yok sayabilirsiniz.`,
      html: `<p>${escapeHtml(u.email)} sizi AdScope ekibine davet etti. Ekip analizlerini ve raporlarını görüntüleyebilirsiniz.</p><p><a href="${link}">Daveti kabul et</a> (7 gün geçerli)</p><p>Bu daveti beklemiyorsanız e-postayı yok sayabilirsiniz.</p>`,
    });
    if (sent.ok) return { error: null, ok: `Davet ${email.data} adresine gönderildi.`, link };
  }
  return { error: null, ok: "Davet oluşturuldu. Bağlantıyı kopyalayıp ekip arkadaşınla paylaş; yalnızca bir kez gösterilir.", link };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function teamAction(form: FormData) {
  await requireUser();
  const op = String(form.get("op") ?? "");
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return;
  const repo = getRepo();
  if (op === "revoke-invite") await repo.deleteTeamInvite(id.data);
  if (op === "remove-member") await repo.removeTeamMember(id.data);
  if (op === "leave") await repo.leaveTeam(id.data);
  revalidatePath("/panel/ekip");
}

export async function acceptInviteAction(form: FormData) {
  await requireUser();
  const token = String(form.get("token") ?? "");
  if (!TOKEN_RE.test(token)) redirect("/panel/ekip?davet=gecersiz");
  const res = await getRepo().acceptTeamInvite(hashToken(token));
  redirect(`/panel/ekip?davet=${res === "ok" ? "kabul" : res === "wrong_email" ? "baska-eposta" : res === "self" ? "kendi" : "gecersiz"}`);
}

// Lawyer review link ---------------------------------------------------------------------------
const shareSchema = z.object({
  analysisId: z.uuid(),
  days: z.coerce.number().int().min(1).max(30),
  note: z.string().trim().max(500, "Not en fazla 500 karakter olabilir.").default(""),
});

export async function createReviewShareAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = shareSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Bağlantı oluşturulamadı." };
  const { token, hash } = newToken();
  const expiresAt = new Date(Date.now() + parsed.data.days * 86400_000).toISOString();
  const ok = await getRepo().createReviewShare(parsed.data.analysisId, hash, expiresAt, parsed.data.note || null);
  if (!ok) return { error: "Bağlantı oluşturulamadı. Yalnızca tamamlanmış kendi analizleriniz paylaşılabilir." };
  revalidatePath(`/panel/analiz/${parsed.data.analysisId}`);
  return { error: null, ok: "İnceleme bağlantısı hazır. Bağlantı yalnızca bir kez gösterilir; kopyalayıp avukatınla paylaş.", link: `${siteUrl()}/inceleme/${token}` };
}

export async function revokeReviewShareAction(form: FormData) {
  await requireUser();
  const id = z.uuid().safeParse(form.get("id"));
  const analysisId = z.uuid().safeParse(form.get("analysisId"));
  if (id.success) await getRepo().revokeReviewShare(id.data);
  if (analysisId.success) revalidatePath(`/panel/analiz/${analysisId.data}`);
}

// API keys ------------------------------------------------------------------------------------
export async function createApiKeyAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const name = z.string().trim().min(1, "Anahtara bir ad verin.").max(60).safeParse(form.get("name"));
  if (!name.success) return { error: name.error.issues[0]?.message ?? "Anahtara bir ad verin." };
  const { token, hash } = newToken("ads_live_");
  const res = await getRepo().createApiKey(name.data, token.slice(0, 13), hash);
  if (res === "limit") return { error: "En fazla 5 etkin API anahtarı olabilir. Kullanmadığın bir anahtarı iptal et." };
  if (res !== "ok") return { error: "Anahtar oluşturulamadı. Lütfen tekrar deneyin." };
  revalidatePath("/panel/api");
  return { error: null, ok: "Anahtar oluşturuldu. Yalnızca şimdi gösteriliyor; güvenli bir yere kaydet.", link: token };
}

export async function revokeApiKeyAction(form: FormData) {
  await requireUser();
  const id = z.uuid().safeParse(form.get("id"));
  if (id.success) await getRepo().revokeApiKey(id.data);
  revalidatePath("/panel/api");
}

// Newsletter ------------------------------------------------------------------------------------
export async function setNewsletterAction(form: FormData) {
  await requireUser();
  await getRepo().setNewsletter(form.get("on") === "1", LEGAL_VERSIONS.terms);
  revalidatePath("/panel/ayarlar");
}

// Send the report by e-mail (PDF attached) ---------------------------------------------------
const reportMailSchema = z.object({
  analysisId: z.uuid(),
  to: z.email("Geçerli bir e-posta adresi yaz.").max(320),
  note: z.string().trim().max(300, "Not en fazla 300 karakter olabilir.").default(""),
});

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendReportEmailAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = reportMailSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Gönderilemedi." };
  const d = parsed.data;
  const provider = getEmailProvider();
  if (!provider) return { error: "E-posta gönderimi bu kurulumda kapalı. PDF'i indirip kendin gönderebilirsin." };
  const limit = rateLimit(`report-mail:${await hashKey("report-mail", u.id)}`, 10, 60 * 60_000);
  if (!limit.ok) return { error: "Bir saatte en fazla 10 rapor gönderebilirsin. Biraz sonra tekrar dene." };
  const repo = getRepo();
  const a = await repo.getAnalysis(d.analysisId);
  if (!a || !a.ownedByMe || a.status !== "completed") return { error: "Rapor bulunamadı." };
  try {
    const [branding, creative] = await Promise.all([
      repo.getReportBranding(a.id),
      a.mediaType === "video" ? repo.getAssetBytes(a.id, 0) : a.asset ? repo.getAssetBytes(a.id) : Promise.resolve(null),
    ]);
    const pdf = await buildReportPdf(a, branding, { creative });
    const brandName = branding?.brandName ?? null;
    const sender = brandName || "Bir AdScope kullanıcısı";
    const note = d.note ? `\n\nNot: ${d.note}` : "";
    const text = `${sender} size bir reklam ön kontrol raporu gönderdi. Rapor ekteki PDF dosyasındadır.${note}\n\nRisk değerlendirmesidir, hukuki görüş değildir. Reklamın onaylanacağını garanti etmez.`;
    const html = `<p>${esc(sender)} size bir reklam ön kontrol raporu gönderdi. Rapor ekteki PDF dosyasındadır.</p>${d.note ? `<p><strong>Not:</strong> ${esc(d.note)}</p>` : ""}<p style="color:#56607a;font-size:13px">Risk değerlendirmesidir, hukuki görüş değildir. Reklamın onaylanacağını garanti etmez.</p>`;
    const r = await provider.send({
      to: d.to.toLowerCase(),
      subject: `Reklam ön kontrol raporu${brandName ? ` · ${brandName}` : ""}`,
      text,
      html,
      idempotencyKey: `report:${a.id}:${await hashKey(d.to.toLowerCase(), d.note)}`,
      attachments: [{ filename: `adscope-rapor-${a.id.slice(0, 8)}.pdf`, contentBase64: Buffer.from(pdf).toString("base64") }],
    });
    if (!r.ok) return { error: "E-posta şu an gönderilemedi. PDF'i indirip kendin gönderebilirsin." };
    return { error: null, ok: emailConfigured() ? `Rapor ${d.to} adresine gönderildi.` : `Demo modu: e-posta gerçekten gönderilmedi, demo kutusuna yazıldı (${d.to}).` };
  } catch {
    console.error("[report-mail] failed");
    return { error: "E-posta şu an gönderilemedi. PDF'i indirip kendin gönderebilirsin." };
  }
}
