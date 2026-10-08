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
   Kartta sahibinin kedisi gökyüzünde bir takımyıldız: zincir yıldızların yerini görür, kedinin kendisini
   göremez. Aşağıda tepede FheCat teleskobuyla ona bakar. Poz (oturan kedi, yürüyen kedi ya da kedi yüzü),
   yıldızların yeri ve parlaklığı, gökyüzü ve kart numarası kullanıcı adından üretilir; herkesinki farklıdır.
   İsim her zaman büyük yazılır (3x ya da 2x).
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

## Admin paneli

**https://fhecat.com/admin** (arama motorlarına kapalı). Şifre Vercel'de `ADMIN_PASSWORD` ortam değişkeninde durur;
giriş 12 saat geçerli bir oturum açar. Panelde:

- **Sayaçlar:** tümü, bekleyen, onaylı, reddedilen ve son 24 saatte gelenler. Kutucuklar aynı zamanda filtredir.
- **Arama:** kullanıcı adı, cüzdan ya da kart numarasıyla.
- **İnceleme:** her başvuruda X profili, kart postu ve yanıt linki. Tek tıkla Approve / Reject / Pending,
  kutucukları işaretleyerek toplu işlem.
- **Dışa aktarma** (seçili sekme için, tüm sayfalar): başvurular `.csv`, cüzdanlar `.csv` ya da `.txt`
  (satır başına bir adres, küçük harf). Mint için: Approved sekmesi → Wallets.
- **Collabs sekmesi:** fhecat.com/collab başvuruları kart olarak listelenir: topluluk ve yönetici bilgileri, linkler, tanıtım.
  - Onaylarken WL yer sayısı ve süre (saat) girilir. Onaylı bir topluluğun yer sayısı ve süresi güncellenebilir, gönderilmiş listesi yeniden açılabilir.
  - Kazananlar kartta açılıp kopyalanabilir. Çekiliş postunun linki de kartta durur; post topluluğun kendi X hesabından değilse yanında uyarı çıkar.
  - **Allowlist .txt:** Onaylı waitlist cüzdanlarını ve onaylı collab'ların kazananlarını tekrarsız tek dosyada birleştirir. Gönderilmemiş taslak listeler varsa onları dahil edip etmeyeceğini sorar.
  - **Collab wallets .csv:** Topluluk, çekiliş postu, kazanan, cüzdan ve gönderildi bilgisi.
- **Arena sekmesi:** Testnet'teki Kör Arena, doğrudan zincirden okunur ve sekme açıkken 30 saniyede bir yenilenir: düello sayısı, açık meydan okumalar (sekmedeki sayı), sonuç bekleyenler, son sonuçlar, haftanın tablosu (puan, galibiyet/mağlubiyet, rozetler, kutu durumu), geçen haftanın tacı ve kademe kanıtları. Taktikler, puanlar ve DNA görünmez; zaten kimse göremez. Oynamak için **Open the arena**, test mint kopyasında doğrudan arena bölümünü açar.
  - Her kedi listede dövüştüğü haliyle, tam vücut ve nefes alarak durur: açılmış kedi kendisi olarak, diğerleri kendi barkodlu kutusu olarak. Her sonucun yanındaki **Watch** düelloyu mint sitesindeki sahneyle oynatır; admin de bir seyirci gibi kavga bulutunu ve kazananı görür, taktikleri yalnızca iki oyuncu görebilir.
  - Dövüşçüler ve sahne `admin/mint/arena-game.js`'ten gelir: mint sitesinin oyun motoru, React'siz tek dosya (`cd web && npm run build:admin-copy` ya da yalnızca `npm run build:admin-game`). Koleksiyonun çizimlerini taşıdığı için test mint kopyasıyla aynı klasörde, aynı girişin arkasındadır ve sekme onu giriş yapınca yükler. Yüklenemezse sekme yazıyla çalışmaya devam eder. CI, dosyanın güncel koddan derlendiğini kontrol eder.

Şifreyi değiştirmek için Vercel → Project → Settings → Environment Variables → `ADMIN_PASSWORD`, sonra yeniden
deploy. Şifre değişince açık oturumlar kapanır.

Aynı işler Neon panelindeki SQL Editor'dan da yapılabilir:

```sql
-- bekleyenler
SELECT id, handle, wallet, post_url, reply_url, created_at FROM waitlist WHERE status = 'pending' ORDER BY id;
-- onayla / reddet
UPDATE waitlist SET status = 'approved' WHERE id = 42;
UPDATE waitlist SET status = 'rejected' WHERE id = 43;
-- mint için onaylı cüzdanlar
SELECT wallet FROM waitlist WHERE status = 'approved' ORDER BY id;
```

## Collab

