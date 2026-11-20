import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getAdminRepo } from "@/lib/data";
import type { AdminRepo, ApprovalSubmission } from "@/lib/data/types";
import { getEmailProvider } from "@/lib/email/provider";
import { siteUrl } from "@/lib/env";
import { limit } from "@/lib/security/limiter";
import { hashToken, TOKEN_RE } from "@/lib/security/tokens";
import { APPROVAL_COMMENT_MAX, APPROVAL_DECISIONS, APPROVAL_KEY_RE, approvalCounts, cleanReviewerName } from "./index";

export type ApprovalFormResult = { ok: true; message: string } | { ok: false; message: string };

const itemSchema = z.object({
  itemKey: z.string().regex(APPROVAL_KEY_RE),
  decision: z.enum(APPROVAL_DECISIONS),
  comment: z.string().max(APPROVAL_COMMENT_MAX, `Yorum en fazla ${APPROVAL_COMMENT_MAX} karakter olabilir.`).nullable(),
});

/**
 * Reads the approval form: reviewerName, then for every item `d:<key>` (decision) and `c:<key>` (comment).
 * Items without a decision are skipped; a comment alone is not stored.
 */
export function parseApprovalForm(form: FormData): { ok: true; value: ApprovalSubmission } | { ok: false; message: string } {
  const name = cleanReviewerName(String(form.get("reviewerName") ?? ""));
  if (!name) return { ok: false, message: "Adını yaz. E-posta adresi istemiyoruz." };
  const items: ApprovalSubmission["items"] = [];
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("d:") || typeof v !== "string" || !v) continue;
    const key = k.slice(2);
    const comment = String(form.get(`c:${key}`) ?? "").replace(/\r\n/g, "\n").trim();
    const parsed = itemSchema.safeParse({ itemKey: key, decision: v, comment: comment || null });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message?.startsWith("Yorum") ? parsed.error.issues[0].message : "Seçimlerden biri okunamadı. Sayfayı yenileyip tekrar dene." };
    items.push(parsed.data);
  }
  if (!items.length) return { ok: false, message: "En az bir öğe için Onayla, Değişiklik iste ya da Reddet seç." };
  if (items.some((i) => i.decision !== "approved" && !i.comment)) {
    return { ok: false, message: "Değişiklik istediğin ya da reddettiğin öğelere kısa bir yorum yaz; ajansın neyi düzelteceğini bilsin." };
  }
  return { ok: true, value: { reviewerName: name, items } };
}

/**
 * Saves the customer's decisions behind a valid link and tells the owner by e-mail (Resend when set,
 * the demo outbox in demo mode, nothing otherwise). The customer's text is never logged.
 */
export async function submitApprovalForm(token: string, form: FormData, admin: AdminRepo = getAdminRepo()): Promise<ApprovalFormResult> {
  if (!TOKEN_RE.test(token)) return { ok: false, message: "Bu bağlantı geçersiz ya da süresi dolmuş." };
  const hash = hashToken(token);
  const rl = await limit(`approval:${hash.slice(0, 24)}`, 20, 60 * 60_000);
  if (!rl.ok) return { ok: false, message: "Kısa sürede çok fazla gönderim yapıldı. Biraz sonra tekrar dene." };
  const parsed = parseApprovalForm(form);
  if (!parsed.ok) return parsed;
  const res = await admin.submitApproval(hash, parsed.value);
  if (!res.ok) {
    return { ok: false, message: res.code === "invalid" ? "Bu bağlantı geçersiz, iptal edilmiş ya da süresi dolmuş." : "Kararların kaydedilemedi. Lütfen tekrar dene." };
  }
  try {
    await notifyOwner(admin, res.ownerId, res.analysisId, res.linkId, parsed.value, approvalCounts(res.itemKeys, res.decisions));
  } catch {
    console.error("[approval] owner notification failed");
  }
  return { ok: true, message: "Teşekkürler, kararların ajansa iletildi. Bağlantı geçerli olduğu sürece kararlarını değiştirebilirsin." };
}

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function notifyOwner(
  admin: AdminRepo,
  ownerId: string,
  analysisId: string,
  linkId: string,
  sub: ApprovalSubmission,
  counts: ReturnType<typeof approvalCounts>,
) {
  const mailer = getEmailProvider();
  if (!mailer) return;
  const contact = await admin.getUserContact(ownerId);
  if (!contact) return;
  const link = `${siteUrl()}/panel/analiz/${analysisId}#musteri`;
  const summary = `${counts.approved} onay, ${counts.changes_requested} değişiklik isteği, ${counts.rejected} ret, ${counts.pending} karar bekleyen öğe`;
  // The customer's name and comments stay in AdScope; the e-mail only says that a decision arrived.
  const key = createHash("sha256").update(JSON.stringify(sub)).digest("hex").slice(0, 32);
  await mailer.send({
    idempotencyKey: `approval:${linkId}:${key}`,
    to: contact.email,
    subject: "Müşteri onayı geldi",
    text: `Müşterin onay bağlantısından kararlarını gönderdi: ${summary}.\n\nAyrıntılar ve yorumlar raporda:\n${link}\n\nRisk değerlendirmesidir, hukuki görüş değildir.`,
    html: `<p>Müşterin onay bağlantısından kararlarını gönderdi: <strong>${esc(summary)}</strong>.</p><p><a href="${link}">Ayrıntıları ve yorumları raporda gör</a></p><p style="color:#56607a;font-size:13px">Risk değerlendirmesidir, hukuki görüş değildir.</p>`,
  });
}
