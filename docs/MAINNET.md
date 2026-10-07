# Mainnet'e geçiş planı (21 Ekim 2026)

Bu belge FheCat'i önce testnet'te eksiksiz prova edip 21 Ekim'de Fhenix mainnet'ine taşımak için yapılacakları sıralar. Durum bilgileri 6 Ekim 2026 tarihlidir.

## Bugünkü durum

**Fhenix tarafı**

- Fhenix, mainnet'i 21 Ekim'de Ethereum ve Arbitrum One'da açacağını duyurdu. Lansmanda ekibin seçtiği beş uygulama yayına giriyor.
- `@fhenixprotocol/cofhe-contracts` 1.0.0, 5 Ekim'de yayımlandı. Bu sürümde FHE.sol, TaskManager'ı her zincirde aynı adreste duran **CoFHEAddressBook** (`0xC0F4e00E531a2B086492Ae3DCC1515038307196b`) üzerinden bulur.
- Zincir üstü kontrol (fork testi, 6 Ekim):

  | Zincir | Adres defterinin gösterdiği TaskManager | Durum |
  |---|---|---|
  | Arbitrum / Base / Ethereum Sepolia | `0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9` | FheCat ve arena testleri geçiyor |
  | Arbitrum One, Ethereum | `0x52E7a0cAF234b266bCFAa6aA933a412FDe58432A` | Mint `CofheIsUnavailable()` ile reddediliyor |

- Mainnet TaskManager'ında kontrat bazlı bir **erişim listesi** var: listede olmayan bir kontratın FHE işlemi `NotOnAccessList(address)` hatası alıyor. Bu listenin lansmandan sonra kalıp kalmayacağı ve nasıl başvurulacağı herkese açık bir belgede yazmıyor.
- Mainnet için resmi SDK zincir tanımları (CoFHE ve eşik ağı URL'leri) henüz yayımlanmadı. `@cofhe/sdk` beta sürümünde de yalnızca testnet'ler var.

**FheCat tarafı**

- Kontratlar cofhe-contracts 1.0.0 ile derleniyor, yani mainnet'te doğru TaskManager'a ulaşıyor. (0.2.0 ile derlenen sürüm mainnet'te hiç çalışmazdı: eski sabit adreste kontrat yok.)
- 48 birim testi, 3 tarayıcı (E2E) testi ve üç testnet'te fork testleri geçiyor.
- Deploy betiği mainnet'te `CONFIRM_MAINNET=yes` olmadan çalışmaz.

## 1. Fhenix'e sorulacaklar (en önemli adım)

Lansmana yetişmek bu cevaplara bağlı:

1. FheCat'in iki kontratı (`FheCat` ve `FheCatArena`) mainnet erişim listesine nasıl alınır? Kontrat adresi mi istiyorlar, başvuru formu mu var?
2. Hangi zincir öneriliyor? (Önerimiz Arbitrum One: mint ≈174k gas, Ethereum'da aynı işlem çok daha pahalı.)
3. Lansmanda `FHE.randomEuint64()` (şifreli rastgelelik) ve herkese açık şifre çözme (`decryptForTx(...).withoutACP()`) açık olacak mı?
4. Mainnet'i destekleyen `@cofhe/sdk` sürümü ne zaman çıkacak?

Not: Kontratların kurucuları FHE çağrısı yapmaz. Yani erişim listesi için adres gerekiyorsa önce deploy edip adresleri iletebiliriz. Mint, liste onayı gelene kadar açılmaz.

## 2. Testnet provası (şimdi)

Prova, mainnet'in birebir kopyası olarak Arbitrum Sepolia'da yapılır: gerçek çizimler, aynı `launch.json`, aynı satış akışı ve aynı site. Claude provayı atılabilir test cüzdanlarıyla yürütür. Prova gizlidir: site yalnızca Vercel girişiyle açılır, kaynak kodu explorer'da doğrulanmaz ve satış prova bitince kapatılır. Adımlar, test listesi ve sonuçlar `docs/TESTNET.md` dosyasında.

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
   - Admin panelden onaylı başvuruların cüzdanlarını dışa aktar (Wallets .txt).
   - `npx hardhat fhecat:allowlist wallets.txt --write-only` yalnızca `web/public/allowlist.json` dosyasını yazar; anahtar gerekmez.
   - Site yayınlanınca sahip, sitedeki Owner bölümünden **Use this site's list** ile kökü kontrata yazar.
5. Mint sitesi:
   - `@cofhe/sdk`'yı mainnet'i destekleyen sürüme yükselt ve `web/src/config/chains.ts` dosyasına Arbitrum One'ı ekle.
   - `deployments.json` ile `allowlist.json` dosyalarını commit'le.
   - Vercel'deki `fhecat-mint` projesine alan adını (ör. `mint.fhecat.com`) bağla ve korumayı "özel alan adları hariç" yap. Site ancak o zaman herkese açılır.
6. Satışı sırayla Owner bölümünden aç: önce Allowlist, sonra Public. `fhecat:status` ile de izlenebilir.

## Güvenlik notları

- Kontratlar test edildi ama bağımsız bir güvenlik denetiminden geçmedi. Gerçek parayla açmadan önce denetim önerilir.
- Kontratlar yükseltilemez. Hata sonradan düzeltilemez; renderer ve arena adresi ise değiştirilebilir.
- Ekip, kedilerin DNA'sını çözemez ve kimsenin kedisini açamaz. Bu yetki tasarım gereği yoktur.
