"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-renders the server page while an analysis is still processing (e.g. opened from a double submit). */
export function StatusPoller() {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (tries >= 40) return;
    const t = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, 3000);
    return () => clearTimeout(t);
  }, [tries, router]);
  return tries >= 40 ? <p className="mt-3 text-sm text-ink-soft">Hâlâ işleniyor. Sayfayı daha sonra yenileyin.</p> : null;
}
