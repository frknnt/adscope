"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconAppeal, IconBoard, IconCalendar, IconCoin, IconHistory, IconHome, IconPlus, IconDoc, IconSettings, IconTag, IconUsers } from "@/components/icons";

const ITEMS = [
  { href: "/panel", label: "Pano", Icon: IconHome, exact: true },
  { href: "/panel/yeni", label: "Yeni analiz", Icon: IconPlus },
  { href: "/panel/toplu", label: "Toplu kontrol", Icon: IconDoc },
  { href: "/panel/gecmis", label: "Geçmiş", Icon: IconHistory, also: "/panel/analiz" },
  { href: "/panel/itiraz", label: "İtiraz asistanı", Icon: IconAppeal },
  { href: "/panel/takvim", label: "Sezon takvimi", Icon: IconCalendar },
  { href: "/panel/ilham", label: "İlham panosu", Icon: IconBoard },
  { href: "/panel/markalar", label: "Markalar", Icon: IconTag },
  { href: "/panel/ekip", label: "Ekip", Icon: IconUsers },
  { href: "/panel/krediler", label: "Krediler", Icon: IconCoin },
  { href: "/panel/ayarlar", label: "Ayarlar", Icon: IconSettings },
];

export function PanelNav() {
  const path = usePathname();
  return (
    <nav aria-label="Panel menüsü" className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
      {ITEMS.map(({ href, label, Icon, exact, also }) => {
        const active = exact ? path === href : path.startsWith(href) || (also ? path.startsWith(also) : false);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-body font-semibold no-underline transition-colors ${
              active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-2 hover:text-ink"
            }`}
          >
            <Icon className="size-[18px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
