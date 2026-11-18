"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ComponentType, type SVGProps } from "react";
import {
  IconAppeal,
  IconBoard,
  IconCalendar,
  IconDoc,
  IconKey,
  IconLink,
  IconMenu,
  IconMeta,
  IconPen,
  IconScale,
  IconSpark,
  IconUsers,
  IconVideo,
} from "./icons";
import { Logo } from "./logo";
import { buttonClass } from "./ui";

type Item = { href: string; label: string; desc: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; isNew?: boolean };

export const MENU: { group: string; items: Item[] }[] = [
  {
    group: "Kontrol et",
    items: [
      { href: "/#kontrol", label: "Reklam ön kontrolü", desc: "Meta, Google Ads, TikTok ve Türk mevzuatı", Icon: IconScale },
      { href: "/#video", label: "Video ve Reels analizi", desc: "Kareler, kanca, altyazı, dış ses", Icon: IconVideo },
      { href: "/reklamim-reddedilir-mi", label: "Ücretsiz hızlı kontrol", desc: "Kayıt olmadan metnini tara", Icon: IconSpark },
      { href: "/#hepsi", label: "Toplu kontrol", desc: "20 reklamı tek seferde tara", Icon: IconDoc, isNew: true },
    ],
  },
  {
    group: "Düzelt",
    items: [
      { href: "/#guvenli-metin", label: "Güvenli metin ve varyantlar", desc: "Riskli ifadeye güvenli öneri, 5 varyant", Icon: IconPen },
      { href: "/#itiraz", label: "İtiraz asistanı", desc: "Reddedilen reklam için TR + EN taslak", Icon: IconAppeal },
      { href: "/#ihtiyac", label: "Hesap kısıtlama rehberi", desc: "Adım adım ne yapmalı", Icon: IconMeta, isNew: true },
    ],
  },
  {
    group: "Planla ve yönet",
    items: [
      { href: "/#hepsi", label: "Sezon takvimi", desc: "Türkiye'ye özel kampanya günleri", Icon: IconCalendar },
      { href: "/#hepsi", label: "İlham panosu", desc: "Uzun süre yayında kalan reklamlar", Icon: IconBoard, isNew: true },
      { href: "/#ajans", label: "Ajans modu", desc: "Çoklu marka, ekip, avukat bağlantısı", Icon: IconUsers },
      { href: "/#hepsi", label: "API ve Chrome eklentisi", desc: "Kendi akışına bağla", Icon: IconKey },
    ],
  },
];

const LINKS = [
  { href: "/fiyatlandirma", label: "Fiyatlar" },
  { href: "/#ajans", label: "Ajanslar" },
  { href: "/kurallar", label: "Kurallar" },
];

function NewBadge() {
  return <span className="rounded-full bg-blue-tint px-1.5 py-px text-fine font-bold text-blue">Yeni</span>;
}

