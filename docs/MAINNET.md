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

1. **Cüzdan:** Yalnızca test için yeni bir cüzdan oluştur ve faucet'ten Arbitrum Sepolia ETH al. Anahtarı `contracts/.env` içine `PRIVATE_KEY` olarak koy (bu dosya git'e girmez).
2. **Sanatın gizliliği:** Testnet'e deploy edilen renderer herkese açıktır. Herkes `catSvg(herhangi bir DNA)` çağırıp çizimleri görebilir; mint sitesinin JS paketi de çizimleri içerir. Sanat lansmana kadar gizli kalacaksa üç seçenek var:
   - testnet'i gerçek çizimlerle kullanmak (az kişi bakar ama herkese açıktır),
   - testnet'te yalnızca kutuları çizen geçici bir renderer kullanmak, mainnet'te asıl renderer'ı kurmak (`setRenderer`),
   - provayı yalnızca fork ve yerel zincirde yapmak.
3. **Deploy:** `cd contracts && npm run deploy:arb-sepolia`. Bu komut FheCatRenderer, FheCat ve FheCatArena'yı kurar, FheCat'i arenaya bağlar ve adresleri `deployments/arb-sepolia.json` ile `web/src/config/deployments.json` dosyalarına yazar.
4. **Uçtan uca akış:**
   - `fhecat:phase public` ile satışı aç ve birkaç kedi mintle.
   - Gizlice bak: `fhecat:peek <id>`.
   - Aç ve reveal et: `fhecat:reveal <id>`.
   - Arena: `arena:enter <id>`, `arena:duel <id>`, `arena:accept <düello> <id>`, `arena:tier <id> 1`.
   - Aynı adımları mint sitesinden de dene.
5. Ölçülen gas'ı ve threshold network'ün çözme sürelerini not et.

## 3. Lansman günü

1. `cd contracts && FORK=arbitrum npm run test:fork` iki testi de geçmeli. Testler "CofheIsUnavailable" diyerek atlanıyorsa CoFHE henüz açılmamıştır. "NotOnAccessList" diyorsa FheCat listede değildir.
2. `contracts/.env` dosyasını doldur:
   - `PRIVATE_KEY`: deploy cüzdanı.
   - `OWNER_ADDRESS`: tercihen bir Safe (multisig). Deploy sonrası Safe'ten `acceptOwnership()` çağrılmalı.
   - `ROYALTY_RECEIVER`, `ROYALTY_BPS`.
   - `MAX_SUPPLY=4444`, `PUBLIC_PRICE_ETH`, `ALLOWLIST_PRICE_ETH`, `MAX_PER_WALLET`, `ALLOWLIST_MAX_PER_WALLET`.
   - `OPEN_SALE=false`, `ETHERSCAN_API_KEY`, `ARBITRUM_RPC_URL` (kendi RPC'n).
3. Deploy: `CONFIRM_MAINNET=yes npm run deploy:arbitrum`. Adresleri Fhenix'e ilet (erişim listesi gerekiyorsa) ve Arbiscan doğrulamasını kontrol et.
4. Allowlist:
   - Admin panelden onaylı başvuruların cüzdanlarını dışa aktar (Wallets .txt).
   - `npx hardhat fhecat:allowlist wallets.txt --network arbitrum` komutu Merkle kökünü ayarlar ve `web/public/allowlist.json` dosyasını yazar.
5. Mint sitesi: `@cofhe/sdk`'yı mainnet'i destekleyen sürüme yükselt ve `web/src/config/chains.ts` dosyasına Arbitrum One'ı ekle. Sonra `deployments.json` ile `allowlist.json` dosyalarını commit'leyip siteyi yayınla.
6. Satışı sırayla aç: `fhecat:phase allowlist`, ardından `fhecat:phase public`. İzlemek için `fhecat:status` kullan.

## Güvenlik notları

- Kontratlar test edildi ama bağımsız bir güvenlik denetiminden geçmedi. Gerçek parayla açmadan önce denetim önerilir.
- Kontratlar yükseltilemez. Hata sonradan düzeltilemez; renderer ve arena adresi ise değiştirilebilir.
- Ekip, kedilerin DNA'sını çözemez ve kimsenin kedisini açamaz. Bu yetki tasarım gereği yoktur.
