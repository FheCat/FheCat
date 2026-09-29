# FheCat · Tanıtım sayfası

Logo ve banner'ın piksel tarzında, FheCat'i anlatan site (İngilizce) ve bekleme listesi (waitlist) sayfası.
Sayfalar düz HTML, CSS ve JavaScript; derleme gerekmez. Yalnızca waitlist kaydı küçük bir sunucu fonksiyonu
(`api/waitlist.js`) ve bir veritabanı kullanır.

## Yayında

Site yalnızca **https://fhecat.com** adresinde (Vercel). Bu dala her push'ta kendini günceller.

- `www.fhecat.com` ve `fhecat.vercel.app`, fhecat.com'a kalıcı olarak yönlenir (`vercel.json`).
- Eski Render kopyası (`fhecat.onrender.com`) silinene kadar ziyaretçiyi fhecat.com'a gönderir
  (`index.html` ve `waitlist.html` başındaki küçük betik). Render panelinden silindikten sonra bu betik kaldırılabilir.

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

## Waitlist

**https://fhecat.com/waitlist** adresinde, beş kısa adım:

1. **Follow @FheCat:** X'te takip.
2. **Get your card:** X kullanıcı adını yazar, kendi piksel WL kartını kaydeder (PNG, 1280×720).
   Kart numarası, DNA ve kartın üstündeki gürültülü kedi kullanıcı adından üretilir; herkesinki farklıdır.
3. **Post your card:** hazır metinle X'te paylaşır, kartı ekler, postun linkini yapıştırır.
4. **Like, repost & reply:** lansman postunu beğenir, RT'ler ve kartı ekleyerek yanıtlar, yanıtın linkini yapıştırır.
5. **Add your wallet:** EVM cüzdan adresini girer, kayıt gönderilir.

İlerleme tarayıcıda saklanır; X'e gidip dönen kişi kaldığı adımdan devam eder. Telefonda "Save card" ve
"Post on X" kartı paylaşım menüsüne verir, böylece X'e kart ekli açılabilir.

**Adım 4'ü açmak:** ilk post atılınca `js/waitlist.js` içindeki satıra linki yazıp push etmek yeterli:

```js
var LAUNCH_POST = 'https://x.com/FheCat/status/...';
```

O zamana kadar adım 4 "Soon" olarak kilitli durur.

**Kayıtlar:** Neon Postgres, proje `fhecat`, tablo `waitlist`. Bağlantı adresi Vercel'de `DATABASE_URL`
ortam değişkeninde durur (repoda yoktur). Sunucu şunları kontrol eder: kullanıcı adı ve cüzdan biçimi,
iki linkin de o kullanıcının postu olması, aynı kullanıcı adı / cüzdan / linkin ikinci kez kullanılmaması.

**Elle kontrol:** takip, beğeni, RT ve kartın eklenmiş olması X'in ücretli API'si olmadan bir web sayfasından
doğrulanamaz. Bu yüzden her kayıt `pending` olarak gelir; linklere bakılıp `approved` ya da `rejected` yapılır.
Neon panelindeki SQL Editor'da:

```sql
-- bekleyenler
SELECT id, handle, wallet, post_url, reply_url, created_at FROM waitlist WHERE status = 'pending' ORDER BY id;
-- onayla / reddet
UPDATE waitlist SET status = 'approved' WHERE id = 42;
UPDATE waitlist SET status = 'rejected' WHERE id = 43;
-- mint için onaylı cüzdanlar
SELECT wallet FROM waitlist WHERE status = 'approved' ORDER BY id;
```

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

Waitlist sayfası da böyle açılır, ama son adımdaki kayıt yalnızca Vercel'de (`api/` fonksiyonu ve
`DATABASE_URL` ile) çalışır.

Yerelde bir sunucuyla denemek istersen:

```bash
cd landing
python3 -m http.server 8080   # sonra http://localhost:8080
```

## İçindekiler

| Dosya | Ne yapar |
|---|---|
| `index.html` | Sayfanın metinleri ve bölümleri |
| `waitlist.html` | Waitlist sayfası (beş adım) |
| `css/styles.css` | Piksel tasarım sistemi ve animasyonlar |
| `js/pixel.js` | Metin halindeki piksel çizimleri keskin SVG'ye çeviren küçük yardımcı |
| `js/sprites.js` | Tüm piksel çizimler: logo, "FheCat" yazısı, kediler, fener, sandık, makine, zarf, ikonlar |
| `js/scene.js` | Gece sahneleri (giriş ve kapanış), yıldızlar ve bulut şeritleri |
| `js/main.js` | Etkileşimler ve animasyonlar |
| `js/wlcard.js` | Piksel WL kartını çizer (kart numarası kullanıcı adından, `api/waitlist.js` ile aynı hesap) |
| `js/waitlist.js` | Waitlist adımları; `LAUNCH_POST` burada |
| `api/waitlist.js` | Kaydı doğrulayıp veritabanına yazan Vercel fonksiyonu |
| `package.json` | Fonksiyonun tek bağımlılığı (`@neondatabase/serverless`) |
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
