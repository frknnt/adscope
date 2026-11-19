# AdScope tarayıcı eklentisi (Chrome / Edge, Manifest V3)

Bir sayfada gördüğün ya da yazdığın reklam metnini tek tıkla AdScope ön kontrolüne gönderir.

## Ne yapar?

- **Sağ tık → "Seçili metni AdScope ile kontrol et"**: seçili metinle AdScope'ta yeni analiz sihirbazını açar.
- **Sağ tık → "Bu sayfayı açılış sayfası olarak kontrol et"**: sayfa adresini sihirbazın açılış sayfası alanına koyar.
- **Sağ tık → "Bu sayfadaki seçili metinleri toplu kontrole gönder"**: seçtiğin metni satır satır (en fazla 20) panelin Toplu kontrol sayfasındaki "Platform varyantları" moduna koyar. Örneğin bir reklam platformunun yapay zekâ aracının yazdığı varyantları seçip gönderebilirsin. Yalnızca senin seçtiğin metin taşınır. Chrome birden çok öğeyi tek satırda birleştirebilir; gerekirse panelde satırlara ayır.
- **Araç çubuğu düğmesi**: metni yapıştırıp "Kontrol et" ile aynı sihirbazı açar.

Görseli/videoyu sihirbazda sen eklersin; analiz ve kredi kullanımı paneldeki gibidir. Oturum açık değilse önce giriş sayfası açılır.

## Gizlilik

- Eklenti hiçbir sunucuya istek göndermez, sayfa içeriğini okumaz, analiz yapmaz. Tek izinleri `contextMenus` (sağ tık menüsü) ve `storage` (AdScope adresini hatırlamak).
- Metin, açılan adresin `#` kısmında taşınır. Tarayıcılar bu kısmı sunucuya göndermediği için reklam metni sunucu veya barındırma kayıtlarına girmez; sihirbaz metni okuduktan sonra adres çubuğundan siler.
- Yalnızca `https://` AdScope adresleri kabul edilir (geliştirme için `http://localhost`).

## Kurulum (geliştirici modu)

1. Chrome'da `chrome://extensions` (Edge'de `edge://extensions`) sayfasını aç, **Geliştirici modu**nu etkinleştir.
2. **Paketlenmemiş öğe yükle** ile bu `extension/` klasörünü seç.
3. Araç çubuğundaki AdScope simgesine tıkla, **Ayarlar** altında AdScope adresini (ör. `https://adscope.alanadiniz.com`) kaydet.

Chrome Web Mağazası'nda yayımlamak için bu klasörü zip'leyip geliştirici hesabından yüklemek yeterli; mağaza hesabı ve gizlilik politikası bağlantısı gerekir.

Risk değerlendirmesidir, hukuki görüş değildir.
