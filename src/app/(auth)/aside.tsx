export function AuthAside() {
  return (
    <aside className="sheet hidden rounded-[1.4rem] border border-line p-8 lg:block" aria-label="AdScope hakkında">
      <p className="font-display text-3xl font-semibold leading-snug">
        “<span className="mark-risk">7 günde 5 kilo</span> ver” yazmadan önce bir kez bak.
      </p>
      <ul className="mt-8 space-y-4 text-[0.95rem] leading-relaxed text-ink-soft">
        <li><strong className="text-ink">3 ücretsiz analiz.</strong> Kayıtta bir kez tanımlanır, kart bilgisi istenmez.</li>
        <li><strong className="text-ink">Kredi yalnızca rapor tamamlanınca düşer.</strong> Yarıda kalan analiz krediden yemez.</li>
        <li><strong className="text-ink">İçeriğin senin.</strong> Yüklediğin görsel ve metinler model eğitiminde kullanılmaz; istediğin an silebilirsin.</li>
      </ul>
      <p className="mt-8 border-t border-dashed border-line pt-4 text-[0.82rem] text-muted">Risk değerlendirmesidir, hukuki görüş değildir.</p>
    </aside>
  );
}
