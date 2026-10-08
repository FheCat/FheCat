# Mainnet'e geçiş planı (21 Ekim 2026)

Bu belge FheCat'i önce testnet'te eksiksiz prova edip 21 Ekim'de Fhenix mainnet'ine taşımak için yapılacakları sıralar. Durum bilgileri 7 Ekim 2026 tarihlidir; zincir kontrolü 8 Ekim'de yenilendi.

## Bugünkü durum

**Fhenix tarafı**

- Fhenix, mainnet'i 21 Ekim'de Ethereum ve Arbitrum One'da açacağını duyurdu. Lansmanda ekibin seçtiği beş uygulama yayına giriyor.
- **8 Ekim:** Tarih Fhenix ekibiyle doğrudan konuşularak teyit edildi: mainnet 21 Ekim'de açılıyor.
- `@fhenixprotocol/cofhe-contracts` 1.0.0, 5 Ekim'de yayımlandı. Bu sürümde FHE.sol, TaskManager'ı her zincirde aynı adreste duran **CoFHEAddressBook** (`0xC0F4e00E531a2B086492Ae3DCC1515038307196b`) üzerinden bulur.
- Zincir üstü kontrol (fork testi, 7 Ekim):

  | Zincir | Adres defterinin gösterdiği TaskManager | Durum |
  |---|---|---|
  | Arbitrum / Base / Ethereum Sepolia | `0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9` | FheCat ve arena testleri geçiyor |
  | Arbitrum One, Ethereum | `0x52E7a0cAF234b266bCFAa6aA933a412FDe58432A` | Mint `CofheIsUnavailable()` ile reddediliyor |

  8 Ekim'de yeniden okundu: testnet TaskManager'ı açık (`isEnabled: true`, erişim listesi kapalı). Mainnet TaskManager'ı hâlâ kapalı (`isEnabled: false`) ve erişim listesi açık (`accessListEnabled: true`).

- Mainnet TaskManager'ında kontrat bazlı bir **erişim listesi** var: listede olmayan bir kontratın FHE işlemi `NotOnAccessList(address)` hatası alıyor. Bu listenin lansmandan sonra kalıp kalmayacağı ve nasıl başvurulacağı herkese açık bir belgede yazmıyor.
- `@cofhe/sdk` 0.8.0 (6 Ekim) mainnet zincir tanımlarını getirdi: Ethereum ve Arbitrum One (`https://cofhe.mainnet.fhenix.zone`).

**FheCat tarafı**

