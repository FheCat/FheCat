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

- **Mint:** Proje sahibinin kendi testleri süresince satış Public aşamada açık kalır; testler bitince Owner bölümünden kapatılır. Allowlist'te yalnızca test cüzdanları vardır.
- **Site:** İki yoldan açılır:
  - Vercel hesabınla: `fhecat-mint-git-claude-fhenix-nft-collection-uwkwk9-akdogan1.vercel.app`
  - fhecat.com/admin'de admin şifresiyle giriş yapıp **Open the test mint** ile: `fhecat.com/admin/mint/`. Bu kopyanın sayfası ve çizimleri içeren dosyaları, admin oturumu olmadan açılmaz (`landing/middleware.js`).
- **OpenSea:** OpenSea testnet desteğini Temmuz 2025'te kapattığı için testnet kedileri OpenSea'da da görünmez.
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

## Admin panelinden kendin test et

1. fhecat.com/admin'de admin şifresiyle giriş yap ve **Open the test mint**'e bas.
2. Cüzdanını (MetaMask, Rabby vb.) Arbitrum Sepolia ağında bağla. Test ETH'si için sitedeki **Testnet ETH faucet** linkini kullan ya da Claude'dan iste.
3. Satış Public aşamada açık: cüzdan başına en fazla 3 kedi, kedi başına 0,00115 ETH.
4. Deneyebileceklerin: mint, gizlice bakma (peek), kendi kanıtınla reveal, kutuyu herkese açma, kediyi başka cüzdana gönderme, arena (düello ve kademe kanıtı).
5. Owner bölümü yalnızca kontratın sahibi olan cüzdanda görünür. Testnet'te sahip, Claude'un test cüzdanıdır. Sahip araçlarını da denemek istersen sahiplik iki adımda senin cüzdanına devredilebilir.

Kopya, mint sitesinin kodundan derlenir. Site değişince `cd web && npm run build:admin-copy` ile yeniden derlenip `landing/admin/mint/` commit'lenir.

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

## Sonuçlar (7 Ekim 2026)

**Kurulum**

| Kontrat | Adres |
|---|---|
| FheCat | `0xd4F8521c8F4dBd22fe8E0877beF1Fd91A0691b24` (blok 316602853) |
| FheCatRenderer | `0x363fF5772cfA089e2A16D64a27087Ff54fC02F0C` |
| FheCatArena | `0xf0c277E06cBcd18Ab25F8E97bBE1eD4ce935Bff5` |

- Kurulum ve allowlist ayarı yaklaşık 0,0008 ETH tuttu.
- Test ETH'si Ethereum Sepolia'dan Arbitrum'un resmi köprüsüyle geldi; köprü 13 dakika sürdü.

**`rehearse.ts`: 12 adımın 12'si geçti.**

- Toplam gas ücreti 0,00041 ETH.
- Sonuç: 9 kedi; 7'si kapalı, 2'si reveal edildi. Satış kapalı bırakıldı.

| İşlem | Gas |
|---|---|
| Allowlist mint, 3 kedi | 417.123 |
| Allowlist mint, 1 kedi | 211.871 |
| Public mint, 3 kedi | 396.267 |
| Peek | 106.088 |
| Reveal (sahibin kendi kanıtı) | 62.110 |
| Open | 88.246 |
| Reveal (herkese açık kanıt) | 62.259 |
| Transfer | 42.799 |
| Arenaya giriş | 84.600 |
| Düello açma (ilk kez, güç mühürlenir) | 964.310 |
| Düelloyu kabul | 605.220 |
| Düello sonucunu yazma | 130.312 |
| Kademe sorusu | 312.151 |
| Kademe cevabını yazma | 80.764 |
| Ekip rezervi, 2 kedi | 261.268 |
| Para çekme | 30.984 |

**Fhenix şifre çözme süreleri**

| Ne | Süre |
|---|---|
| Gizli bakış | 0,8 sn |
| Sahibin reveal kanıtı | 0,2 sn |
| Açılan kutunun herkese açık çözümü | 0,3 sn |
| Düello sonucu | 2,5 sn |
| Kademe cevabı | 0,2 sn |

