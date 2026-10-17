# FheCat Proje Rehberi

> **17 Ekim 2026 itibarıyla.** Her şey tek yerde: FheCat nedir, Fhenix nedir (ve ne değildir), neden Arbitrum Sepolia'da deneniyor, nasıl çalışır, nasıl denenir, mainnet'te durum ne.

**Bu belge iki parçadır:**

- **Bölüm A (1–9): herkese açık anlatım.** Topluluğa, Fhenix ekibine ya da meraklılara olduğu gibi paylaşılabilir.
- **Bölüm B (10–17): dahili.** Teknik ayrıntılar, operasyon rakamları (waitlist, collab), riskler ve bekleyen kararlar. **Paylaşmadan önce gözden geçirin; tamamını göndermeyin.**

Ayrıntılı belgeler: [Kör Arena El Kitabı](ARENA_HANDBOOK.md) · [Testnet provası](TESTNET.md) · [Mainnet planı](MAINNET.md) · [README](../README.md) · [Tanıtım sitesi ve admin](../landing/README.md)

## İçindekiler

**Bölüm A · Herkese açık**
1. [Kısaca](#1-kısaca)
2. [Fhenix bir ağ mı?](#2-fhenix-bir-ağ-mı)
3. [Neden Arbitrum Sepolia?](#3-neden-arbitrum-sepolia)
4. [Bir kedinin hayatı](#4-bir-kedinin-hayatı)
5. [Kör Arena](#5-kör-arena)
6. [Satış](#6-satış)
7. [Gizlilik ve güven modeli](#7-gizlilik-ve-güven-modeli)
8. [Nasıl denenir?](#8-nasıl-denenir)
9. [Sık sorulan sorular](#9-sık-sorulan-sorular)
- [Ek: toplulukta paylaşmak için kısa metin (EN)](#ek-toplulukta-paylaşmak-için-kısa-metin-en)

**Bölüm B · Dahili**
10. [Proje yapısı ve teknoloji](#10-proje-yapısı-ve-teknoloji)
11. [Kontratlar](#11-kontratlar)
12. [Mint sitesi](#12-mint-sitesi)
13. [fhecat.com: waitlist, collab, admin](#13-fhecatcom-waitlist-collab-admin)
14. [Testnet dağıtımı ve sonuçlar](#14-testnet-dağıtımı-ve-sonuçlar)
15. [Mainnet: durum ve plan](#15-mainnet-durum-ve-plan)
16. [Riskler ve bilinen sınırlar](#16-riskler-ve-bilinen-sınırlar)
17. [Bekleyen kararlar](#17-bekleyen-kararlar)

[Sözlük](#sözlük) · [Kaynaklar](#kaynaklar)

---

# BÖLÜM A · Herkese açık anlatım

## 1. Kısaca

- **FheCat**, 4444 piksel kedilik bir NFT koleksiyonu. Kontratlar **Arbitrum** üzerinde çalışır; şifreli kısım için **Fhenix CoFHE** kullanır. X: [@FheCat](https://x.com/FheCat) · Site: [fhecat.com](https://fhecat.com)
- Her kedi, mint anında Fhenix'in **şifreli rastgeleliğinden** DNA alır ve **kapalı bir kutuda** doğar. DNA'nın düz hali hiçbir yerde yoktur: ne ekip, ne mintleyen kişi, ne de botlar bilir. Nadirlik avcılığı yapılamaz.
- Kutuyla ne olacağına **yalnızca sahibi** karar verir: kapalı tutar, gizlice bakar (**Peek**) ya da herkese açar (**Open**). Açılan kedi zincirde **reveal** edilir. Hiçbir şey reveal'ı zorlamaz; bir kedi sonsuza dek kapalı kalabilir.
- **Kör Arena:** kediler kapalıyken bile oynanan, şifreli taktiklerle kapışılan bir düello oyunu. Dışarı yalnızca kazanan çıkar.
- Görseller ve metadata **tamamen zincir üstünde** üretilir.
- **Fhenix bir blokzinciri değildir.** Kontratlar Arbitrum'da yaşar; Fhenix, şifreli hesabı yapan bir **koprosesördür** (bölüm 2). Bu yüzden "Fhenix'te mint" diye bir şey yoktur: testnet'te **Arbitrum Sepolia**'da, mainnet'te **Arbitrum One**'da mint edilir.
- **Bugün denenebilir:** [fhecat.com/testnet](https://fhecat.com/testnet/) (test ağı, gerçek para yok). Bölüm 8.
- **Mainnet:** Ekim 2026 hedefi; Fhenix'in mainnet'e erişim sürecine bağlıdır (bölüm 9, soru 6).

## 2. Fhenix bir ağ mı?

**Hayır.** Bugünkü Fhenix (**CoFHE**), mevcut EVM zincirlerinin yanına takılan bir **FHE koprosesörüdür**. NFT'ler, bakiyeler ve işlemler Fhenix'te değil, kontratın deploy edildiği zincirde durur.

### 2.1 Karışıklık nereden geliyor?

- İlk tasarımında Fhenix gerçekten ayrı bir zincirdi. Fhenix'in kendi yazısı bunu açıkça söylüyor: orijinal "FHE Rollup" konseptinde Fhenix ayrı bir Layer 2 zinciri olarak çalışıyordu. Arbitrum'un 2025 tarihli blogu da Arbitrum Nitro tabanlı "Fhenix L2"yi anlatıyor.
- "Testnet", "mainnet" gibi kelimeler de zincir çağrışımı yapıyor.

### 2.2 Bugün ne?

- Fhenix'in kendi ifadesiyle CoFHE, herhangi bir EVM zincirine şifreli akıllı kontratlar getiren bir FHE koprosesörü. **Yeni bir L2 gerekmez**; geliştirici Solidity kütüphanesini import eder. Aynı kriptografi, farklı dağıtım modeli.
- Dokümanlarının sloganı da aynı yönde: kullandığınız zincirlerde, şifreli veri üzerinde hesap yapan kontratlar yazın.
- FHE (tam homomorfik şifreleme) şifreli veri üzerinde, şifresini çözmeden hesap yapabilmektir.

### 2.3 Ne nerede yaşıyor?

| Katman | Nerede | Ne yapar |
|---|---|---|
| NFT'ler, bakiyeler, işlemler, gas | **Arbitrum** (testnet: Arbitrum Sepolia, mainnet: Arbitrum One) | FheCat, FheCatArena ve FheCatRenderer kontratları. Gas ETH ile ödenir. |
| TaskManager ve erişim listesi (ACL) | Aynı zincirde, Fhenix'in kontratı | Şifreli işlemleri kaydeder, kimin hangi şifreli veriye erişebileceğini tutar. |
| CoFHE koprosesörü | Zincir dışı, Fhenix altyapısı | Şifreli veri üzerinde hesabı yapar: rastgele sayı, toplama, karşılaştırma. |
| Eşik (threshold) ağı | Zincir dışı, Fhenix altyapısı | İzin varsa şifreyi çözer ve sonucu imzalar. |
| Tarayıcı | Kullanıcıda | Girdiyi şifreler (arena taktiği), kendi kedisini çözer, çizimi yapar. |

```
   Kullanıcı (tarayıcı + cüzdan)
        │  işlem (gas: ETH)                    ▲ imzalı sonuç / özel çözüm
        ▼                                      │
 ┌───────────────── Arbitrum (zincir) ─────────┴────────┐
 │  FheCat · FheCatArena · FheCatRenderer               │
 │        │ FHE.sol çağrısı                             │
 │        ▼                                             │
 │  Fhenix TaskManager + ACL (aynı zincirde kontrat)    │
 └────────┬─────────────────────────────▲───────────────┘
          │ şifreli iş                  │ sonuç (referans)
          ▼                             │
   Fhenix CoFHE koprosesörü ──── Fhenix eşik ağı
     (şifreli hesap)             (izinliye şifre çözme + imza)
```

Zincirde DNA'nın düz hali yoktur; yalnızca şifreli verinin 32 baytlık referansı (`handle`) ve kimin erişebileceği durur. Şifreli veri üzerindeki hesaplar zincir dışında yapılır.

### 2.4 "21 Ekim mainnet" ne demek?

Fhenix, mainnet'i **21 Ekim 2026'da Ethereum ve Arbitrum'da** açacağını duyurdu ([Incrypted](https://incrypted.com/en/fhenix-will-launch-its-mainnet-with-support-for-confidential-tokens-on-october-21/)). Bu, yeni bir zincirin açılması değil, koprosesörün Ethereum ve Arbitrum One'da canlıya geçmesidir. Zincirde de görülüyor: Arbitrum One'da [Fhenix'in TaskManager kontratı](https://arbiscan.io/address/0x52E7a0cAF234b266bCFAa6aA933a412FDe58432A) duruyor ve 13 Ekim 2026'da etkinleştirildi.

## 3. Neden Arbitrum Sepolia?

CoFHE'nin canlı test ortamları üç zincirde:

| Ağ | Chain ID | Durum |
|---|---|---|
| **Arbitrum Sepolia** (varsayılan) | 421614 | CoFHE canlı |
| Base Sepolia | 84532 | CoFHE canlı |
| Ethereum Sepolia | 11155111 | CoFHE canlı |
| **Arbitrum One** | 42161 | Mainnet hedefimiz; Fhenix 21 Ekim'de açıyor |
| Ethereum | 1 | Fhenix 21 Ekim'de açıyor |

Arbitrum Sepolia'da deneme nedenleri:

1. **Mainnet hedefimiz Arbitrum One.** Fhenix mainnet'i Ethereum ve Arbitrum One'da açıyor. İkisinden Arbitrum One'u seçtik: tek mint yaklaşık **174 bin gas** tutuyor ve L2'de bu çok ucuz; Ethereum L1'de aynı işlem çok daha pahalı olurdu.
2. **Arbitrum Sepolia, Arbitrum One'ın test sürümüdür.** Aynı kod, aynı `launch.json`, aynı satış akışı, aynı site. Tek fark ağ ve test ETH'si. Yani prova mainnet'in birebir kopyasıdır.
3. **FheCat zincirden bağımsız.** Kontratlar üç testnet'in fork testinden geçiyor; site Arbitrum Sepolia'yı varsayılan alıyor ama Base ve Ethereum Sepolia'yı da tanıyor.
4. **Test ETH'si ücretsiz.** Kontratlar ve site gerçek para riski olmadan defalarca denenebiliyor.

Mint için yalnızca ETH gerekir (mint bedeli ve zincirin gas'ı); testnet'te ayrıca bir Fhenix ücreti ya da tokeni görmedik.

## 4. Bir kedinin hayatı

```
 mint ──► UNOPENED ──peek──► PEEKED
              │                 │
              └──── open ───────┤
                                ▼
                             OPENED ──reveal──► REVEALED
              PEEKED ── (sahibin kendi kanıtıyla) reveal ──► REVEALED
```

| Durum | Anlamı | DNA'yı kim çözebilir | Görünüm |
|---|---|---|---|
| **Unopened** | Kediyi bugüne kadar kimse göremedi (zincirde kanıtlanabilir). | Kimse, sahibi bile. | Bantlı kutu |
| **Peeked** | Sahip gizlice çözdü. İşaret **kalıcı**; alıcılar kedinin görülmüş olabileceğini bilir. | Yalnızca peek eden cüzdan. | Aralık kapaklı kutu |
| **Opened** | Sahip DNA'yı herkese açtı. | Herkes. | Açık kutudan yükselen ışık |
| **Revealed** | DNA zincire yazıldı, kedi çizilir. | Herkes (DNA artık açık). | Kedinin kendisi |

1. **Mint:** `mint()` her kedi için Fhenix'ten şifreli bir rastgele sayı ister (`FHE.randomEuint64()`). Şifreli DNA'nın erişim listesinde yalnızca kontrat vardır.
2. **Peek:** sahip `peek()` çağırır, kontrat onu erişim listesine ekler. Sahip ücretsiz bir imza atar; DNA yalnızca onun tarayıcısında çözülür ve hiçbir yere gönderilmez.
3. **Open:** sahip DNA'yı herkese çözülebilir yapar.
4. **Reveal:** Fhenix eşik ağı DNA'yı çözüp imzalar; kontrat imzayı doğrulayıp DNA'yı zincire yazar. Opened bir kediyi herkes, Peeked bir kediyi yalnızca sahibi (kendi kanıtıyla) reveal edebilir. Sahte DNA ve başkasının kanıtı reddedilir.

**Ekip neyi yapamaz?** Ekip DNA'ları çözemez ve kimsenin kedisini açamaz; büyük bir "reveal tarihi" de yoktur. Ekip yalnızca renderer'ı (görseli) ve arena adresini değiştirebilir; bu DNA'yı etkilemez.

## 5. Kör Arena

*You don't need to see your cat to become a legend.*

- **Üç taktik:** Pounce, Trick, Guard. Taş-kâğıt-makas gibi döner: Pounce Trick'i, Trick Guard'ı, Guard Pounce'u yener.
- **Taktik şifrelidir.** Tarayıcıda şifrelenir, o cüzdana ve arenaya bağlanır. Dövüşe kadar kimse göremez; dövüşten sonra yalnızca iki oyuncu görebilir.
- **Gizli içgüdüler:** her kedinin her taktik için 0–2 içgüdüsü vardır ve şifreli DNA'dan hesaplanır: nadir özellikler küçük bir avantaj verir.
- **Skor** = taktik yeniyorsa 2 + içgüdü (0–2) + şifreli şans (0–1). Eşitlikte **kapalı kutu** kazanır.
- **Dışarı yalnızca kazanan çıkar.** DNA, taktikler, içgüdüler ve skorlar kapalı kalır.
- **Peek bir oyun kararıdır:** peek eden sahip içgüdülerini görür ama kedi kalıcı olarak Peeked sayılır, mühürlü avantajını kaybeder.
- **Haftalık tablo ve rozetler:** galibiyet 3 puan, mühürlü kutuyla galibiyet 4, mağlubiyet 1. Rozetler: First Blood, Won Blind, Hat-trick, Sealed Legend, Weekly Crown. İki kedi haftada bir kez karşılaşır.
- **Kademe kanıtı:** sahip, kedisinin Rare / Epic / Legendary / Mythic eşiğine ulaştığını DNA'yı açmadan kanıtlayabilir.
- **Dövüşler izlenir:** her kedinin tam vücut piksel dövüşçüsü vardır; kapalı kutu kendi barkodlu kutusu olarak dövüşür. Dövüşe chiptune müzik ve bir anons eşlik eder.
- **Ortaya para konmaz.** Kedi el değiştirmez, ödül ya da ücret yoktur; oyuncu yalnızca işlem gas'ını öder.

Doğru taktik ortalama **%92–95** kazandırır; içgüdü ve şans küçük bir sürpriz payı bırakır. Tüm kurallar ve olasılıklar: [Kör Arena El Kitabı](ARENA_HANDBOOK.md).

## 6. Satış

| | |
|---|---|
| Arz | **4444** |
| Fiyat | Kedi başına **0,00115 ETH** (≈ 3 $; mainnet deploy gününde o günkü kurla güncellenir) |
| Aşamalar | Kapalı → **Allowlist** → **Public** |
| Cüzdan limiti | Her aşamada cüzdan başına **3** kedi; işlem başına en fazla 10 |
| Allowlist | Merkle ağacı; kaynağı onaylı waitlist cüzdanları ve onaylı collab topluluklarının kazananları |
| Royalty | %5 (ERC-2981) |
| Ekip rezervi | `ownerMint` ile, satış aşamasından bağımsız |
| Zincir | Arbitrum One (mainnet), Arbitrum Sepolia (prova) |
| Görseller | Zincir üstünde (32×32 piksel SVG), 8 özellik, 93 seçenek |

## 7. Gizlilik ve güven modeli

**Kim neyi görür?**

| Bilgi | Kim görebilir |
|---|---|
| DNA ve özellikler | Kimse. Sahip peek yaparsa yalnızca o; open/reveal'den sonra herkes. |
| İçgüdüler ve Güç (Power) | Kimse, arena dahil. Peek eden sahip kendi kedisininkini görür. |
| Arena taktiği | Dövüşten önce yalnızca kendi sahibi; dövüşten sonra yalnızca iki oyuncu. |
| Skorlar ve şans | Kimse. |
| Kazanan, puanlar, rozetler | Herkes. |
| Kutunun durumu (mühürlü mü) | Herkes. |

**Neye güveniyoruz?**

- **Fhenix CoFHE:** şifreli hesabı ve şifre çözmeyi Fhenix'in koprosesörü ve eşik ağı yapar. Bu altyapı çalışmazsa mint, peek, open ve arena işlemleri geri döner ya da gecikir (bekleyen sonuçlar ağ dönünce yazılır, hiçbir şey kaybolmaz). Transferler ve zincirdeki görseller Fhenix'e bağlı değildir: Fhenix durursa bile kediler alınıp satılabilir ve görünür.
- **Arbitrum:** kontratların çalıştığı zincir.
- **Kontratlar:** **bağımsız bir güvenlik denetiminden geçmedi** (kapsamlı testlerle sınanıyor). Kontratlar **yükseltilemez**; hata sonradan düzeltilemez.

**Bilinen sınırlar:** ACL izinleri geri alınamaz (Peeked işareti bu yüzden kalıcıdır); ERC-2981 royalty bilgilendiricidir, pazar yerleri uygulamayabilir; arenanın bilinen açıkları el kitabındadır.

## 8. Nasıl denenir?

**Adres:** **[fhecat.com/testnet](https://fhecat.com/testnet/)** (test ağı, giriş yok, gerçek para yok).

1. Cüzdanını (MetaMask, Rabby vb.) **Arbitrum Sepolia** ağına geçir. Yanlış ağdaysan site "Switch to Arbitrum Sepolia" düğmesini gösterir.
2. Ücretsiz test ETH'si al (sayfadaki **Testnet ETH faucet** linki).
3. **Mint:** cüzdan başına en fazla 3 kedi, kedi başına 0,00115 test ETH'si.
4. **My cats:** kutuna **Peek** ile gizlice bak (kendi tarayıcında çözülür), **Open the box** ile herkese aç, ya da kapalı bırak.
5. **Arena:** kedini **Enter arena** ile arenaya sok, bir taktik seç ve **Challenge** et ya da **Open challenges** listesinden birini **Lock & fight** ile kabul et. Test cüzdanlarımız kendi başına deneyebilmen için birkaç açık meydan okuma bıraktı (her biri bir kez kabul edilir). Sonuçlardaki **Watch** dövüşü müzik ve anonsla yeniden oynatır.
6. Bir şey bozulursa ya da tuhaf gelirse bize yaz.

**Bilmen gerekenler:** Testnet kedileri ayrı bir sözleşmedir; mainnet'e taşınmaz. Test ağı tokenlerinin parasal değeri yoktur. Bu sürümde koleksiyonun çizimleri sitenin dosyalarında okunabilir (bilinçli karar).

## 9. Sık sorulan sorular

**1. Fhenix bir zincir mi?**
Hayır. Fhenix CoFHE, mevcut EVM zincirlerine takılan bir FHE koprosesörüdür; ilk tasarımı ayrı bir L2 idi ama bugünkü model "yeni zincir gerekmez" diyor (bölüm 2).

**2. "Fhenix'te mint" ne demek?**
Kedi Arbitrum'da mint edilir. Fhenix yalnızca şifreli kısmı yapar: DNA'yı çeker ve izinli olana çözer.

**3. Fhenix tokenı ya da ayrı bir cüzdan gerekir mi?**
Hayır. Normal bir EVM cüzdanı ve ağın gas'ı (ETH) yeter. Testnet'te başka bir ücret görmedik; mainnet'te lansmanda yeniden doğrulanacak.

**4. Neden testnet Arbitrum Sepolia?**
Mainnet hedefimiz Arbitrum One ve Arbitrum Sepolia onun test sürümü; prova birebir kopya olur (bölüm 3).

**5. Ekip DNA'yı görebilir mi?**
Hayır. Şifreli DNA'nın erişim listesinde yalnızca kontrat vardır; peek eden sahip ve izin verdiği arena eklenir. Ekip kimsenin kedisini açamaz.

**6. Fhenix mainnet'inde yalnızca 5 proje mi var?**
Kaynaklara göre mainnet'le birlikte Fhenix ekibinin seçtiği **beş uygulama** yayına giriyor ve bunlar yaklaşık 60 adaydan seçildi. Başkalarının mainnet'i kullanamayacağını yazan bir kaynak bulamadık. FheCat'in mainnet'te çalışması Fhenix'in erişim kurallarına bağlı; netleştikçe duyuracağız.

**7. Mainnet mint ne zaman?**
Ekim 2026 hedefi. Kesin tarih, Fhenix'in mainnet'e erişim sürecine ve son testlere bağlı.

**8. Reveal zorunlu mu?**
Hayır. Bir kedi sonsuza dek kapalı kalabilir. Kapalı kutu arenada eşitlikleri de kazanır.

**9. Peek etmenin bedeli ne?**
Kedi kalıcı olarak Peeked işaretlenir: alıcılar bunu görür, arenada mühürlü avantajını (4 puan ve eşitlik üstünlüğü) kaybeder. Karşılığında içgüdülerini görürsün.

**10. Görseller nerede?**
Zincir üstünde: `FheCatRenderer` kontratı 32×32 piksel SVG'yi doğrudan üretir. Mainnet'te OpenSea Arbitrum One'daki koleksiyonları kendiliğinden gösterir.

**11. Kontratlar denetlendi mi?**
Hayır. Kapsamlı testler var (kontrat testleri, üç testnet'in fork testleri, tarayıcı testleri) ama bağımsız bir denetim yok. Mainnet öncesi denetim önerilir.

**12. Testnet kedileri mainnet'e taşınır mı?**
Hayır. Testnet ayrı bir sözleşmedir.

**13. Arenada para ya da ödül var mı?**
Yok. Ortaya bir şey konmaz; kazanılan puan, rozet ve şandır.

## Ek: toplulukta paylaşmak için kısa metin (EN)

```
Quick explainer: Fhenix is not a chain you mint on.

Fhenix CoFHE is an FHE coprocessor that plugs into existing EVM chains. FheCat is a normal ERC-721 on Arbitrum. When you mint, our contract asks Fhenix's CoFHE (a contract on the same chain plus an off-chain coprocessor) to draw an encrypted random DNA that nobody can read, not even us. On the testnet you only pay Arbitrum gas in test ETH.

Testnet = Arbitrum Sepolia (Arbitrum One's test network). Mainnet = Arbitrum One. Same contracts, same flow.

Try it now: fhecat.com/testnet (test network, no real money).
```

---

# BÖLÜM B · Dahili

> Bu bölüm teknik ayrıntılar, operasyon rakamları ve kararlar içerir. Paylaşmadan önce gözden geçirin.

## 10. Proje yapısı ve teknoloji

| Klasör | İçerik |
|---|---|
| `art/` | Sprite'lar, özellik ve nadirlik tabloları, TypeScript SVG render'ı (**tek doğruluk kaynağı**), arenanın tam vücut dövüşçüleri, kuralların TypeScript karşılığı (`art/src/arena.ts`) |
| `contracts/` | Hardhat: `FheCat.sol`, `FheCatRenderer.sol`, `FheCatArena.sol`, üretilen `FheCatArt.sol`; testler, deploy ve yönetim görevleri, `launch.json` |
| `web/` | Mint sitesi: Vite + React + wagmi + `@cofhe/sdk`; Playwright E2E; derleme betikleri |
| `landing/` | fhecat.com: düz HTML/CSS/JS, Vercel fonksiyonları (`api/`), waitlist, collab, admin paneli, testnet kopyaları |
| `docs/` | Kör Arena El Kitabı, testnet ve mainnet belgeleri, bu rehber |
| `social/`, `tools/` | Lansman postu görseli; piksel font aracı |
| `.github/workflows/ci.yml` | CI |

**Sürümler:** Solidity 0.8.28 (cancun), OpenZeppelin 5.4, `@fhenixprotocol/cofhe-contracts` **1.0.0**, `@cofhe/sdk` ve `@cofhe/hardhat-plugin` **0.8.0** (Ethereum ve Arbitrum One mainnet'ini tanıyan ilk kararlı sürüm), React 19, wagmi 3, viem 2, Vite 8, TypeScript 5.9, Playwright 1.63. Node 20+ (22 önerilir).

**CI** (`ci.yml`, iki iş, son commit'te ikisi de yeşil):
- `contracts`: derleme, üretilen sanat kütüphanesinin güncel olduğu kontrolü (`npm run art:sol` sonrası `git diff` boş), `npm test`.
- `web`: derleme, admin arena oyununun güncel koddan derlendiği kontrolü, Playwright uçtan uca testleri (yerel zincir + CoFHE mock'ları).

**Yerel geliştirme:** CoFHE mock'ları şifreli rastgele sayı üretemez; bu yüzden yerelde `FheCatLocal` ve `FheCatArenaLocal` deploy edilir (rastgeleliği mock'lanabilir bir işlemle taklit eder, kalan her kod yolu üretimdekiyle aynı; 31337 dışında deploy edilemez). Gerçek `FHE.randomEuint64()` yolu fork testinde ve testnet'te doğrulanır.

## 11. Kontratlar

### FheCat (ERC-721)

ERC-721 + ERC-2981 (royalty) + ERC-4906 (metadata güncelleme) + `Ownable2Step` + `ReentrancyGuard`; Merkle allowlist (OpenZeppelin `StandardMerkleTree`). Kontrat **yükseltilemez**.

| İşlev | Kim | Ne yapar |
|---|---|---|
| `mint(n)` | Herkes (Public aşama) | n kedi (≤ 10/işlem); `maxPerWallet` sınırı |
| `allowlistMint(n, proof)` | Allowlist'tekiler (Allowlist aşaması) | Merkle kanıtı; `allowlistMaxPerWallet` sınırı |
| `ownerMint(to, n)` | Sahip | Ekip rezervi ve airdrop; aşamayı ve cüzdan limitlerini yok sayar, yalnızca arzla sınırlı |
| `peek(id)` | Sahip | Sahibi erişim listesine ekler; kedi kalıcı Peeked |
| `open(id)` | Sahip | `FHE.allowPublic`; kedi Opened |
| `reveal(id, dna, sig)` / `revealBatch` | Herkes (Opened) / sahip (Peeked) | Eşik ağı imzasını `FHE.verifyDecryptResultSafe` ile doğrular, DNA'yı yazar |
| `enterArena(id)` | Sahip | Arenanın şifreli DNA üzerinde hesap yapmasına izin verir (geri alınamaz, arena adresine bağlı) |
| `tokenURI`, `contractURI`, `catOf`, `catsInRange`, `catsOfOwner`, `stateOf` | Okuma | Renderer'dan SVG ve metadata |
| `setPhase`, `setPrices`, `setWalletLimits`, `setAllowlistRoot`, `setRenderer`, `setArena`, `setDefaultRoyalty`, `withdraw` | Sahip | Satış ve ayar yönetimi |

`launch.json`: arz 4444, fiyat 0,00115 ETH (hem public hem allowlist), cüzdan başına 3 (her iki aşamada), royalty 500 bps. Testnet ve mainnet için aynı dosya; deploy betiği gerçek ağda bu dosyadan sapmaya izin vermez, mainnet'te `CONFIRM_MAINNET=yes` ister. `owner` boşsa deploy cüzdanı sahip olur.

**Olaylar:** `CatBorn`, `CatPeeked`, `CatOpened`, `CatRevealed`, `CatEnteredArena`, `PhaseChanged`, `PricesChanged`, `WalletLimitsChanged`, `AllowlistRootChanged`, `RendererChanged`, `ArenaChanged`.

**Başlıca hatalar:** `SaleNotActive`, `InvalidQuantity`, `ExceedsMaxSupply`, `ExceedsWalletLimit`, `WrongPayment`, `NotOnAllowlist`, `NotHolder`, `AlreadyRevealed`, `AlreadyOpened`, `RevealLocked`, `NoArena`, `InvalidDecryptionProof`.

### FheCatRenderer

32×32 piksel SVG'yi ve metadata'yı zincir üstünde üretir: 8 özellik (Arka plan 10, Kürk 12, Desen 10, Gözler 16, Ağız 10, Başlık 16, Aksesuar 12, Aura 7 = 93 seçenek), her kedide DNA'nın tamamından seçilen 4 yıldız, reveal edilmemiş kediler için duruma göre kutu (barkod, kedinin kendi şifreli referansından türer). Sanat verisi `art/` kaynağından `npm run art:sol` ile `FheCatArt.sol` olarak üretilir; CI güncelliğini denetler. `tokenURI` çağrısı en fazla ~1,4M gas (RPC sınırlarının çok altında). Sitedeki TypeScript render'ı ile zincirdeki çıktı **bayt bayt aynıdır** (testler doğrular); bu sayede gizli bakışta DNA tarayıcıdan çıkmaz.

### FheCatArena (Kör Arena)

| İşlev | Kim | Ne yapar |
|---|---|---|
| `challenge(kedi, rakip, taktik, kanıt)` | Sahip | Meydan okur (rakip 0 ise herkese açık); taktik `externalEuint8` |
| `accept(düello, kedi, taktik, kanıt)` | Rakibin sahibi | Kabul eder; dövüş aynı işlemde FHE ile hesaplanır |
| `settle(düello, sonuç, imza)` | Herkes | Sonucu eşik ağı imzasıyla yazar; puan ve rozet verir |
| `cancel(düello)` | Meydan okuyanın sahibi | Kabul edilmemiş meydan okumayı geri çeker |
| `crownWeek(hafta)` | Herkes | Biten haftanın tacını verir (bitişten 1 gün sonra) |
| `claimTier(kedi, kademe)` / `settleTier(...)` | Sahip / herkes | Kademe sorusunu FHE ile hesaplar, yalnızca evet/hayırı açar |

Sabitler: puan 3 / 4 (mühürlü) / 1; meydan okuma 3 gün açık; hafta pazartesi 00:00 UTC; taç için 1 gün bekleme; Sealed Legend için 5 mühürlü galibiyet; kademe eşikleri Rare 1200, Epic 1350, Legendary 1500, Mythic 1600 (Power = DNA'nın 8 baytının toplamı). Ayrıntı: [El Kitabı](ARENA_HANDBOOK.md).

### Gas (Arbitrum Sepolia, gerçek CoFHE)

| İşlem | Gas |
|---|---|
| Public mint, 1 kedi | ≈ 174–176k (canlı public site testi: 176.204) |
| Public mint, 3 kedi | ≈ 396k |
| Peek / Open / Reveal | ≈ 106k / 88k / 62k |
| Transfer | ≈ 43k |
| Arenaya giriş | ≈ 85k |
| Meydan okuma (ilk kez / sonraki) | ≈ 1,0M / ≈ 634k |
| Kabul ve dövüş (ilk kez / sonraki) | ≈ 2,3M / ≈ 1,74M |
| Sonucu yazma | ≈ 211k |
| Kademe sorusu / cevabı yazma | ≈ 983k / ≈ 81k |

Bütün bir düello 0,09 gwei'de ≈ 0,0003 ETH tuttu. FHE işlemleri zincir dışında yapıldığı için ayrıca FHE ücreti ödenmedi. Şifre çözme süreleri: gizli bakış 0,2–0,8 sn (siteden, imza dahil ≈ 4 sn), düello sonucu 2,5–4 sn.

### Testler

- `cd contracts && npm test`: **55 test geçiyor** (mint, kutu durumları, ACL, reveal, Kör Arena, metadata, TypeScript↔Solidity render birebirliği, dövüşçüler), 2 fork testi yalnızca `FORK=...` ile çalışır.
- **Fork testleri** (`npm run test:fork`): üretim kontratını canlı testnet'lerin (Arbitrum, Base, Ethereum Sepolia) ve `FORK=arbitrum` ile mainnet'in fork'unda gerçek TaskManager'a karşı çalıştırır.
- **Playwright E2E (6 test, CI'da yeşil):** mint → peek → reveal; kutuyu açma; iki cüzdanlı kör düello (canlı dövüş, tekrar, taktikleri açma); dövüş koreografisi; admin Arena sekmesinin aynı dövüşü oynatması; sahibin siteden satışı yönetmesi.
- **Testnet provası:** gerçek şifreli düellolar (bölüm 14).

## 12. Mint sitesi

`web/`: Vite + React 19 + wagmi 3 + viem + `@cofhe/sdk` (tarayıcı sürümü). İngilizce; fhecat.com ile aynı piksel tasarım. Analitik ya da takip kodu yok; dışarıya yalnızca zincirin RPC'sine ve şifre çözme sırasında Fhenix servislerine istek gider.

- **Bölümler:** Mint, My cats, Arena (dövüşçüler, açık meydan okumalar, sonuçlar, haftalık tablo, rozetler, kademe kanıtı), How it works, Latest, Traits; yalnızca kontrat sahibinin cüzdanında görünen **Owner** bölümü (faz, fiyat, limit, allowlist kökü, ekip rezervi, para çekme, royalty, sahiplik).
- **Fhenix servisleri (testnet):** CoFHE `testnet-cofhe.fhenix.zone`, doğrulayıcı `testnet-cofhe-vrf.fhenix.zone`, eşik ağı `testnet-cofhe-tn.fhenix.zone`. Mainnet: `cofhe.mainnet.fhenix.zone`.
- **Şifreleme/çözme akışı:** taktikler `encryptInputs` ile (doğrulayıcı imzası girdiyi cüzdana ve arenaya bağlar), kendi kedini çözme `decryptForView` (ücretsiz EIP-712 izni), herkese açık çözüm `decryptForTx` (eşik ağı imzasıyla zincire).
- **Dövüş sahnesi ve ses:** koreografi `web/src/arena`; müzik ve efektler WebAudio ile üretilir, anons dokuz kısa klipten oluşur (≈ 92 KB, Kokoro-82M, Apache-2.0; `web/scripts/arena-voice.py`). Tercih tarayıcıda hatırlanır.
- **Üç yayın biçimi:**

| Adres | Kim açabilir | Derleme |
|---|---|---|
| `fhecat.com/testnet/` | **Herkes** (giriş yok, `noindex`, başlık "Testnet") | `cd web && npm run build:testnet-copy` → `landing/testnet/` |
| `fhecat.com/admin/mint/` | Admin oturumu (`landing/middleware.js`) | `npm run build:admin-copy` → `landing/admin/mint/` (admin Arena sekmesinin `arena-game.js`'i de burada) |
| Vercel `fhecat-mint` projesi (`web/`) | Vercel girişi (SSO) | Push'ta kendini derler |

Siteyi değiştirince iki kopya yeniden derlenip commit'lenir. Mainnet'te site için ayrı bir alan adı (ör. `mint.fhecat.com`) planlanıyor.

## 13. fhecat.com: waitlist, collab, admin

`landing/`: düz HTML/CSS/JS; yalnızca birkaç Vercel fonksiyonu ve Neon Postgres kullanır. Vercel projesi `fhecat` (alan adı fhecat.com; `www` ve `fhecat.vercel.app` yönlenir). Bu dala her push'ta kendini günceller.

- **Ana sayfa:** gece yürüyüşü gibi akan altı sahne (şifreli kedi kartı, kilitli kutularda matematik, yıldızlar, yol haritası, SSS). Hero'da mint tarihi (Ekim 2026), OpenSea · Soon rozeti ve üç düğme (**Join the waitlist**, **Decrypt the story**, **Collab**). Collab başvuruları kapalıyken Collab düğmesi tıklanmaz ve "Soon" etiketi taşır.
- **Waitlist** (`/waitlist`, beş adım): X'te takip → kullanıcıya özel piksel WL kartı → kartı X'te paylaş (post linki) → lansman postunu beğen/RT/yanıtla (yanıt linki) → EVM cüzdanı gir. Sunucu biçimleri, linklerin o kullanıcının postu olduğunu ve tekrarları kontrol eder. X'in takip/beğeni/RT bilgisi ücretsiz doğrulanamadığı için her kayıt `pending` gelir, elle `approved`/`rejected` yapılır.
- **Collab** (`/collab`): DAO, guild ve alpha grupları WL yeri ister. Kısa form (X post linki zorunlu); bir X hesabı ve bir cüzdan en fazla 2 başvuru yapar; imza ücretsizdir (7 günlük oturum). Admin yer sayısı ve süre vererek onaylar; topluluk kendi çekilişini yapıp kazananların cüzdanlarını girer. **Çekiliş postunun linki zorunlu**, **AlphaBot linki isteğe bağlı** (yalnızca `alphabot.app` kabul edilir). Liste süre bitmeden gönderilir ve kilitlenir.
- **Admin** (`/admin`, `ADMIN_PASSWORD`, 12 saatlik oturum, `noindex`): **Waitlist** (arama, onay/ret, toplu işlem, CSV/TXT dışa aktarma), **Collabs** (kartlar, onay, açma/kapama anahtarı, **Allowlist .txt**, **Collab wallets .csv**), **Arena** (testnet'teki arenayı zincirden okur, her sonucu izletir), testnet mint kopyasına bağlantı.
- **API'ler:** `api/waitlist.js`, `api/collab.js` (`_collab.js` ortak), `api/admin.js`, `api/_arena.js`. Kayıtlar Neon'da (`waitlist`, `collabs`, `site_settings` tabloları; tablolar ilk istekte kendiliğinden oluşur/genişler). Ortam değişkenleri `DATABASE_URL` ve `ADMIN_PASSWORD` (değerler repoda yok). Çerezler ve imza mesajları `ADMIN_PASSWORD`'dan türetilen anahtarla imzalanır.

**Durum (17 Ekim 2026, admin API'sinden okundu):**

| | Toplam | Bekleyen | Onaylı | Reddedilen |
|---|---|---|---|---|
| Waitlist | **14.289** (bugün 7 yeni) | 14.251 | **0** | 38 |
| Collab | 39 | 36 | 0 | 3 |

Collab başvuruları açık. **Allowlist kaynağı onaylı kayıtlar olduğundan, bugün allowlist boş** (bölüm 17).

## 14. Testnet dağıtımı ve sonuçlar

**Kontratlar (Arbitrum Sepolia, 421614):**

| Kontrat | Adres |
|---|---|
| FheCat | `0xd4F8521c8F4dBd22fe8E0877beF1Fd91A0691b24` (blok 316602853) |
| FheCatRenderer | `0x363fF5772cfA089e2A16D64a27087Ff54fC02F0C` |
| FheCatArena (Kör Arena) | `0x2c72A0cdBB5685A0461989964C9574eAc202c2c7` |
| Fhenix TaskManager (testnet) | `0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9` |

Kaynak kodu Arbiscan'da bilerek **doğrulanmadı** (doğrulanırsa çizimler herkesin okuyabileceği hale gelir); mainnet'te doğrulanır. İlk (güç düellosu) arena `0xf0c2…Bff5` artık kullanılmıyor.

**Cüzdanlar:** hepsi atılabilir test cüzdanları (`owner` kontratları kurar ve satışı yönetir; `alice` ve `carol` allowlist'te, `bob` değil; `dave` ve oyuncu cüzdanları siteyi gerçek kullanıcı gibi dener). Anahtarlar yalnızca çalışma oturumunun geçici klasöründe durur, repoda yoktur.

**Provalar (ayrıntı: [TESTNET.md](TESTNET.md)):**
- `rehearse.ts`: 12 adımın 12'si geçti (allowlist ve public mint, tüm reddetme durumları, peek, iki tür reveal, devir sonrası reveal, kutuyu açma, arena, ekip rezervi, para çekme, iki adımlı sahiplik devri).
- Site testleri: mint → peek → reveal → open → arena → kademe, tarayıcıda gerçek threshold network ile geçti (14 + 13 işlem).
- Kör Arena: taktikler Node'da ve tarayıcıda gerçek CoFHE doğrulayıcısıyla şifrelendi; sonuçlar eşik ağınca çözüldü; reddedilen her durum doğru hatayla reddedildi.
- **17 Ekim:** admin oturumu olmayan bir ziyaretçiyle `fhecat.com/testnet/` canlıda denendi: bağlan, mint (5 sn), gizli bakış (4 sn) hatasız çalıştı. Oyuncu dövüşü videoya alındı.

**Şu anki durum:** 27 kedi (#1–#27), satış **Public** aşamada açık, arenada 3 açık meydan okuma (#14, #1, #5; test cüzdanlarından), sahiplik `owner` cüzdanında. OpenSea testnet desteğini Temmuz 2025'te kapattığı için testnet kedileri OpenSea'da görünmez.

## 15. Mainnet: durum ve plan

### 15.1 Fhenix tarafı (zincirden okundu, 17 Ekim 2026)

| | Değer |
|---|---|
| CoFHEAddressBook (her zincirde aynı adres) | `0xC0F4e00E531a2B086492Ae3DCC1515038307196b` (`getTm(1)`) |
| Mainnet TaskManager (Ethereum ve Arbitrum One) | `0x52E7a0cAF234b266bCFAa6aA933a412FDe58432A` (proxy; mantık `0x9f34…1e8a`) |
| Arbitrum One: etkin mi? | **Evet.** `EnabledSet(true)`, **13 Ekim 12:17 UTC** |
| Arbitrum One: erişim listesi | **Açık** (`accessListEnabled: true`; 4 Ekim'de açıldı) |
| Listedeki kontratlar | **9:** 13 Ekim'de eklenen, ne olduğunu belirleyemediğimiz 1 kontrat (isim ve sembol vermiyor); 14 Ekim'de Fhenix'in kendi 8 gizli token kontratı (fBTC, fUSDS, fARB, fUNI, fUSDT, fUSDC, fLINK, fETH) |
| Üçüncü taraf uygulama | Listede doğrulanabilen yok |
| Duyuru | 21 Ekim 2026; Ethereum ve Arbitrum One; Fhenix'in seçtiği **5 uygulama** (≈ 60 adaydan) lansmanla birlikte; tarih Fhenix ekibiyle doğrudan teyit edildi |

Erişim listesi, TaskManager'a kontrat bazında FHE izni veren bir mekanizmadır: listede olmayan bir kontratın FHE çağrısı `NotOnAccessList(address)` ile reddedilir. Listeye ekleme ve listeyi kapatma yetkisi Fhenix'te. Listenin 21 Ekim'den sonra ne olacağı zincirde yazmıyor; kapanırsa `AccessListEnabledSet(false)` olayı görünür. Kaynaklar yalnızca "beş uygulama lansmanla çıkıyor" diyor; başkalarının kapalı kalacağını söyleyen bir kaynak yok.

### 15.2 FheCat mint'i bugün ne yapar? (Arbitrum One fork'unda denendi)

`contracts/scripts/access-list-fork.ts` (`COFHE_SKIP_MOCKS_DEPLOY=1 FORK=arbitrum npx hardhat run scripts/access-list-fork.ts`); gerçek zincire hiçbir şey gönderilmez:

| Durum | FheCat mint'i |
|---|---|
| Zincirin bugünkü hali: CoFHE açık, liste açık, FheCat listede yok | **`NotOnAccessList(address)` ile reddedilir** |
| FheCat listeye eklenirse (`addToAccessList`) | Çalışır |
| Liste tamamen kapatılırsa (`disableAccessList`) | Çalışır |

Yani mainnet mint'i için iki yoldan biri gerekli: Fhenix listeyi kapatır **ya da** FheCat ve FheCatArena'yı listeye ekler. (Renderer FHE çağrısı yapmaz, listeye gerekmez.)

### 15.3 Yapılacaklar

1. **Fhenix'e sor** (en önemli adım): (a) 21 Ekim'de mainnet erişim listesi açık kalacak mı? (b) Kalacaksa `FheCat` ve `FheCatArena` nasıl listeye alınır, adres mi isterler, form mu var? (c) Şifreli rastgelelik (`FHE.randomEuint64`), şifreli girdiler (`encryptInputs` ve doğrulayıcı imzası) ve herkese açık şifre çözme (`decryptForTx`) lansmanda açık olacak mı? Resmî kanallar: Discord, Telegram, Fellowship ve Partner başvuru formları (fhenix.io'da listeli) ve `devs@fhenix.io` (cofhe-contracts paketinin geliştirici adresi).
2. **Önceden deploy:** kontratların kurucuları FHE çağrısı yapmaz; adres gerekiyorsa mainnet'e önce deploy edip adresleri iletebilirsiniz. Mint liste onayı gelene kadar açılmaz. Deploy'u proje sahibi kendi bilgisayarından yapar: `contracts/.env` (git'e girmez) içinde `PRIVATE_KEY` (yalnızca gas parası tutan yeni bir cüzdan en güvenlisi), `ETHERSCAN_API_KEY`, `ARBITRUM_RPC_URL`; `CONFIRM_MAINNET=yes npm run deploy:arbitrum`. Deploy'dan önce `launch.json`'da fiyat güncel kurla ayarlanır.
3. **Lansman günü kontrol:** `cd contracts && FORK=arbitrum npm run test:fork` iki testi de geçmeli ("CofheIsUnavailable" ile atlıyorsa CoFHE kapalı, "NotOnAccessList" ise FheCat listede değil).
4. **Allowlist:** Admin → Collabs → **Allowlist .txt** (onaylı waitlist cüzdanları + onaylı collab kazananları) → `npx hardhat fhecat:allowlist <dosya> --write-only` → `web/public/allowlist.json` commit → site yayınlanınca sahip Owner bölümünden **Use this site's list** ile kökü yazar.
5. **Site:** `deployments.json` ve `allowlist.json` commit; `fhecat-mint` projesine alan adı bağla ve korumayı "özel alan adları hariç" yap.
6. **Satış:** Owner bölümünden sırayla Allowlist, sonra Public; `fhecat:status` ile izlenir.
7. **OpenSea:** Arbitrum One'ı destekler ve ERC-721'leri kendiliğinden indeksler. Koleksiyon sayfası kontratın `owner()` cüzdanıyla düzenlenir; reveal'lar `MetadataUpdate` (ERC-4906) ile görseli kendisi yeniler.

## 16. Riskler ve bilinen sınırlar

**Fhenix bağımlılığı**
- **Erişim listesi** mainnet mint'ini bugün bloke ediyor (15.2). Karar Fhenix'te.
- CoFHE kapalıyken ya da eşik ağı yavaşken mint ve arena işlemleri geri döner ya da sonuç gecikir. Transfer ve görseller etkilenmez.
- Mainnet'te Fhenix ücret modeli lansmanda yeniden doğrulanmalı (testnet'te Fhenix ücreti görülmedi).

**Kontrat riskleri**
- **Bağımsız denetim yok.** Mainnet'ten önce denetim önerilir.
- Kontratlar **yükseltilemez**; hata sonradan düzeltilemez (renderer ve arena adresi değiştirilebilir).
- ACL izinleri geri alınamaz; peek eden satıcı DNA'yı çözebilmeye devam eder (bu yüzden Peeked işareti kalıcı).
- **Sahip yetkileri geniş:** fiyat, limit, faz, allowlist kökü, renderer, arena, royalty, para çekme. Tek bir sahip cüzdanı yerine bir Safe (multisig) önerilir (`Ownable2Step` ile devredilebilir).
- **Ekip rezervi için sözleşmede ayrı bir üst sınır yok:** `ownerMint` yalnızca toplam arzla sınırlı. Topluluk güveni için mainnet'ten önce bir rezerv sınırı (kontrata ya da duyuruya) düşünülmeli.
- ERC-2981 royalty bilgilendiricidir; pazar yerleri uygulamayabilir.

**Arena (el kitabı bölüm 12)**
- İki cüzdanla haftalık tacı kasma, sonuçlardan kaba bilgi sızması, oyuncuların birbirinin alışkanlığını öğrenmesi, herkese açık kademe denemeleri, taç için 1 günlük aralık, arena değişirse sicilin taşınmaması. Önerilen azaltma: kedi başına haftalık sayılan düello sınırı.

**Gizlilik ve çizimler**
- **17 Ekim'den beri herkese açık testnet sitesi koleksiyonun bütün çizimlerini JS dosyalarında okunur kılıyor** (bilinçli karar; geri almak için `landing/testnet/` silinir, ama görülenler geri alınamaz). Testnet renderer'ının bytecode'u da zincirde herkese açık.

**Operasyon**
- **Waitlist'te 14.251 bekleyen kayıt var, onaylı 0.** Elle inceleme bu hacimde darboğaz; allowlist bugün boş (bölüm 17).
- Test sürümünde cüzdan başına 3 sınırı çok cüzdanla aşılabilir; 4444'lük testnet stoku doldurulabilir.
- Tek sahip cüzdanı, tek admin parolası; deploy anahtarı yalnızca geçici ortam değişkeninde tutulmalı.

## 17. Bekleyen kararlar

1. **Fhenix erişim listesi:** soru gönderildi mi, yanıt ne? (15.3-1). Yanıta göre: önceden deploy edip adres iletmek ya da bekleme.
2. **Rarity evrimi (önerildi, karar bekliyor):** açılmamış (Sealed ve Peeked) kediler arenada kazanıp kaybederek nadirlik değiştirsin mi? Önerilen sınırlı hali: yalnızca açılmamış kediler; galibiyette %25 (revealed bir kediyi yenerse %50) rastgele bir özellik bir kademe nadirleşir; mağlubiyette %25 bir kademe yaygınlaşır; toplam ±2 kademe, haftada en fazla bir zar. Üç şart: **mainnet'ten önce** eklenmeli (kontrat yükseltilemez), kural kontratta sabit olmalı (ekip bile değiştirememeli), çok cüzdanla kasma riski artar; testler ve prova baştan yapılır, mint birkaç gün kayabilir. Seçenek: bunu yap **ya da** sabit DNA ile çık.
3. **Ekip rezervi:** miktar ve kontrat sınırı (16).
4. **Owner cüzdanı:** tek cüzdan mı, Safe (multisig) mi.
5. **Waitlist onay süreci:** 14.251 bekleyen kayıt için ölçüt ve işlem (toplu onay, örnekleme, ek kontrol) ve allowlist büyüklüğü.
6. **Collab:** AlphaBot linki isteğe bağlı mı kalsın, zorunlu mu olsun; 36 bekleyen başvuru.
7. **Denetim:** mainnet öncesi bağımsız denetim yaptırılacak mı.
8. **Ana sayfa:** "Try the testnet" düğmesi eklensin mi (şu an link verilmiyor).
9. **Mint tarihi:** Fhenix mainnet'e erişimine göre netleşince duyuru.
10. **İkinci aşama (planlanan):** Night Expeditions ve Community Constellation.

---

## Sözlük

| Terim | Anlamı |
|---|---|
| **FHE** | Tam homomorfik şifreleme: şifreli veri üzerinde şifresini çözmeden hesap. |
| **CoFHE** | Fhenix'in FHE koprosesörü. Zincir dışında şifreli hesabı yapar, zincirde TaskManager ve ACL kontratlarıyla konuşur. |
| **Koprosesör (coprocessor)** | Ana işlemcinin (zincirin) yapamayacağı ya da pahalı olacağı hesabı onun yerine yapan yardımcı işlemci. |
| **TaskManager** | Her zincirdeki Fhenix kontratı: FHE işlerini ve erişim listesini (ACL) tutar. `CoFHEAddressBook` ile bulunur. |
| **ACL** | Bir şifreli veriye kimin erişebileceğini tutan liste (`FHE.allow`, `allowThis`, `allowPublic`). Verilen izin geri alınamaz. |
| **Handle** | Şifreli verinin zincirdeki 32 baytlık referansı (`euint64` gibi tipler bunu sarar). |
| **Eşik (threshold) ağı** | İzin varsa şifreyi çözen ve sonucu imzalayan Fhenix ağı. |
| **Permit (ACP)** | Kendi verini çözmek için attığın ücretsiz EIP-712 imzası. |
| **`decryptForView`** | Şifreyi yalnızca isteyenin tarayıcısında çözer. |
| **`decryptForTx`** | Herkese açık bir şifreyi imzalı olarak çözer; imza zincire verilebilir. |
| **Erişim listesi (access list)** | Mainnet TaskManager'ında hangi kontratların FHE işlemi yapabileceğini belirleyen liste. |
| **Peek / Open / Reveal** | Gizlice bak / herkese aç / DNA'yı zincire yaz. |
| **Mühürlü (sealed)** | Hiç peek edilmemiş (Unopened) kedi; arenada eşitlikleri kazanır, galibiyeti 4 puandır. |
| **L2 / rollup** | Ethereum'un üstünde çalışan ölçekleme zinciri. Arbitrum bir L2'dir. |

## Kaynaklar

- Fhenix: [How FHE Rollups Bring Private, Scalable Smart Contracts to Ethereum, Arbitrum and Base](https://fhenix.io/fhe-rollups-sc) (orijinal L2 modeli ve bugünkü koprosesör modeli)
- Arbitrum blog: [Fhenix, Bringing Private Computation to Web3 with Arbitrum](https://blog.arbitrum.io/fhenix-private-computation/) (Mayıs 2025)
- [CoFHE dokümanları](https://cofhe-docs.fhenix.zone/)
- Incrypted: [Fhenix mainnet 21 Ekim'de Ethereum ve Arbitrum'da](https://incrypted.com/en/fhenix-will-launch-its-mainnet-with-support-for-confidential-tokens-on-october-21/)
- Zincirden: [Arbitrum One TaskManager](https://arbiscan.io/address/0x52E7a0cAF234b266bCFAa6aA933a412FDe58432A), [Arbitrum Sepolia TaskManager](https://sepolia.arbiscan.io/address/0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9), [FheCat (testnet)](https://sepolia.arbiscan.io/address/0xd4F8521c8F4dBd22fe8E0877beF1Fd91A0691b24), [örnek mint işlemi](https://sepolia.arbiscan.io/tx/0x3e96871c14f1b8046194df8c1f6b5e3ae1e91adda0a26ac0f9a4420d95d166a0) (FheCat'e gider; aynı işlemin log'larında Fhenix TaskManager'ından olay vardır)
