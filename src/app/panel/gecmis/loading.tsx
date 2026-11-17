import { Skeleton } from "@/components/ui";

/**
 * Shown while this page's server data loads. Kept per page on purpose: a loading boundary streams
 * the response, so a page that calls notFound() (e.g. /panel/analiz/[id]) would answer 200, not 404.
 */
export default function PanelLoading() {
  return (
    <div role="status" aria-label="Yükleniyor">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="mt-6 h-64 rounded-2xl" />
      <span className="sr-only">Sayfa yükleniyor…</span>
    </div>
  );
}