- Kontratlar cofhe-contracts 1.0.0 ile derleniyor, yani mainnet'te doğru TaskManager'a ulaşıyor. (0.2.0 ile derlenen sürüm mainnet'te hiç çalışmazdı: eski sabit adreste kontrat yok.)
- Proje `@cofhe/sdk` ve `@cofhe/hardhat-plugin` 0.8.0'a yükseltildi. Mint sitesi Arbitrum One'ı ve Ethereum'u tanıyor; `deployments.json`'a mainnet adresi girildiği an o zincirde çalışır.
- 0.8.0 ile 50 birim testi, 4 tarayıcı (E2E) testi (iki cüzdanlı kör düello dahil) ve Arbitrum Sepolia fork testleri geçiyor.
- Kör Arena testnet'te gerçek şifreli düellolarla denendi: taktikler Node'da ve tarayıcıda `encryptInputs` ile şifrelendi, sonuçları eşik ağı çözdü (`docs/TESTNET.md`).
- Deploy betiği mainnet'te `CONFIRM_MAINNET=yes` olmadan çalışmaz.

## 1. Fhenix'e sorulacaklar (en önemli adım)

Lansmana yetişmek bu cevaplara bağlı:

1. FheCat'in iki kontratı (`FheCat` ve `FheCatArena`) mainnet erişim listesine nasıl alınır? Kontrat adresi mi istiyorlar, başvuru formu mu var?
2. Hangi zincir öneriliyor? (Önerimiz Arbitrum One: mint ≈174k gas, Ethereum'da aynı işlem çok daha pahalı.)
3. Lansmanda `FHE.randomEuint64()` (şifreli rastgelelik), şifreli girdiler (`encryptInputs` ve doğrulayıcı imzası; Kör Arena'nın taktikleri bununla gelir) ve herkese açık şifre çözme (`decryptForTx(...).withoutACP()`) açık olacak mı?

Not: Kontratların kurucuları FHE çağrısı yapmaz. Yani erişim listesi için adres gerekiyorsa önce deploy edip adresleri iletebiliriz. Mint, liste onayı gelene kadar açılmaz.

## 2. Testnet provası (şimdi)

Prova, mainnet'in birebir kopyası olarak Arbitrum Sepolia'da yapılır: gerçek çizimler, aynı `launch.json`, aynı satış akışı ve aynı site. Claude provayı atılabilir test cüzdanlarıyla yürütür. Prova gizlidir: site yalnızca Vercel girişiyle ya da fhecat.com/admin'deki **Testnet mint** kopyasından admin girişiyle açılır ve kaynak kodu explorer'da doğrulanmaz. Adımlar, test listesi ve sonuçlar `docs/TESTNET.md` dosyasında.

## 3. Lansman günü

1. `cd contracts && FORK=arbitrum npm run test:fork` iki testi de geçmeli. Testler "CofheIsUnavailable" diyerek atlanıyorsa CoFHE henüz açılmamıştır. "NotOnAccessList" diyorsa FheCat listede değildir.
2. Mainnet'i proje sahibi kendi bilgisayarından deploy eder.
   - **Ayarlar:** `contracts/launch.json` dosyasındadır ve provadakiyle aynı kalır. Deploy'dan önce yalnızca fiyat güncellenir: kedi başına 3 $, o günkü ETH kuruyla ETH'ye çevrilir (`publicPriceEth`, `allowlistPriceEth`). Fiyat sonradan Owner bölümünden de değiştirilebilir.
   - **Kendi bilgisayarındaki `contracts/.env` dosyasına** (git'e girmez):
     - `PRIVATE_KEY`: deploy cüzdanı. Yalnızca gas parası tutan yeni bir cüzdan en güvenlisidir. Deploy bitince satır silinir.
     - `ETHERSCAN_API_KEY`: kaynak kodu doğrulaması.
     - `ARBITRUM_RPC_URL`: kendi RPC'n.
   - **Sahip:** `launch.json`'daki `owner` boşsa deploy cüzdanı sahip olur. Asıl cüzdanın ya da bir Safe (multisig) sahip olacaksa adresini buraya yaz. Deploy'dan sonra o cüzdan siteye bağlanıp Owner bölümünden kabul eder (Safe'te `acceptOwnership()`).
3. Deploy: `CONFIRM_MAINNET=yes npm run deploy:arbitrum`. Adresleri Fhenix'e ilet (erişim listesi gerekiyorsa) ve Arbiscan doğrulamasını kontrol et.
4. Allowlist:
   - Admin panelinin Collabs sekmesinden **Allowlist .txt** dosyasını indir. Dosya, onaylı waitlist cüzdanlarıyla onaylı collab'ların kazananlarını tekrarsız birleştirir.
   - `npx hardhat fhecat:allowlist fhecat-allowlist-<tarih>.txt --write-only` yalnızca `web/public/allowlist.json` dosyasını yazar; anahtar gerekmez.
   - Site yayınlanınca sahip, sitedeki Owner bölümünden **Use this site's list** ile kökü kontrata yazar.
5. Mint sitesi:
   - `deployments.json` ile `allowlist.json` dosyalarını commit'le.
   - Vercel'deki `fhecat-mint` projesine alan adını (ör. `mint.fhecat.com`) bağla ve korumayı "özel alan adları hariç" yap. Site ancak o zaman herkese açılır.
   - Admin'deki testnet kopyası artık gerekmiyorsa `landing/admin/mint/` klasörünü sil.
6. Satışı sırayla Owner bölümünden aç: önce Allowlist, sonra Public. `fhecat:status` ile de izlenebilir.

## OpenSea

- **Mainnet:** OpenSea Arbitrum One'ı destekliyor ve zincirdeki ERC-721 koleksiyonlarını kendiliğinden gösteriyor (indeksliyor); ayrıca başvuru gerekmez. İlk mint'ten sonra kediler `opensea.io/assets/arbitrum/<FheCat adresi>/<numara>` adresinde görünür.
- **Koleksiyon sayfası:** OpenSea, düzenleme yetkisini kontratın `owner()` cüzdanına verir. Sahip cüzdanla bağlanıp banner'ı, kategoriyi ve linkleri düzenle. Kontrattaki `external_link` şu an X hesabını gösteriyor; site linki OpenSea'dan eklenebilir.
- **Reveal'lar:** Peek, kutu açma ve reveal `MetadataUpdate` (ERC-4906) olayı yayar. OpenSea bu olayları dinleyip kedinin görselini ve trait'lerini kendisi yeniler.
- **Testnet:** OpenSea testnet desteğini 23 Temmuz 2025'te kapattı, bu yüzden testnet koleksiyonu OpenSea'da görünmez. Bunun yerine OpenSea'nın okuduğu her şey testnet kontratında doğrulandı (7 Ekim):
  - `tokenURI` dört durumda da (Unopened, Peeked, Opened, Revealed) geçerli JSON döndürüyor: `name`, `description`, `image` ve trait'ler (`attributes`).
  - Görsel zincir üstü SVG'dir: 1024 px, keskin pikseller (`crispEdges`). Pazar yerlerinin `<img>` ile gösterdiği şekilde doğru çiziliyor.
  - `contractURI` geçerli JSON döndürüyor: `name`, `description`, `image`, `external_link`.
  - ERC-721, ERC-721 Metadata, ERC-2981 (%5 royalty), ERC-4906 ve ERC-165 arayüzleri `true` döndürüyor; `owner()` tanımlı.
  - `tokenURI` çağrısı en fazla yaklaşık 1,4 milyon gas tutuyor, yani RPC sınırlarının çok altında.

## Güvenlik notları

- Kontratlar test edildi ama bağımsız bir güvenlik denetiminden geçmedi. Gerçek parayla açmadan önce denetim önerilir.
- Kontratlar yükseltilemez. Hata sonradan düzeltilemez; renderer ve arena adresi ise değiştirilebilir.
- Ekip, kedilerin DNA'sını çözemez ve kimsenin kedisini açamaz. Bu yetki tasarım gereği yoktur.
