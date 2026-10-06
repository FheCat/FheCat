# Testnet provası (Arbitrum Sepolia)

Bu prova, mainnet'te yapılacak işin birebir kopyasıdır. Tek fark ağdır: Arbitrum One yerine Arbitrum Sepolia ve test ETH'si. Prova herkese kapalı yapılır.

## Mainnet ile aynı olanlar

- **Kontratlar:** `FheCat`, `FheCatRenderer` ve `FheCatArena`.
  - `FheCat`, Fhenix'in şifreli rastgeleliğini kullanır.
  - `FheCatRenderer` gerçek çizimleri içerir.
- **Ayarlar:** `contracts/launch.json` iki ağda da aynı dosyadır: ad, arz (4444), sahip, royalty, fiyatlar ve cüzdan limitleri. Deploy betiği gerçek bir ağda bu dosyadan farklı bir değere izin vermez.
- **Satış akışı:**
  - kapalı → allowlist → public,
  - Merkle allowlist,
  - cüzdan limitleri,
  - ekip rezervi,
  - para çekme,
  - iki adımlı sahiplik devri (Ownable2Step).
- **Site:** aynı kod. Satış, sitedeki "Owner" bölümünden sahibin kendi cüzdanıyla yönetilir.

## Bilerek farklı olanlar

- **Allowlist:** yalnızca senin test cüzdanların.
- **Kaynak kodu doğrulaması:** Kaynak kodu explorer'da (Arbiscan) doğrulanmaz, çünkü doğrulanırsa çizimler herkesin okuyabileceği hale gelir. Mainnet'te doğrulanır.
- **Site:** Vercel'deki `fhecat-mint` projesinde gizli tutulur. Her adres Vercel girişi ister ve özel alan adı bağlanmaz.

## Prova nasıl gizli kalır

- **Mint:** Allowlist aşamasında yalnızca listedeki cüzdanlar mintleyebilir. Public aşamayı deneyeceksen kısa tut ve ardından kapat.
- **Site:** Yalnızca Vercel hesabınla açılır. Adres: `fhecat-mint-git-claude-fhenix-nft-collection-uwkwk9-akdogan1.vercel.app`
- **Zincir:** Zincirin kendisi herkese açıktır. Kontrat adresini bilmeyen biri provayı fark etmez. Ama çizimler renderer'ın bytecode'unda durduğu için çok kararlı biri bunları çıkarabilir. Risk düşüktür ve mainnet'te zaten aynı durum olacaktır.

## Anahtar kuralları

1. Yalnızca bu iş için yeni bir cüzdan oluştur. Gerçek varlık tutan ana cüzdanının anahtarını kullanma.
2. Bu cüzdana Arbitrum Sepolia faucet'inden yaklaşık 0,05 ETH al.
   - Deploy ve ilk ayarlar yaklaşık 8,9 milyon gas tutar.
   - Bu genellikle 0,01 ETH'nin altındadır, ama Sepolia ücretleri dalgalandığı için pay bırak.
   - Anahtar sızsa bile, sahipliği kendi cüzdanınla kabul ettikten sonra bu cüzdanın kontrat üzerinde hiçbir yetkisi kalmaz.
3. Anahtarı sohbete yazma. Ortam ayarlarında (oturum başlığındaki ortam menüsü → Edit) `PRIVATE_KEY` adıyla ortam değişkeni olarak ekle.
4. Değişken yalnızca yeni oturumlara geçer. Deploy bu yüzden ayrı ve kısa ömürlü bir oturumda yapılır.
5. Deploy oturumu anahtarı:
   - ekrana yazdırmaz,
   - dosyaya ya da repoya koymaz,
   - yalnızca aşağıdaki komutlarda kullanır.
6. Deploy biter bitmez:
   - `PRIVATE_KEY`'i ortam ayarlarından sil,
   - deploy oturumu arşivlenir, konteyneri silinir.
7. Sahiplik `launch.json`'daki `owner` adresine (senin kendi cüzdanın) teklif edilir. Siteye o cüzdanla bağlanıp "Owner" bölümünde **Accept ownership** dersin. Bundan sonra anahtara bir daha gerek kalmaz.

## Deploy oturumunun adımları

Önce `launch.json`'daki `owner` alanına kendi cüzdan adresini, `contracts/allowlist/arb-sepolia.txt` dosyasına test cüzdanlarını yaz (her satıra bir adres). Sonra:

```bash
cd contracts && npm ci
npm run deploy:arb-sepolia                                                   # launch.json ile, doğrulamasız
npx hardhat fhecat:allowlist allowlist/arb-sepolia.txt --network arb-sepolia  # kök + web/public/allowlist.json
npx hardhat fhecat:phase allowlist --network arb-sepolia
npx hardhat fhecat:status --network arb-sepolia
```

Ardından şu dosyalar commit'lenip push'lanır:

- `contracts/deployments/arb-sepolia.json`
- `web/src/config/deployments.json`
- `web/public/allowlist.json`

Push'tan sonra gizli site kendini yeniden derler ve testnet koleksiyonunu gösterir.

## Test listesi

1. Allowlist'teki cüzdanla mint. Listede olmayan bir cüzdanın reddedilmesi.
2. Cüzdan limitinin işlemesi.
3. Gizlice bakma (peek): kedi "Peeked" olur, tarayıcıda yalnızca sen görürsün.
4. Peek eden sahibin kendi kanıtıyla reveal'ı.
5. Kutuyu açma (open) ve herkes için reveal.
6. Arena: giriş, düello, kademe kanıtı.
7. Owner bölümü:
   - sahipliği kabul etme,
   - public aşama,
   - fiyat ve limit değişikliği,
   - ekip rezervi,
   - para çekme,
   - royalty.
8. Bir kediyi başka cüzdana gönderme: "Peeked" işareti kalmalı.
9. Gas'ı ve Fhenix şifre çözme sürelerini not etme.

## Mainnet günü

`docs/MAINNET.md`'deki adımlar izlenir. Farklar:

- `launch.json` aynı kalır.
- Deploy `CONFIRM_MAINNET=yes npm run deploy:arbitrum` ile yapılır, kaynak kodu `ETHERSCAN_API_KEY` ile doğrulanır.
- Allowlist, waitlist'te onaylanan cüzdanlardan oluşturulur.
- Site herkese açılır: `fhecat-mint` projesine alan adı (ör. `mint.fhecat.com`) bağlanır ve koruma özel alan adlarını dışarıda bırakacak şekilde ayarlanır.
