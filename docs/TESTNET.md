# Testnet provası (Arbitrum Sepolia)

Bu prova, mainnet'te yapılacak işin birebir kopyasıdır. Tek fark ağdır: Arbitrum One yerine Arbitrum Sepolia ve test ETH'si. Provayı Claude, yalnızca bu iş için açılmış atılabilir test cüzdanlarıyla yürütür. Mainnet'i proje sahibi kendisi deploy eder (`docs/MAINNET.md`).

## Mainnet ile aynı olanlar

- **Kontratlar:** `FheCat`, `FheCatRenderer` ve `FheCatArena`.
  - `FheCat`, Fhenix'in şifreli rastgeleliğini kullanır.
  - `FheCatRenderer` gerçek çizimleri içerir.
- **Ayarlar:** `contracts/launch.json` iki ağda da aynı dosyadır: ad, arz (4444), fiyat (kedi başına 0,00115 ETH ≈ 3 $), cüzdan başına 3 kedi ve %5 royalty. Deploy betiği gerçek bir ağda bu dosyadan farklı bir değere izin vermez.
- **Satış akışı:**
  - kapalı → allowlist → public,
  - Merkle allowlist,
  - cüzdan limitleri,
  - ekip rezervi,
  - para çekme,
  - iki adımlı sahiplik devri (Ownable2Step).
- **Site:** aynı kod. Satış, sitedeki "Owner" bölümünden sahibin kendi cüzdanıyla yönetilir.

## Bilerek farklı olanlar

- **Cüzdanlar:** Hepsi atılabilir test cüzdanlarıdır.
  - `owner` kontratları kurar ve satışı yönetir.
  - `alice` ve `carol` allowlist'tedir; `bob` değildir.
  - `dave` siteyi gerçek bir kullanıcı gibi dener.
  - Anahtarlar yalnızca çalışma oturumunun geçici klasöründe durur; ne repoda ne de başka bir yerde bulunur.
- **Kaynak kodu doğrulaması:** Kaynak kodu explorer'da (Arbiscan) doğrulanmaz, çünkü doğrulanırsa çizimler herkesin okuyabileceği hale gelir. Mainnet'te doğrulanır.
- **Site:** Vercel'deki `fhecat-mint` projesinde gizli tutulur. Her adres Vercel girişi ister ve özel alan adı bağlanmaz.

## Prova nasıl gizli kalır

- **Mint:** Satış prova boyunca yalnızca kısa süre açılır ve prova bitince kapatılır. Allowlist'te yalnızca test cüzdanları vardır.
- **Site:** Yalnızca Vercel hesabınla açılır. Adres: `fhecat-mint-git-claude-fhenix-nft-collection-uwkwk9-akdogan1.vercel.app`
- **Zincir:** Zincirin kendisi herkese açıktır. Kontrat adresini bilmeyen biri provayı fark etmez. Ama çizimler renderer'ın bytecode'unda durduğu için çok kararlı biri bunları çıkarabilir. Risk düşüktür ve mainnet'te zaten aynı durum olacaktır.

## Adımlar

```bash
cd contracts
npm run deploy:arb-sepolia                                                   # launch.json ile, doğrulamasız
npx hardhat fhecat:allowlist allowlist/arb-sepolia.txt --network arb-sepolia  # kök + web/public/allowlist.json
REHEARSAL_KEYS=<anahtar dosyası> REHEARSAL_STATE=<durum dosyası> \
  npx hardhat run scripts/rehearse.ts --network arb-sepolia                  # satışın tamamı, adım adım kontrollü
```

- Deploy, `owner` anahtarıyla yapılır. Bu anahtar yalnızca komutun ortam değişkeninde bulunur.
- `rehearse.ts` her adımı zincirde kontrol eder ve sonunda satışı kapatır. Yarıda kalırsa kaldığı yerden devam eder.
- Aynı betik `--network localhost` ile Fhenix'in sahte sunucularına karşı kuru çalıştırılabilir.

Ardından site, aynı testnet deploy'una karşı tarayıcıda gerçek bir kullanıcı gibi denenir. Cüzdan imzası tarayıcının dışında atılır. Denenen akış:

1. mint,
2. gizlice bakma ve kendi kanıtıyla reveal,
3. kutuyu açma,
4. arena,
5. Owner bölümü.

Son olarak şu dosyalar commit'lenir:

- `contracts/deployments/arb-sepolia.json`
- `web/src/config/deployments.json`
- `web/public/allowlist.json`

Gizli site push'tan sonra kendini yeniden derler.

## Test listesi

1. Allowlist'teki cüzdanla mint. Listede olmayan cüzdanın, eksik ödemenin ve yanlış aşamanın reddedilmesi.
2. Cüzdan limiti (3) ve işlem başına üst sınır (10).
3. Gizlice bakma (peek): kedi "Peeked" olur, DNA'yı yalnızca bakan görür.
4. Peek eden sahibin kendi kanıtıyla reveal'ı. Başkasının ve sahte DNA'nın reddedilmesi.
5. Peek edilmiş kediyi başka cüzdana gönderme: işaret kalır, yeni sahip DNA'yı çözemez. Kutuyu açma ve reveal'ı herhangi birinin tamamlaması.
6. Arena: giriş, düello, sonucu üçüncü birinin yazması, kademe kanıtı. Kediler açılmaz.
7. Sahip araçları: ekip rezervi, fiyat, limit, royalty, para çekme. Başkasının denemelerinin reddedilmesi.
8. İki adımlı sahiplik devri ve geri alınması.
9. Zincirdeki çizimin sitedeki çizimle bayt bayt aynı olması.
10. Gas ve Fhenix şifre çözme süreleri.
