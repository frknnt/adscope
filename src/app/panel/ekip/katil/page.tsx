import { redirect } from "next/navigation";
import { Button } from "@/components/ui";
import { getCurrentUser } from "@/lib/data";
import { TOKEN_RE } from "@/lib/security/tokens";
import { acceptInviteAction } from "../../agency-actions";

export const metadata = { title: "Ekip daveti", robots: { index: false, follow: false } };

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const token = (await searchParams).davet ?? "";
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/ekip/katil?davet=${TOKEN_RE.test(token) ? token : ""}`)}`);
  const valid = TOKEN_RE.test(token);
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">Ekip daveti</h1>
      {valid ? (
        <>
          <p className="mt-3 text-ink-soft">
            Daveti kabul edersen davet eden hesabın analizlerini ve raporlarını salt okunur görebilirsin. Senin analizlerin ve kredilerin onlarla paylaşılmaz.
            Daveti <strong>{user?.email}</strong> adresiyle kabul ediyorsun.
          </p>
          <form action={acceptInviteAction} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <Button type="submit" variant="accent">Daveti kabul et</Button>
          </form>
        </>
      ) : (
        <p role="alert" className="mt-4 rounded-xl bg-coral-tint px-4 py-3 font-medium text-coral-deep">Davet bağlantısı eksik veya hatalı.</p>
      )}
    </div>
  );
}
