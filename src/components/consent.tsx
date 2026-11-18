"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";

/**
 * Analytics consent (P7.3). Only shown when an analytics script is configured. Nothing but strictly
 * necessary cookies is used until the visitor says yes; "Yalnızca gerekli" is as easy as "İzin ver".
 * Analytics runs only on public pages (never in the panel, so report pages are not tracked).
 */
const COOKIE = "adscope_consent";
const OPEN_EVENT = "adscope:consent-open";

function readConsent(): "analytics" | "necessary" | null {
  const m = /(?:^|;\s*)adscope_consent=(analytics|necessary)/.exec(document.cookie);
  return (m?.[1] as "analytics" | "necessary") ?? null;
}

function writeConsent(v: "analytics" | "necessary") {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${v}; Max-Age=${180 * 86400}; Path=/; SameSite=Lax${secure}`;
}

function loadScript(src: string, domain: string) {
  if (document.querySelector("script[data-adscope-analytics]")) return;
  const s = document.createElement("script");
  s.defer = true;
  s.src = src;
  s.dataset.domain = domain;
  s.dataset.adscopeAnalytics = "1";
  document.head.appendChild(s);
}

export function ConsentBanner({ scriptUrl, domain }: { scriptUrl: string; domain: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const c = readConsent();
    if (c === "analytics") loadScript(scriptUrl, domain);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the cookie is only readable after mount
    if (!c) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, [scriptUrl, domain]);
  if (!open) return null;
  const choose = (v: "analytics" | "necessary") => {
    writeConsent(v);
    setOpen(false);
    if (v === "analytics") loadScript(scriptUrl, domain);
    else if (document.querySelector("script[data-adscope-analytics]")) location.reload();
  };
  return (
    <section aria-label="Çerez tercihi" className="no-print fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-line bg-card p-4 shadow-raised sm:p-5">
      <p className="text-body text-ink">
        Siteyi geliştirmek için anonim ziyaret istatistiği toplamak istiyoruz. Reklam ya da takip çerezi kullanılmaz; panel ve raporlar istatistiğe dahil edilmez.{" "}
        <a href="/gizlilik#cerezler" className="font-semibold">Ayrıntılar</a>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={() => choose("necessary")}>Yalnızca gerekli</Button>
        <Button type="button" variant="primary" onClick={() => choose("analytics")}>İzin ver</Button>
      </div>
    </section>
  );
}

export function ConsentSettingsButton() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className="inline-flex min-h-11 items-center text-paper/85 hover:text-paper hover:underline">
      Çerez tercihleri
    </button>
  );
}
