"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizeHex, normalizeWebsite } from "@/lib/brand/kit";
import { getCurrentUser, getRepo } from "@/lib/data";
import { fetchImage, testHostsAllowed } from "@/lib/landing/fetch";
import { scanSite, type SiteScan } from "@/lib/onboarding/site";
import { SECTOR_IDS } from "@/lib/sectors";
import { validateImage } from "@/lib/security/file-validation";
import { hashKey, rateLimit } from "@/lib/security/rate-limit";

export type ScanState = { ok: true; scan: SiteScan } | { ok: false; error: string };

/** Local end-to-end runs read a plain-http fixture page; production only accepts https sites. */
function siteAddress(raw: string): string | null {
  const url = raw.trim();
  return normalizeWebsite(url) ?? (testHostsAllowed() && /^http:\/\/127\.0\.0\.1:\d+(\/|$)/.test(url) ? url : null);
}

/** Reads the site and shows suggestions. Nothing is saved here. */
export async function scanSiteAction(url: string): Promise<ScanState> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: "Oturumun kapanmış. Lütfen yeniden giriş yap." };
  const website = siteAddress(String(url ?? "").slice(0, 300));
  if (!website) return { ok: false, error: "https:// ile başlayan geçerli bir adres yaz." };
  if (!rateLimit(`onboarding-site:${await hashKey("onboarding-site", u.id)}`, 10, 10 * 60_000).ok) return { ok: false, error: "Çok sık denedin. Birkaç dakika sonra tekrar dene." };
  try {
    const res = await scanSite(getRepo(), website);
    if (res.ok) return res;
    return {
      ok: false,
      error: res.status === "invalid_url" || res.status === "blocked" ? "Bu adres taranamıyor. Herkese açık bir web sitesi adresi yaz." : "Siten okunamadı. Adresi kontrol et ya da \"Sitem yok\" ile devam et.",
    };
  } catch {
    console.error("[onboarding] scan_failed");
    return { ok: false, error: "Siten şu an okunamadı. Biraz sonra yeniden dene ya da \"Sitem yok\" ile devam et." };
  }
}

const saveSchema = z.object({
  website: z.string().trim().max(300),
  name: z.string().trim().min(1, "Marka adını yaz.").max(80, "Marka adı en fazla 80 karakter olabilir."),
  sector: z.enum(SECTOR_IDS),
  tone: z.enum(["samimi", "kurumsal", "genc"]).default("samimi"),
  primaryColor: z.string().trim().max(9).default(""),
  tagline: z.string().trim().max(120, "Slogan en fazla 120 karakter olabilir.").default(""),
  logoUrl: z.string().trim().max(2048).default(""),
});

export type SaveState = { error: string | null };

/**
 * "Kaydet ve ilk paketimi hazırla": saves only what the user saw and approved (brand kit and default
 * sector), then opens the campaign package with the same address.
 */
export async function saveSiteOnboardingAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const u = await getCurrentUser();
  if (!u) redirect("/giris");
  const parsed = saveSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Lütfen alanları kontrol et." };
  const d = parsed.data;
  const address = siteAddress(d.website);
  if (!address) return { error: "Site adresi geçersiz. Yeniden tara." };
  const primaryColor = d.primaryColor ? normalizeHex(d.primaryColor) : null;
  if (d.primaryColor && !primaryColor) return { error: "Rengi #1a2b3c biçiminde yaz." };
  const repo = getRepo();
  const existing = (await repo.listBrands()).find((b) => b.name.toLocaleLowerCase("tr-TR") === d.name.toLocaleLowerCase("tr-TR"));
  let brandId = existing?.id ?? null;
  if (!brandId) {
    const brand = await repo.createBrand({ name: d.name, sector: d.sector, tone: d.tone, primaryColor, tagline: d.tagline || null, website: normalizeWebsite(address) });
    if (!brand) return { error: "Marka kaydedilemedi. Lütfen tekrar dene." };
    brandId = brand.id;
    if (d.logoUrl) {
      // The suggested logo is fetched again here and checked like an upload; a failure does not stop onboarding.
      const img = await fetchImage(d.logoUrl).catch(() => ({ ok: false as const }));
      const check = img.ok && img.bytes.length <= 1024 * 1024 ? validateImage(img.bytes, img.contentType, 64) : null;
      if (img.ok && check?.ok) await repo.setBrandLogo(brandId, { bytes: img.bytes, mime: check.meta.mime, ext: check.ext });
    }
  }
  const ok = await repo.updateProfile({ defaultSector: d.sector, onboardingCompletedAt: new Date().toISOString() });
  if (!ok) return { error: "Bilgiler kaydedilemedi. Lütfen tekrar dene." };
  redirect(`/panel/uret?${new URLSearchParams({ adres: address, marka: brandId, basla: "1" }).toString()}`);
}