**Reddedilen her şey doğru hatayla reddedildi**

| Durum | Hata |
|---|---|
| Listede olmayan cüzdan | `NotOnAllowlist` |
| Eksik ödeme | `WrongPayment` |
| Yanlış aşama | `SaleNotActive` |
| 4. kedi | `ExceedsWalletLimit` |
| İşlem başına 10'dan fazla | `InvalidQuantity` |
| Başkasının kedisine bakma | `NotHolder` |
| Peek edilmiş kediyi başkasının reveal etmesi | `RevealLocked` |
| Sahte DNA | `InvalidDecryptionProof` |
| Arenaya girmeden düello | `NotInArena` |
| Sahip olmayanın yönetim işlemleri | `OwnableUnauthorizedAccount` |

**Site testi: akışın tamamı tarayıcıda geçti.**

Site, testnet deploy'una bağlı olarak derlendi ve tarayıcıda gerçek bir kullanıcı gibi kullanıldı. Cüzdan imzası tarayıcının dışında atıldı. Fhenix şifre çözmeleri tarayıcıda, gerçek threshold network ile yapıldı.

- 14 işlemin hepsi başarılı oldu; toplam ücret 0,000224 ETH.
- Süre, düğmeye basıldığı andan sonucun ekranda görünmesine kadar geçen zamandır. İşlem onayları ve şifre çözme buna dahildir.

| Adım | Süre | Gas |
|---|---|---|
| Sahip, Owner bölümünden satışı "Public"e aldı | | 46.969 |
| `dave` 3 kedi bastı (#10–#12); ardından mint düğmesi "Wallet limit reached" oldu | | 396.267 |
| #10'a gizlice baktı: peek işlemi, izin imzası ve tarayıcıda çözme | 4,0 sn | 106.088 |
| #10'u kendi kanıtıyla reveal etti | 2,9 sn | 62.134 |
| #11'i herkese açtı; site reveal'ı hemen tamamladı | 4,1 sn | 105.346 + 62.122 |
| #12 arenaya girdi | | 84.600 |
| Mühürlü #12, açık #11'e meydan okudu | | 518.353 |
| Düello #11 ile kabul edildi ve sonuç yazıldı: "#12 beat #11" | 3,9 sn | 608.023 + 130.293 |
| #12 için kademe kanıtı: "#12 is Rare" | 4,0 sn | 223.420 + 86.172 |
| Sahip 0,00345 ETH'yi çekti | | 30.984 |
| Sahip satışı kapattı | | 25.057 |

- Açılmış bir kedinin DNA'sı herkese açık olduğu için arenaya girmeden dövüşebilir (#11). Sahibinin kendi kanıtıyla reveal ettiği kedi (#10) ise önce arenaya girmelidir.
- Bu çalıştırmanın sonunda 12 kedi vardı, satış kapalıydı, kontratta para kalmamıştı ve sahiplik `owner` cüzdanındaydı.

**Admin kopyasında tekrar (Fhenix SDK 0.8.0)**

Site, fhecat.com/admin/mint/ kopyasından admin girişiyle ve SDK 0.8.0 ile baştan sona yeniden denendi. 13 işlemin hepsi başarılı oldu; toplam ücret 0,000218 ETH.

| Adım | Süre |
|---|---|
| Sahip, kopyadaki Owner bölümünden satışı Public'e aldı | |
| `carol` 3 kedi bastı (#13–#15) | |
| #13'e gizlice baktı | 3,6 sn |
| #13'ü kendi kanıtıyla reveal etti | 1,9 sn |
| #14'ü herkese açtı; site reveal'ı tamamladı | 3,0 sn |
| Mühürlü #15, açık #14'ü yendi | 3,9 sn |
| Kademe kanıtı: "#15 is not Rare" | 3,5 sn |
| Sahip 0,00345 ETH'yi çekti | |

- Şu anki durum: 15 kedi var ve kontratta para yok. Satış, proje sahibinin kendi testleri için Public aşamada açık bırakıldı. Sahiplik `owner` cüzdanında.
