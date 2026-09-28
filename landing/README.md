# FheCat · Tanıtım sayfası

Logo ve banner'ın piksel tarzında, FheCat'i anlatan tek sayfalık site (İngilizce).
Derleme veya kurulum gerekmez: düz HTML, CSS ve JavaScript.

## Yayında

Site yalnızca **https://fhecat.com** adresinde (Vercel). Bu dala her push'ta kendini günceller.

- `www.fhecat.com` ve `fhecat.vercel.app`, fhecat.com'a kalıcı olarak yönlenir (`vercel.json`).
- Eski Render kopyası (`fhecat.onrender.com`) silinene kadar ziyaretçiyi fhecat.com'a gönderir
  (`index.html` başındaki küçük betik). Render panelinden silindikten sonra bu betik kaldırılabilir.

## Sayfanın akışı

Sayfa bir gece yürüyüşü gibi ilerler; her bölümün kendine ait küçük bir piksel sahnesi var:

1. **Giriş:** banner'daki gökyüzü canlı. "FheCat" yazısı gürültüden çözülerek belirir,
   kediye dokununca önce şifreli, sonra "Meow" der.
2. **Every cat is a secret:** şifreli kedi kartı. "Try to peek" denemesi hep "Access denied" ile biter.
3. **Math on locked boxes:** FHE'nin mantığı: `enc(3) + enc(4)` makineye girer, `enc(7)` çıkar,
   yalnızca izni olan açabilir.
4. **Every star is a cat:** yıldızların üstüne gelince zincirin gördüğü tek şey çıkar: şifreli veri.
5. **The night walk:** yol haritası. Kaydırdıkça kedi yürür, fenerler yanar.
6. **Encrypted messages:** SSS. Her cevap tıklanınca şifresi çözülen bir mesaj.

Koleksiyonun çizimleri sayfada hiçbir yerde açığa çıkmaz. Klavyede "reveal" yazmayı dene.

## Teknik doğruluk

FHE / Fhenix ile ilgili ifadeler, projedeki `@fhenixprotocol/cofhe-contracts` (0.2.0) kütüphanesine
göre kontrol edildi. Kontrol edilenler:

- şifreli tipler (`ebool`, `euint8`–`euint128`, `eaddress`),
- `FHE.add`, `FHE.allow` ve `FHE.randomEuint*` fonksiyonları,
- kendi verini imzalı bir izinle (permit) çözme.

Koleksiyonun nasıl çalışacağına dair cümleler "planlanan" olarak yazıldı.

## Açmak için

- `index.html` dosyasına çift tıkla (tarayıcıda doğrudan açılır), ya da
- klasörü herhangi bir statik barındırmaya yükle.

Yerelde bir sunucuyla denemek istersen:

```bash
cd landing
python3 -m http.server 8080   # sonra http://localhost:8080
```

## İçindekiler

| Dosya | Ne yapar |
|---|---|
| `index.html` | Sayfanın metinleri ve bölümleri |
| `css/styles.css` | Piksel tasarım sistemi ve animasyonlar |
| `js/pixel.js` | Metin halindeki piksel çizimleri keskin SVG'ye çeviren küçük yardımcı |
| `js/sprites.js` | Tüm piksel çizimler: logo, "FheCat" yazısı, kediler, fener, sandık, makine, zarf, ikonlar |
| `js/scene.js` | Gece sahneleri (giriş ve kapanış), yıldızlar ve bulut şeritleri |
| `js/main.js` | Etkileşimler ve animasyonlar |
| `assets/` | Favicon'lar, paylaşım görseli (`og.png`, 1200×630), orijinal logo ve banner |
| `fonts/` | Tiny5, Silkscreen, Press Start 2P (SIL Open Font License) |

## Keskin kalması için kurallar

- Fontlar yalnızca 8'in katı boyutlarda kullanılır (8, 16, 24, 32, 40, 48 px). Ara boyutlar pikselleri bulanıklaştırır.
- Çizimler tam sayı ölçekle büyütülür (`--u: 4px` gibi). `4.5px` gibi değerler kullanılmaz.
- Bulanık gölge, `blur` veya `filter` yok; gölgeler sert piksel gölgeler.
- Hareketler `steps()` ile tam piksel adımlarla ilerler.

## Düzenleme ipuçları

- **Metinler:** doğrudan `index.html` içinde.
- **Çizimler:** `js/sprites.js` içinde satır satır yazılı. Her harf bir renk, `.` boş piksel demek
  (renkler `js/pixel.js` içindeki `PALETTE`'te). `'3.S2C'` gibi kısaltmalar "3 boş, 1 S, 2 C" anlamına gelir.
- **Hareketi azalt:** İşletim sisteminde "hareketi azalt" açıksa animasyonlar kendiliğinden durur.
