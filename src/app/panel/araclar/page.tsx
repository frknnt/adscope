import Link from "next/link";
import { requirePanelUser } from "@/app/panel/guard";
import { getRepo } from "@/lib/data";
import { IMAGE_OPS } from "@/lib/image/costs";
import { SCENES } from "@/lib/image/scenes";
import { getImageProvider, SCENE_SIZES } from "@/lib/image/service";
import { ResizeTool, WatermarkTool } from "./local-tools";
import { ProviderTool } from "./provider-tool";
import { GenaiTool } from "./genai-tool";
import { GENAI_OPS, IMAGE_ASPECTS, VIDEO_ASPECTS } from "@/lib/genai/costs";
import { getGenaiProvider } from "@/lib/genai/service";

export const metadata = { title: "Görsel araçları" };

const TOOLS = [
  { id: "yz-gorsel", label: "Yapay zekâ görseli", provider: "genai", price: `${GENAI_OPS.ai_image.creditsPerResult} kredi/görsel` },
  { id: "yz-video", label: "Yapay zekâ videosu", provider: "genai", price: `${GENAI_OPS.ai_video.creditsPerResult} kredi` },
  { id: "sahne", label: "Ürün sahnesi", provider: "photoroom", price: `${IMAGE_OPS.product_scene.credits} kredi` },
  { id: "arka-plan", label: "Arka plan kaldır", provider: "photoroom", price: `${IMAGE_OPS.remove_background.credits} kredi` },
  { id: "buyut", label: "Büyüt", provider: "photoroom", price: `${IMAGE_OPS.upscale.credits} kredi` },
  { id: "boyut", label: "Boyutlandır ve kırp", provider: null, price: "ücretsiz" },
  { id: "filigran", label: "Filigran ve logo", provider: null, price: "ücretsiz" },
] as const;
type ToolId = (typeof TOOLS)[number]["id"];

export default async function ToolsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePanelUser();
  const sp = await searchParams;
  const tool: ToolId = TOOLS.find((t) => t.id === sp.arac)?.id ?? "yz-gorsel";
  const meta = TOOLS.find((t) => t.id === tool)!;
  const repo = getRepo();
  const [balance, brands] = await Promise.all([repo.getBalance(), repo.listBrands()]);
  const provider = getImageProvider();
  const genai = getGenaiProvider();
  const connected = meta.provider === "genai" ? Boolean(genai) : meta.provider === "photoroom" ? Boolean(provider) : true;

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">Görsel araçları</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Yapay zekâyla sıfırdan görsel ve kısa video üret, fotoğrafını işle, indir. Boyutlandırma, kırpma ve filigran cihazında çalışır ve ücretsizdir; diğer araçlar kredi kullanır.
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
                <span className={`text-meta font-medium ${t.id === tool ? "text-paper/80" : "text-muted"}`}>{t.price}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="arac-baslik" className="mt-6 max-w-3xl">
        <h2 id="arac-baslik" className="text-2xl font-bold">{meta.label}</h2>
        {!connected ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line-strong bg-card px-6 py-8 text-ink-soft">
            {meta.provider === "genai" ? "Yapay zekâ üretimi bu ortamda bağlı değil; bu araç kapalı." : "Görsel sağlayıcısı bu ortamda bağlı değil; bu araç kapalı."} Boyutlandırma ve filigran araçları çalışmaya devam eder.
          </p>
        ) : tool === "yz-gorsel" ? (
          <GenaiTool op="ai_image" perResult={GENAI_OPS.ai_image.creditsPerResult} maxResults={GENAI_OPS.ai_image.maxResults} balance={balance} aspects={[...IMAGE_ASPECTS]} />
        ) : tool === "yz-video" ? (
          <GenaiTool op="ai_video" perResult={GENAI_OPS.ai_video.creditsPerResult} maxResults={1} balance={balance} aspects={[...VIDEO_ASPECTS]} />
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
