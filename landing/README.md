# FheCat · Tanıtım sayfası

Logo ve banner'ın piksel tarzında, FheCat'i yüzeysel olarak anlatan tek sayfalık site.
Derleme veya kurulum gerekmez: düz HTML, CSS ve JavaScript.

## Yayında

- **Vercel (ana adres):** https://fhecat.vercel.app
- **Render (yedek kopya):** https://fhecat.onrender.com

İkisi de bu dala her push'ta kendini günceller. Alan adı (domain) alınınca Vercel'de
projeye eklenir; ardından `index.html` içindeki `https://fhecat.vercel.app` adreslerini
(canonical ve paylaşım görseli) yeni alan adıyla değiştirmek yeterli.

## Açmak için

- `index.html` dosyasına çift tıkla (tarayıcıda doğrudan açılır), ya da
- klasörü herhangi bir statik barındırmaya yükle (GitHub Pages, Vercel, Netlify…).

Yerelde bir sunucuyla denemek istersen:

```bash
cd landing
python3 -m http.server 8080   # sonra http://localhost:8080
```

## İçindekiler

| Dosya | Ne yapar |
|---|---|
| `index.html` | Bölümler: giriş, hakkında, Fhenix, nasıl çalışır, koleksiyon, yol haritası, SSS |
| `css/styles.css` | Tüm stil ve küçük animasyonlar |
| `js/pixel.js` | ASCII piksel haritalarını keskin SVG'ye çeviren küçük yardımcı |
| `js/sprites.js` | Sayfadaki tüm piksel çizimler (logo, kedi, ikonlar, örnek kediler) |
| `js/scene.js` | Giriş bölümündeki canlı gece gökyüzü (ay, yıldızlar, bulutlar, kedi) |
| `js/i18n.js` | Türkçe / İngilizce metinler |
| `js/main.js` | Dil düğmesi, animasyonlar, şifresi çözülen kediler, yol haritası kedisi |
| `assets/` | Logo, banner ve X/sosyal medya paylaşım görseli (`og.png`, 1200×630) |
| `fonts/` | Press Start 2P ve Space Grotesk (SIL Open Font License) |

## Düzenleme ipuçları

- **Metinler:** `js/i18n.js` içinde, her dil için ayrı. Anahtarlar `index.html`'deki `data-i18n` ile eşleşir.
- **Çizimler:** `js/sprites.js` içinde satır satır yazılı. Her harf bir renk, `.` boş piksel demek
  (renkler `js/pixel.js` içindeki `PALETTE`'te). `'3.S2C'` gibi kısaltmalar "3 boş, 1 S, 2 C" anlamına gelir.
- **Hareketi azalt:** İşletim sisteminde "hareketi azalt" açıksa animasyonlar kendiliğinden durur.
