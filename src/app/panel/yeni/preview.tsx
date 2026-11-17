import type { Platform } from "@/lib/platforms";
import { PLATFORM_SHORT } from "@/lib/platforms";

/**
 * A plain sketch of how the ad might sit in a feed. It is deliberately generic (no platform logos,
 * fonts or UI chrome) so it never imitates a real app; it only helps the user read their text in context.
 */
export function AdPreview({
  platform,
  imageUrl,
  headline,
  primaryText,
  description,
  brandName,
}: {
  platform: Platform;
  imageUrl: string | null;
  headline: string;
  primaryText: string;
  description: string;
  brandName: string;
}) {
  const name = brandName || "Markan";
  const text = primaryText.trim() || "Ana metin burada görünecek.";
  const media = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
  ) : (
    <span className="absolute inset-0 flex items-center justify-center text-small text-muted">Görsel</span>
  );

  if (platform === "tiktok") {
    return (
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[15rem] overflow-hidden rounded-2xl bg-navy-950">
        {media}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/90 to-transparent p-3 pt-10 text-paper">
          <p className="text-small font-bold">@{name.toLocaleLowerCase("tr-TR").replace(/\s+/g, "")}</p>
          <p className="mt-1 line-clamp-3 text-meta leading-snug">{text}</p>
          <p className="mt-2 inline-flex rounded-md bg-paper/20 px-2 py-0.5 text-fine font-semibold">Sponsorlu</p>
        </div>
      </div>
    );
  }

  if (platform === "google_ads") {
    return (
      <div className="rounded-2xl border border-line bg-card p-4">
        <p className="text-fine font-bold text-ink">Sponsorlu · {name}</p>
        <p className="mt-1 line-clamp-2 text-body font-semibold text-blue">{headline.trim() || "Başlık burada görünecek"}</p>
        <p className="mt-1 line-clamp-3 text-small leading-snug text-ink-soft">{description.trim() || text}</p>
        <div className="relative mt-3 aspect-[1.91/1] overflow-hidden rounded-lg bg-tint">{media}</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center gap-2.5 p-3">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-tint text-small font-bold text-ink" aria-hidden>
          {name.slice(0, 1).toLocaleUpperCase("tr-TR")}
        </span>
        <span>
          <span className="block text-small font-bold text-ink">{name}</span>
          <span className="block text-fine text-muted">Sponsorlu</span>
        </span>
      </div>
      <p className="line-clamp-4 whitespace-pre-line px-3 pb-3 text-small leading-snug text-ink">{text}</p>
      <div className="relative aspect-square bg-tint">{media}</div>
      <div className="flex items-center justify-between gap-3 bg-paper-2 px-3 py-2.5">
        <span className="min-w-0">
          <span className="block truncate text-small font-bold text-ink">{headline.trim() || "Başlık"}</span>
          {description.trim() ? <span className="block truncate text-fine text-muted">{description}</span> : null}
        </span>
        <span className="shrink-0 rounded-lg bg-card px-2.5 py-1.5 text-fine font-bold text-ink">Daha fazla bilgi</span>
      </div>
    </div>
  );
}

export function PreviewFrame({ platform, children }: { platform: Platform; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-meta font-semibold text-muted">{PLATFORM_SHORT[platform]} akışında yaklaşık görünüm</p>
      <div className="mt-3">{children}</div>
      <p className="mt-3 text-fine leading-relaxed text-muted">Sade bir taslaktır; platformun gerçek görünümü cihaza ve yerleşime göre değişir.</p>
    </div>
  );
}
