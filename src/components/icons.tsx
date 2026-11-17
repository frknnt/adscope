import type { SVGProps } from "react";

/** Authored 24px line icons, 1.75 stroke. */
function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export const IconUpload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 15V4" /><path d="m7 9 5-5 5 5" /><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></svg>
);
export const IconScale = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 4v16" /><path d="M7 20h10" /><path d="M5 8h14" /><path d="m5 8-2.5 6a3 3 0 0 0 5 0Z" /><path d="m19 8-2.5 6a3 3 0 0 0 5 0Z" /></svg>
);
export const IconMeta = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2.5" /></svg>
);
export const IconSpark = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6.5 6.5 2 2M15.5 15.5l2 2M6.5 17.5l2-2M15.5 8.5l2-2" /></svg>
);
export const IconPen = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
);
export const IconDoc = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M10 13h6M10 17h6" /></svg>
);
export const IconHistory = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M12 8v4l3 2" /></svg>
);
export const IconCoin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><ellipse cx="12" cy="7" rx="7" ry="3" /><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" /><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></svg>
);
export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
);
export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /></svg>
);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconAppeal = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></svg>
);
export const IconExternal = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 14, height: 14, ...p })}><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const IconCopy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 16, height: 16, ...p })}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m5 12 4.5 4.5L19 7" /></svg>
);
export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 4 2.5 20h19Z" /><path d="M12 10v4M12 17h.01" /></svg>
);
export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);
export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></svg>
);
export const IconPrint = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></svg>
);
export const IconMenu = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></svg>
);
export const IconImage = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m4 18 5-5 3.5 3.5L15 14l5 5" /></svg>
);
export const IconVideo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="6.5" y="2.5" width="11" height="19" rx="2.2" /><path d="m10.5 9.5 4 2.5-4 2.5Z" /></svg>
);
export const IconLink = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></svg>
);
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
);
export const IconTag = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9Z" /><circle cx="8.5" cy="8.5" r="1.5" /></svg>
);
export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></svg>
);
export const IconBoard = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3.5" y="3.5" width="7" height="9" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.5" /><rect x="3.5" y="15.5" width="7" height="5" rx="1.5" /></svg>
);
export const IconKey = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="8" cy="15" r="4" /><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2" /></svg>
);
