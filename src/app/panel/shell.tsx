"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type SVGProps } from "react";
import { signOutAction } from "@/app/(auth)/actions";
import {
  IconChart,
  IconGift,
  IconAppeal,
  IconSpark,
  IconTools,
  IconBoard,
  IconCalendar,
  IconClose,
  IconCoin,
  IconDoc,
  IconHistory,
  IconHome,
  IconKey,
  IconLogout,
  IconMenu,
  IconPlus,
  IconSettings,
  IconTag,
  IconUsers,
} from "@/components/icons";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";

type Item = { href: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; exact?: boolean; also?: string };

const GROUPS: { title: string | null; items: Item[] }[] = [
  { title: null, items: [{ href: "/panel", label: "Pano", Icon: IconHome, exact: true }] },
  {
    title: "Kontrol et",
    items: [
      { href: "/panel/yeni", label: "Yeni analiz", Icon: IconPlus },
      { href: "/panel/toplu", label: "Toplu kontrol", Icon: IconDoc },
      { href: "/panel/gecmis", label: "Raporlar", Icon: IconHistory, also: "/panel/analiz" },
    ],
  },
  {
    title: "Üret ve düzelt",
    items: [
      { href: "/panel/uret", label: "Üret", Icon: IconSpark },
      { href: "/panel/araclar", label: "Görsel araçları", Icon: IconTools },
      { href: "/panel/itiraz", label: "İtiraz asistanı", Icon: IconAppeal },
    ],
  },
  {
    title: "Planla",
    items: [
      { href: "/panel/takvim", label: "Sezon takvimi", Icon: IconCalendar },
      { href: "/panel/ilham", label: "İlham panosu", Icon: IconBoard },
      { href: "/panel/performans", label: "Performans", Icon: IconChart },
    ],
  },
  {
    title: "Yönet",
    items: [
      { href: "/panel/markalar", label: "Markalar", Icon: IconTag },
      { href: "/panel/ekip", label: "Ekip", Icon: IconUsers },
      { href: "/panel/api", label: "API", Icon: IconKey },
    ],
  },
];

const EXTRA: Item[] = [
  { href: "/panel/krediler", label: "Krediler", Icon: IconCoin },
  { href: "/panel/davet", label: "Davet et", Icon: IconGift },
  { href: "/panel/ayarlar", label: "Ayarlar", Icon: IconSettings },
];

const ALL_ITEMS = [...GROUPS.flatMap((g) => g.items), ...EXTRA];

function isActive(path: string, it: Item) {
  return it.exact ? path === it.href : path.startsWith(it.href) || (it.also ? path.startsWith(it.also) : false);
}