export function SiteNav({ loggedIn }: { loggedIn: boolean }) {
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const mobileId = useId();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus on link click, outside click and Escape.
  useEffect(() => {
    if (!menu && !mobile) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setMenu(false);
        setMobile(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (menu) trigger.current?.focus();
      setMenu(false);
      setMobile(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, mobile]);

  const ctas = loggedIn ? (
    <Link href="/panel" className={buttonClass("primary", "h-11 px-4")}>
      Panele git
    </Link>
  ) : (
    <>
      <Link href="/giris" className="inline-flex min-h-11 items-center px-2 text-body font-semibold text-ink no-underline hover:text-blue">
        Giriş
      </Link>
      <span className="hidden lg:inline-flex">
        <Link href="/reklamim-reddedilir-mi" className={buttonClass("ghost", "h-11 px-4")}>
          Ücretsiz kontrol
        </Link>
      </span>
      <Link href="/kayit" className={buttonClass("primary", "h-11 px-4")}>
        Ücretsiz başla
      </Link>
    </>
  );

  return (
    <div
      ref={wrap}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) {
          setMenu(false);
          setMobile(false);
        }
      }}
      className={`no-print sticky top-0 z-40 border-b bg-paper/90 backdrop-blur-md transition-[border-color,box-shadow] ${scrolled ? "border-line shadow-[0_8px_24px_-20px_rgb(11_27_63/.5)]" : "border-transparent"}`}
    >
      <header className="relative mx-auto flex h-[4.25rem] max-w-[75rem] items-center gap-6 px-5 sm:px-6">
        <Logo />
        <nav aria-label="Ana menü" className="hidden items-center gap-1 lg:flex">
          <button
            ref={trigger}
            type="button"
            aria-expanded={menu}
            aria-controls={panelId}
            onClick={() => setMenu((v) => !v)}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-body font-semibold text-ink hover:bg-paper-2"
          >
            Özellikler
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden className={`transition-transform ${menu ? "rotate-180" : ""}`}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center rounded-lg px-3 text-body font-semibold text-ink no-underline hover:bg-paper-2">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 sm:flex">{ctas}</div>
        <button
          type="button"
          className="ml-auto inline-flex size-11 items-center justify-center rounded-xl border border-line text-ink sm:ml-2 lg:hidden"
          aria-expanded={mobile}
          aria-controls={mobileId}
          aria-label="Menüyü aç"
          onClick={() => setMobile((v) => !v)}
        >
          <IconMenu />
        </button>

        {/* Desktop mega menu */}
        {menu ? (
        <div
          id={panelId}
          className="absolute inset-x-5 top-full mt-2 hidden rounded-3xl border border-line bg-card p-6 shadow-raised sm:inset-x-6 lg:block"
        >
          <div className="grid grid-cols-[1fr_1fr_1fr_17rem] gap-6">
            {MENU.map((g) => (
              <div key={g.group}>
                <p className="px-3 text-fine font-bold uppercase tracking-[0.08em] text-muted">{g.group}</p>
                <ul className="mt-2 space-y-0.5">
                  {g.items.map((it) => (
                    <li key={it.label}>
                      <Link href={it.href} className="flex gap-3 rounded-xl p-3 no-underline hover:bg-paper-2">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-tint text-navy-700">
                          <it.Icon />
                        </span>
                        <span>
                          <span className="flex items-center gap-2 text-body font-bold text-ink">
                            {it.label} {it.isNew ? <NewBadge /> : null}
                          </span>
                          <span className="mt-0.5 block text-meta text-muted">{it.desc}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <Link href="/reklamim-reddedilir-mi" className="flex flex-col justify-between rounded-2xl p-5 text-paper no-underline" style={{ background: "var(--gradient-brand)" }}>
              <span>
                <span className="text-fine font-bold uppercase tracking-[0.08em] text-paper/80">Kayıt gerekmez</span>
                <span className="mt-2 block text-xl font-extrabold leading-snug">Reklam metnini 10 saniyede kontrol et</span>
              </span>
              <span className="mt-6 inline-flex items-center gap-1.5 text-body font-semibold">
                Ücretsiz kontrol <IconLink />
              </span>
            </Link>
          </div>
        </div>
        ) : null}
      </header>

      {/* Mobile menu */}
      <div id={mobileId} hidden={!mobile} className="max-h-[calc(100dvh-4.25rem)] overflow-y-auto border-t border-line bg-card px-5 pb-6 lg:hidden">
        {MENU.map((g) => (
          <div key={g.group} className="mt-5">
            <p className="text-fine font-bold uppercase tracking-[0.08em] text-muted">{g.group}</p>
            <ul className="mt-2 grid gap-1">
              {g.items.map((it) => (
                <li key={it.label}>
                  <Link href={it.href} className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-body font-semibold text-ink no-underline hover:bg-paper-2">
                    <span className="text-navy-700"><it.Icon /></span>
                    {it.label} {it.isNew ? <NewBadge /> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <ul className="mt-5 grid gap-1 border-t border-line pt-4">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex min-h-11 items-center rounded-xl px-2 text-body font-semibold text-ink no-underline">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2 sm:hidden">{ctas}</div>
      </div>
    </div>
  );
}
