import Link from "next/link";
import { requirePanelUser } from "@/app/panel/guard";
import { getRepo } from "@/lib/data";
import { IMAGE_OPS } from "@/lib/image/costs";
import { SCENES } from "@/lib/image/scenes";
import { getImageProvider, SCENE_SIZES } from "@/lib/image/service";
import { ResizeTool, WatermarkTool } from "./local-tools";
import { ProviderTool } from "./provider-tool";

export const metadata = { title: "Görsel araçları" };

const TOOLS = [
  { id: "sahne", label: "Ürün sahnesi", provider: true },
  { id: "arka-plan", label: "Arka plan kaldır", provider: true },
  { id: "buyut", label: "Büyüt", provider: true },
  { id: "boyut", label: "Boyutlandır ve kırp", provider: false },
  { id: "filigran", label: "Filigran ve logo", provider: false },
] as const;
type ToolId = (typeof TOOLS)[number]["id"];

export default async function ToolsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePanelUser();
  const sp = await searchParams;
  const tool: ToolId = TOOLS.find((t) => t.id === sp.arac)?.id ?? "sahne";
  const meta = TOOLS.find((t) => t.id === tool)!;
  const repo = getRepo();
  const [balance, brands] = await Promise.all([repo.getBalance(), repo.listBrands()]);
  const provider = getImageProvider();

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">Görsel araçları</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Fotoğraf yükle, işle, indir. Boyutlandırma, kırpma ve filigran cihazında çalışır ve ücretsizdir; arka plan kaldırma, büyütme ve ürün sahnesi görsel sağlayıcısıyla yapılır ve kredi kullanır.
      </p>
      <nav aria-label="Araçlar" className="-mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {TOOLS.map((t) => (
            <li key={t.id}>
              <Link
                href={`/panel/araclar?arac=${t.id}`}
                aria-current={t.id === tool ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-small font-semibold no-underline ${t.id === tool ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink hover:border-line-strong"}`}
              >
                {t.label}
                <span className={`text-meta font-medium ${t.id === tool ? "text-paper/80" : "text-muted"}`}>{t.provider ? `${IMAGE_OPS[t.id === "sahne" ? "product_scene" : t.id === "arka-plan" ? "remove_background" : "upscale"].credits} kredi` : "ücretsiz"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="arac-baslik" className="mt-6 max-w-3xl">
        <h2 id="arac-baslik" className="text-2xl font-bold">{meta.label}</h2>
        {meta.provider && !provider ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line-strong bg-card px-6 py-8 text-ink-soft">
            Görsel sağlayıcısı bu ortamda bağlı değil; bu araç kapalı. Boyutlandırma ve filigran araçları çalışmaya devam eder.
          </p>
        ) : tool === "sahne" ? (
          <ProviderTool
            op="product_scene"
            cost={IMAGE_OPS.product_scene.credits}
            balance={balance}
            providerName={provider!.name}
            scenes={SCENES.map((s) => ({ id: s.id, label: s.label }))}
            sizes={Object.entries(SCENE_SIZES).map(([id, s]) => ({ id, label: s.label }))}
          />
        ) : tool === "arka-plan" ? (
          <ProviderTool op="remove_background" cost={IMAGE_OPS.remove_background.credits} balance={balance} providerName={provider!.name} />
        ) : tool === "buyut" ? (
          <ProviderTool op="upscale" cost={IMAGE_OPS.upscale.credits} balance={balance} providerName={provider!.name} maxSide={provider!.upscaleMaxSide} />
        ) : tool === "boyut" ? (
          <ResizeTool />
        ) : (
          <WatermarkTool brands={brands.filter((b) => b.hasLogo).map((b) => ({ id: b.id, name: b.name }))} />
        )}
      </section>
    </div>
  );
}