function NavLink({ it, path }: { it: Item; path: string }) {
  const active = isActive(path, it);
  return (
    <Link
      href={it.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-body font-semibold no-underline transition-colors ${
        active ? "bg-tint text-ink before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-blue" : "text-ink-soft hover:bg-paper-2 hover:text-ink"
      }`}
    >
      <it.Icon className={`size-[18px] ${active ? "text-blue" : ""}`} />
      {it.label}
    </Link>
  );
}

function NavBody({ path, balance, email }: { path: string; balance: number; email: string }) {
  const low = balance <= 2;
  return (
    <>
      <nav aria-label="Panel menüsü" className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {GROUPS.map((g) => (
          <div key={g.title ?? "ana"}>
            {g.title ? <p className="px-3 pb-1.5 text-fine font-bold uppercase tracking-[0.08em] text-muted">{g.title}</p> : null}
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.href}>
                  <NavLink it={it} path={path} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-2 border-t border-line px-4 py-3">
        <Link href="/panel/krediler" className={`block rounded-xl px-4 py-2.5 no-underline ${low ? "bg-amber-tint" : "bg-paper-2"}`}>
          <span className="flex items-center justify-between">
            <span className="text-meta font-semibold text-muted">Kredi bakiyesi</span>
            <span className={`text-meta font-bold ${low ? "text-amber" : "text-blue"}`}>Kredi al</span>
          </span>
          <span className="block text-xl font-extrabold tabular text-ink">
            {balance} <span className="text-small font-semibold text-ink-soft">analiz</span>
          </span>
        </Link>
        <div className="flex items-center gap-1 pl-3">
          <span className="min-w-0 flex-1 truncate text-meta text-muted" title={email}>
            {email}
          </span>
          <Link
            href="/panel/ayarlar"
            aria-label="Ayarlar"
            title="Ayarlar"
            aria-current={path.startsWith("/panel/ayarlar") ? "page" : undefined}
            className={`inline-flex size-11 items-center justify-center rounded-lg hover:bg-paper-2 hover:text-ink ${path.startsWith("/panel/ayarlar") ? "bg-tint text-blue" : "text-ink-soft"}`}
          >
            <IconSettings className="size-4" />
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="inline-flex size-11 items-center justify-center rounded-lg text-ink-soft hover:bg-paper-2 hover:text-ink" aria-label="Çıkış yap" title="Çıkış yap">
              <IconLogout className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function crumbs(path: string): string[] {
  if (path.startsWith("/panel/analiz/")) return ["Raporlar", path.endsWith("/rapor") ? "Yazdırılabilir rapor" : "Rapor"];
  if (path === "/panel/baslangic") return ["Başlangıç"];
  if (path === "/panel/ekip/katil") return ["Ekip", "Davet"];
  const it = [...ALL_ITEMS].sort((a, b) => b.href.length - a.href.length).find((i) => isActive(path, i));
  return it ? [it.label] : [];
}

/** Command palette: pages and quick actions, Ctrl/Cmd + K. */
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const listId = useId();
  const entries = useMemo(
    () => [
      { href: "/panel/yeni", label: "Yeni analiz başlat", hint: "Eylem" },
      { href: "/panel/toplu", label: "Toplu kontrol yap", hint: "Eylem" },
      { href: "/panel/uret", label: "Reklam metni üret", hint: "Eylem" },
      { href: "/panel/uret?sekme=gorsel", label: "Reklam görseli üret", hint: "Eylem" },
      { href: "/panel/araclar", label: "Görsel araçları", hint: "Eylem" },
      { href: "/panel/itiraz", label: "İtiraz taslağı hazırla", hint: "Eylem" },
      ...ALL_ITEMS.map((i) => ({ href: i.href, label: i.label, hint: "Sayfa" })),
    ],
    [],
  );
  const norm = (s: string) => s.toLocaleLowerCase("tr");
  const shown = entries.filter((e) => norm(e.label).includes(norm(q.trim())));

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function go(href: string) {
    onClose();
    setQ("");
    router.push(href);
  }

  return (
    <dialog
      ref={ref}
      aria-label="Komut paleti"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="mx-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink shadow-float backdrop:bg-[rgb(var(--shadow-color)/0.4)]"
    >
      <input
        autoFocus
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSel(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSel((s) => Math.min(s + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSel((s) => Math.max(s - 1, 0));
          } else if (e.key === "Enter" && shown[sel]) {
            e.preventDefault();
            go(shown[sel].href);
          }
        }}
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={shown[sel] ? `${listId}-${sel}` : undefined}
        aria-label="Sayfa veya eylem ara"
        placeholder="Sayfa veya eylem ara…"
        className="w-full border-b border-line bg-transparent px-5 py-4 text-base outline-none placeholder:text-placeholder"
      />
      <ul id={listId} role="listbox" aria-label="Sonuçlar" className="max-h-80 overflow-y-auto p-2">
        {shown.length === 0 ? <li className="px-3 py-6 text-center text-small text-muted">Sonuç yok.</li> : null}
        {shown.map((e, i) => (
          <li
            key={`${e.hint}-${e.href}-${e.label}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === sel}
            onMouseEnter={() => setSel(i)}
            onClick={() => go(e.href)}
            className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-body font-semibold ${i === sel ? "bg-tint text-ink" : "text-ink-soft"}`}
          >
            {e.label}
            <span className="text-fine font-bold uppercase tracking-wide text-muted">{e.hint}</span>
          </li>
        ))}
      </ul>
    </dialog>
  );
}

export function PanelShell({ balance, email, children }: { balance: number; email: string; children: React.ReactNode }) {
  const path = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const drawerId = useId();
  const trail = crumbs(path);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const bottom: Item[] = [
    { href: "/panel", label: "Pano", Icon: IconHome, exact: true },
    { href: "/panel/gecmis", label: "Raporlar", Icon: IconHistory, also: "/panel/analiz" },
    { href: "/panel/itiraz", label: "İtiraz", Icon: IconAppeal },
  ];

  return (
    <div className="min-h-dvh bg-paper-2 lg:pl-[16.5rem]">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[16.5rem] flex-col border-r border-line bg-card lg:flex">
        <div className="flex h-16 items-center px-6">
          <Logo href="/panel" />
        </div>
        <NavBody path={path} balance={balance} email={email} />
      </aside>

      {/* Top bar */}
      <header className="no-print sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[75rem] items-center gap-3 px-4 sm:px-8 lg:h-16 lg:px-10">
          <span className="lg:hidden">
            <Logo href="/panel" />
          </span>
          <nav aria-label="Konum" className="hidden min-w-0 lg:block">
            <ol className="flex items-center gap-2 text-small font-semibold">
              <li className="text-muted">Panel</li>
              {trail.map((t, i) => (
                <li key={t} className={`flex items-center gap-2 ${i === trail.length - 1 ? "text-ink" : "text-muted"}`}>
                  <span aria-hidden className="text-line-strong">/</span>
                  {t}
                </li>
              ))}
            </ol>
          </nav>
          <button
            type="button"
            onClick={() => setPalette(true)}
            aria-label="Hızlı geçiş (Ctrl K)"
            className="ml-auto hidden h-11 w-64 items-center justify-between rounded-xl border border-line bg-paper-2 px-3 text-small text-muted hover:border-line-strong md:flex"
          >
            Ara…
            <kbd className="rounded-md border border-line bg-card px-1.5 text-fine font-semibold text-muted">Ctrl K</kbd>
          </button>
          <Link
            href="/panel/krediler"
            className={`ml-auto inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-small font-bold no-underline md:ml-0 ${balance <= 2 ? "border-amber/30 bg-amber-tint text-amber" : "border-line bg-card text-ink"}`}
          >
            <IconCoin className="size-4" />
            <span className="tabular">{balance}</span> kredi
          </Link>
          <span className="hidden sm:block">
            <Link href="/panel/yeni" className={buttonClass("primary", "h-11 px-4")}>
              <IconPlus className="size-4" /> Yeni analiz
            </Link>
          </span>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-xl border border-line text-ink lg:hidden"
            aria-expanded={drawer}
            aria-controls={drawerId}
            aria-label="Menüyü aç"
            onClick={() => setDrawer((v) => !v)}
          >
            <IconMenu />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <div id={drawerId} hidden={!drawer} className="no-print fixed inset-0 z-40 lg:hidden">
        <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-0 bg-[rgb(var(--shadow-color)/0.4)]" onClick={() => setDrawer(false)} />
        <div
          className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-card shadow-float"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setDrawer(false);
          }}
        >
          <div className="flex h-14 items-center justify-between px-5">
            <Logo href="/panel" />
            <button
              type="button"
              aria-label="Menüyü kapat"
              className="inline-flex size-10 items-center justify-center rounded-xl border border-line text-ink"
              onClick={() => setDrawer(false)}
            >
              <IconClose className="size-5" />
            </button>
          </div>
          <NavBody path={path} balance={balance} email={email} />
        </div>
      </div>

      <main id="icerik" className="px-4 pb-28 pt-6 sm:px-8 lg:px-10 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-[75rem]">{children}</div>
      </main>

      {/* Mobile bottom bar */}
      <nav aria-label="Hızlı gezinme" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="grid grid-cols-5 items-end">
          {bottom.slice(0, 2).map((it) => (
            <BottomItem key={it.href} it={it} path={path} />
          ))}
          <li className="flex justify-center">
            <Link href="/panel/yeni" aria-label="Yeni analiz" className="-mt-5 flex size-14 items-center justify-center rounded-2xl bg-ink text-paper shadow-raised">
              <IconPlus />
            </Link>
          </li>
          <BottomItem it={bottom[2]} path={path} />
          <li>
            <button type="button" onClick={() => setDrawer(true)} className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-fine font-bold text-ink-soft">
              <IconMenu className="size-5" />
              Menü
            </button>
          </li>
        </ul>
      </nav>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}

function BottomItem({ it, path }: { it: Item; path: string }) {
  const active = isActive(path, it);
  return (
    <li>
      <Link
        href={it.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-fine font-bold no-underline ${active ? "text-blue" : "text-ink-soft"}`}
      >
        <it.Icon className="size-5" />
        {it.label}
      </Link>
    </li>
  );
}