**https://fhecat.com/collab** adresinde. Ana sayfadaki üçüncü düğme (**Collab**) buraya gelir. DAO'lar, guild'ler ve alpha grupları allowlist yeri ister, onaylanınca kendi topluluklarında çekiliş yapıp kazananların cüzdanlarını girer.

1. **Apply:** Form hemen açılır, önce cüzdan bağlamak gerekmez. Topluluk adı, türü (DAO, Guild, Alpha group, NFT project, Other), topluluğun X hesabı, isteğe bağlı Discord daveti ve web sitesi, üye sayısı, istenen yer sayısı, yöneticinin X ve Discord adı, rolü ve kısa bir tanıtım. Bir cüzdan en fazla 5 toplulukla başvurabilir; aynı topluluk X hesabı iki kez başvuramaz.
2. **Gönderme:** Formun altındaki **Apply with …** düğmesi önce formu sunucuda kontrol ettirir (hatalı bir alan imzaya mal olmasın diye), sonra cüzdan bir kez imza atar (ücretsiz, işlem göndermez) ve başvuru kaydedilir. Sunucu imzalı bir mesaj verir, cüzdan imzalar, sunucu imzayı doğrulayıp 7 günlük bir oturum açar. Bu cüzdan, onaydan sonra kazananları girmenin tek yoludur; daha önce başvuran **Sign in** ile aynı cüzdanla girer.
3. **Review:** Admin panelindeki Collabs sekmesinde onaylanır (yer sayısı ve süre girilir) ya da reddedilir. Bekleyen başvurunun sayfası dakikada bir kendini yeniler.
4. **Add wallets:** Onaydan sonra sayfada geri sayım, çekiliş postunun linki için bir alan ve yer sayısı kadar satır çıkar: kazananın adı (Discord ya da X) ve EVM cüzdanı. Topluluk çekilişi X'te bir postla yapar (rehberdeki hazır post @FheCat'i takip ettirip repost istiyor) ve linkini girer: **Submit wallets** bu link olmadan çalışmaz. Liste bir satıra yapıştırılabilir (her satırda bir isim ve bir cüzdan). **Save wallets** taslağı (link dahil) kaydeder, **Submit wallets** listeyi kilitler. Süre bitince liste değiştirilemez; admin süreyi uzatabilir ya da listeyi yeniden açabilir.

**Collab guide** penceresi kuralları ve çekiliş için kopyalanabilir hazır bir post içerir.

**Kayıtlar:** Aynı Neon veritabanında `collabs` tablosu. Tablo, ilk istekte API tarafından kendiliğinden oluşturulur. Kazananlar tablodaki `winners` (jsonb), çekiliş postunun linki `tweet` sütununda durur (`tweet` sonradan eklendi; API eksikse ilk istekte kendisi ekler).

**Güvenlik:** Oturum çerezi ve imza mesajları `ADMIN_PASSWORD`'dan türetilen bir anahtarla imzalanır; bu şifre değişince collab oturumları da kapanır. Sayfa her kullanıcı verisini düz metin olarak gösterir.

## ## Teknik doğruluk

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
| `css/fight.css` | Kör Arena'nın dövüş sahnesi ve dövüşçüleri (mint sitesi ve admin Arena sekmesi ortak kullanır) |
| `js/pixel.js` | Metin halindeki piksel çizimleri keskin SVG'ye çeviren küçük yardımcı |
| `js/sprites.js` | Tüm piksel çizimler: logo, "FheCat" yazısı, kediler, fener, sandık, makine, zarf, ikonlar |
| `js/scene.js` | Gece sahneleri (giriş ve kapanış), yıldızlar ve bulut şeritleri |
| `js/main.js` | Etkileşimler ve animasyonlar |
| `js/wlcard.js` | Piksel WL kartını çizer (kart numarası kullanıcı adından, `api/waitlist.js` ile aynı hesap) |
| `js/waitlist.js` | Waitlist adımları; `LAUNCH_POST` burada |
| `api/waitlist.js` | Kaydı doğrulayıp veritabanına yazan Vercel fonksiyonu |
| `admin.html`, `js/admin.js` | Admin paneli: inceleme ve dışa aktarma |
| `js/admin-collab.js`, `js/admin-arena.js` | Admin panelinin Collabs ve Arena sekmeleri |
| `api/admin.js` | Admin API'si: şifreyle giriş, liste, durum değiştirme, collab'lar ve arena |
| `api/_arena.js` | Testnet'teki Kör Arena'yı zincirden okur (Arena sekmesi için): sonuçlar, tablo ve gösterilen her kedinin kutusu, barkod handle'ı ve açılmışsa DNA'sı |
| `admin/mint/` | Test mint kopyası ve `arena-game.js` (Arena sekmesinin dövüşçüleri ve sahnesi); `web/`'den üretilir, yalnızca admin girişiyle açılır |
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
