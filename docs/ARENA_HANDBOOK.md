# Kör Arena El Kitabı

FheCat'in Kör Arena'sı (Blind Arena) iki kedinin şifreli dövüşüdür. Bu el kitabı oyunun her kuralını
`contracts/contracts/FheCatArena.sol` sözleşmesinin yaptığı şekilde anlatır. Sayılar doğrudan sözleşmeden alınmıştır,
olasılıklar da aynı aritmetikle hesaplanmıştır. Sitedeki düğme ve ekran adları İngilizce olduğu için onlar
**kalın** ve İngilizce yazıldı.

> *You don't need to see your cat to become a legend.*

---

## 1. Kısaca

- Her oyuncu üç taktikten birini seçer: **Pounce**, **Trick**, **Guard**. Taş-kâğıt-makas gibi döner:
  Pounce Trick'i, Trick Guard'ı, Guard Pounce'u yener.
- Taktik oyuncunun tarayıcısında şifrelenir. Dövüş bitene kadar onu kimse göremez, karşı taraf da.
- Her kedinin her taktik için gizli bir **içgüdüsü** (instinct, 0–2) vardır. İçgüdü kedinin şifreli DNA'sından gelir:
  nadir özellikler içgüdüyü artırır.
- Arena iki tarafın skorunu tamamen şifreli hesaplar:
  **skor = 2 (taktiğin rakibinkini yeniyorsa) + içgüdü + şans (0 ya da 1)**. Yüksek skor kazanır.
- Beraberlikte **mühürlü kutu** (hiç bakılmamış kedi) kazanır. İki taraf da mühürlüyse ya da ikisi de değilse
  şifreli bir yazı-tura karar verir.
- Dışarıya yalnızca **kimin kazandığı** çıkar. DNA, içgüdüler, taktikler ve skorlar şifreli kalır. Dövüşten sonra
  iki taktiği yalnızca iki oyuncu görebilir.
- Puanlar: galibiyet **3**, mühürlü kutuyla galibiyet **4**, mağlubiyet **1**. Haftanın birincisi
  **Weekly Crown** rozetini alır. Rozetler ve sicil kedide kalır, kedi satılınca da onunla gider.
- İki kedi aynı hafta içinde en fazla **bir kez** karşılaşır.
- Ortaya hiçbir şey konmaz: kedi el değiştirmez, DNA'sı ve nadirliği değişmez, ödül ya da ücret yoktur. Oyuncu
  yalnızca işlemlerin gas'ını öder. Kazanılan tek şey şandır.

---

## 2. Terimler

| Terim | Anlamı |
| --- | --- |
| **Holder** | Kedinin o anki sahibi (cüzdan). Arenada her işlemi kedinin o anki sahibi yapar. |
| **Challenger** | Meydan okuyan kedi. Sahnede solda durur. |
| **Opponent** | Meydan okumayı kabul eden kedi. Sahnede sağda durur. |
| **DNA** | Mint'te `FHE.randomEuint64()` ile çekilen 64 bitlik şifreli sayı. 8 baytının her biri bir özelliği seçer. Her özelliğin seçenekleri yaygından nadire doğru sıralıdır: bayt ne kadar büyükse seçenek o kadar nadirdir. |
| **Instinct** | Kedinin bir taktikteki gizli içgüdüsü (0, 1 ya da 2). Bkz. bölüm 5.2. |
| **Power** | DNA'nın 8 baytının toplamı (0–2040). Yalnızca kademe kanıtında kullanılır. Bkz. bölüm 9. |
| **Tier** | Power'a göre kademe: Rare, Epic, Legendary, Mythic. |
| **Week** | Pazartesi 00:00 UTC'den sonraki pazartesi 00:00 UTC'ye kadar. |

### Kutu durumları

Her kedi şu durumlardan geçer. Yön hep ileridir, geri dönüş yoktur, ve her adımı yalnızca sahibi atar.

| Durum | Ne demek | Arenada |
| --- | --- | --- |
| **Sealed** (Unopened) | Kediyi bugüne kadar kimse görememiştir. Bu zincirde kanıtlanabilir. | **Mühürlü** sayılır: galibiyeti 4 puan ve beraberlikte üstünlük getirir. |
| **Peeked** | Bir sahip kediyi özel olarak çözmüştür (`peek`). Başkası hâlâ göremez, ama işaret kalıcıdır. | Mühürlü sayılmaz. |
| **Opened** | Sahip DNA'yı herkesin çözebileceği hale getirmiştir (`open`). | Mühürlü sayılmaz. |
| **Revealed** | DNA zincire yazılmış, kedi çizilmiştir. | Mühürlü sayılmaz. Sahnede kendisi olarak dövüşür. |

Mühür durumu düellonun kabul edildiği anda okunur ve o düello için öyle kalır. Sonradan peek yapmak eski
sonuçları değiştirmez.

---

## 3. Arenaya giriş

Bir kedi düello açmadan, kabul etmeden ya da kademe istemeden önce **bir kez** arenaya girer:
`FheCat.enterArena(tokenId)` (sitede **Enter arena**).

- Bu işlem arena sözleşmesine kedinin şifreli DNA'sı üzerinde hesap yapma izni verir. Hiçbir şey açığa çıkmaz.
  Arena bir sözleşmedir, cüzdan değildir. Yalnızca kodunun izin verdiği sonucu (kazananı ya da kademe cevabını)
  yayımlayabilir, DNA'yı asla yayımlayamaz.
- İzin geri alınamaz (CoFHE erişim listesinin kuralı) ve kedi satılınca da geçerli kalır.
- İzin o arena adresine bağlıdır. Ekip yeni bir arena sözleşmesi kurarsa kediler yeniden girer, eski sicil yeni
  arenaya taşınmaz.
- Girmemiş bir kediyle yapılan işlem `NotInArena` hatasıyla geri döner.

Bir kedinin içgüdüleri ilk oyununda, Power'ı ilk kademe isteğinde **bir kez** hesaplanır ve şifreli saklanır.
Onları kimse çözemez, arena da dahil.

---

## 4. Bir düello adım adım

### 4.1 Meydan okuma (`challenge`)

Sahip kedisini, rakibini ve taktiğini seçer. Rakip belirli bir kedi numarası olabilir, ya da boş bırakılarak
**herkese açık** bir meydan okuma açılabilir (sitede **Challenge**, sonra **Lock & challenge**). Taktik tarayıcıda CoFHE ile şifrelenir. Şifreli
girdi, CoFHE doğrulayıcısının imzasıyla **o cüzdana ve bu arenaya** bağlıdır. Başka bir cüzdan ya da sözleşme onu
kullanamaz.

İşlem şu durumlarda reddedilir:

| Durum | Hata |
| --- | --- |
| Kedi bu cüzdanda değil | `NotHolder` |
| Kedi arenaya girmemiş | `NotInArena` |
| Kedi kendine meydan okuyor | `SameCat` |
| Rakip kedi de aynı cüzdanda | `SameHolder` |
| Bu iki kedi bu hafta zaten karşılaştı | `AlreadyMetThisWeek` |
| Kedinin hâlâ açık bir meydan okuması var | `AlreadyChallenging` |

Herkese açık meydan okumada rakip henüz belli olmadığı için `SameHolder` ve `AlreadyMetThisWeek` kontrolleri kabul
anında yapılır.

### 4.2 Bekleme ve geri çekme (`cancel`)

- Bir meydan okuma **3 gün** açık kalır. Süresi dolunca kabul edilemez. Zincirde durumu "Open" görünmeye devam eder,
  ama kedi yeni bir meydan okuma açabilir.
- Bir kedinin aynı anda tek bir açık meydan okuması olabilir.
- Meydan okuyan kedinin o anki sahibi, kabul edilmemiş bir meydan okumayı istediği zaman geri çekebilir (sitede
  **Withdraw**).
- Meydan okuyan kedi Peeked ise site rakibe bunu söyler ("Its holder has peeked and knows its instincts. Bluff?").

### 4.3 Kabul ve dövüş (`accept`)

Rakip kendi kedisini ve kendi şifreli taktiğini seçer (sitede **Lock & fight**). **Dövüş aynı işlemde, tamamen
FHE altında hesaplanır.** Sonuç (1: challenger kazandı, 2: opponent kazandı) şifreli bir değer olarak üretilir ve
herkesin çözebileceği hale getirilir. Başka hiçbir ara değer açılmaz.

Kabul şu durumlarda reddedilir:

| Durum | Hata |
| --- | --- |
| Meydan okuma açık değil (kabul edilmiş ya da geri çekilmiş) | `DuelNotOpen` |
| 3 gün dolmuş | `DuelExpired` |
| Meydan okuma başka bir kediye yapılmış | `NotChallenged` |
| Kedi kendisiyle dövüşecek | `SameCat` |
| Kabul eden kedi bu cüzdanda değil | `NotHolder` |
| Meydan okuyan kedi o zamandan beri el değiştirmiş | `ChallengerMoved` |
| Kabul eden, meydan okuyanla aynı cüzdan | `SameHolder` |
| Bu iki kedi bu hafta zaten karşılaştı | `AlreadyMetThisWeek` |
| Kabul eden kedi arenaya girmemiş | `NotInArena` |

Kabul anında iki şey kaydedilir: dövüşün zamanı (hangi haftaya sayılacağını belirler) ve iki kutunun o anki mühür
durumu.

### 4.4 Sonuç (`settle`)

Sonucun zincire yazılması ayrı bir işlemdir. CoFHE eşik ağı herkese açık sonucu çözer ve imzalar. **Herkes** bu
imzayla `settle` çağırabilir. Site bunu kabul eden oyuncunun tarayıcısında kendiliğinden yapar. Sonuç yazılmamış bir
düello sitede **Settle** düğmesiyle herkes tarafından tamamlanabilir.

Settle ile birlikte:

- Kazanana ve kaybedene puanlar yazılır. Puanlar **dövüşün yapıldığı haftaya** gider, settle'ın yapıldığı haftaya değil.
- Rozetler verilir (bölüm 7).
- Gerekirse geçen haftanın tacı verilir (bölüm 6).

### 4.5 Taktikleri görmek

Dövüşten sonra iki oyuncu iki taktiği de çözebilir. Sitede **Watch with tactics** düğmesi ücretsiz bir imza ister.
Başka hiç kimse, ekip dahil, bu taktikleri hiçbir zaman göremez. Meydan okuyanın taktiğini rakip yalnızca kabul
ettikten sonra görebilir.

### 4.6 İzlemek

Her sonuç sitede **Watch** ile tekrar oynatılabilir:

- İzleyiciler taktikleri bilmez. Bu yüzden bir kavga bulutu ve içinden çıkan kazananı görürler.
- Taktikleri çözmüş iki oyuncu gerçek hareketleri görür: Pounce sıçrar, Trick dumanda kaybolup arkadan vurur, Guard
  kalkan kaldırır. Beklenen galibiyet ile sürpriz farklı oynanır.
- Revealed kediler kendileri olarak dövüşür. Diğerleri kendi barkodlu kutuları olarak dövüşür. Peek yapmış sahip kendi
  kedisini yalnızca kendi ekranında kendisi olarak görür.
- Dövüşe chiptune müzik, efektler ve bir anons sesi eşlik eder ("Blind Arena!", "Tactics sealed!", "Fight!",
  "Knockout!", "Challenger wins!" ya da "Defender wins!", gerekirse "Sealed victory!"). Ses, dövüş penceresindeki
  hoparlör düğmesiyle kapatılabilir ve tercih hatırlanır.

---

## 5. Dövüşün matematiği

### 5.1 Skor

Her taraf için, tamamen şifreli olarak:

```
skor = taş-kâğıt-makas puanı + içgüdü + şans
```

- **Taş-kâğıt-makas puanı:** Taktiğin rakibinkini yeniyorsa 2, yoksa 0. Aynı taktiklerde ikisi de 0 alır.
- **İçgüdü:** Kedinin seçtiği taktikteki içgüdüsü, 0–2.
- **Şans:** Her düello için yeni çekilen şifreli rastgele sayının bir biti (0 ya da 1). Challenger 0. biti, opponent
  1. biti kullanır.

Yüksek skor kazanır. Eşitlikte:

1. Yalnızca bir taraf **mühürlüyse** o kazanır.
2. İki taraf da mühürlüyse ya da ikisi de değilse şifreli yazı-tura (aynı rastgele sayının 2. biti) karar verir.

Geçersiz bir taktik değeri (0, 1, 2 dışında bir sayı) **Pounce** sayılır. Hile için kullanılamaz.

### 5.2 İçgüdüler

Her taktiğin içgüdüsü iki özellikten gelir. Kedinin o özellikteki seçeneği, seçenek listesinin **nadir yarısındaysa**
içgüdü 1 artar. İki özellik de nadir yarıdaysa içgüdü 2 olur. Arka plan ve kürk içgüdüye sayılmaz.

| Taktik | Özellikler | Sayılmaya başladığı seçenek (ve ötesi) | Kedilerin ne kadarında sayılır |
| --- | --- | --- | --- |
| **Pounce** | Pattern | **Spots**, Blaze, Bandit Mask, Tiger, Siamese, Calico, Heart Mark | %50,8 |
| | Eyes | **Sleepy**, Wink, Odd Eyes, Starry, Pixel Shades, Heart Eyes, 3D Glasses, Visor, Glow, Cipher Eyes, Laser Eyes | %53,1 |
| **Trick** | Mouth | **Fang**, Meow, Grin, Fish, Bubblegum, Lollipop, Mustache | %54,7 |
| | Headwear | **Bow**, Flower, Party Hat, Cowboy Hat, Propeller Cap, Devil Horns, Wizard Hat, Top Hat, Halo, Crown, Cipher Crown | %49,2 |
| **Guard** | Accessory | **Bandana**, Hoodie, Necktie, Spiked Collar, Pearls, Gold Chain, FHE Key, Cape | %48,4 |
| | Aura | Herhangi bir aura (**Sparkles**, Hearts, Cipher Rain, Backlight, Lightning, Encrypted Aura) | %39,8 |

Rastgele bir kedide içgüdülerin dağılımı:

| Taktik | İçgüdü 0 | İçgüdü 1 | İçgüdü 2 |
| --- | --- | --- | --- |
| Pounce | %23,1 | %50,0 | %27,0 |
| Trick | %23,0 | %50,1 | %26,9 |
| Guard | %31,0 | %49,7 | %19,3 |

Kendi içgüdülerini bilmenin tek yolu kediye **peek** yapmaktır. Site, peek yapmış sahibe **Show its instincts** ile
içgüdülerini yalnızca ona gösterir. Revealed bir kedinin DNA'sı açık olduğu için içgüdüleri de herkese açıktır. Ama
peek kediyi kalıcı olarak "Peeked" işaretler ve mühürlü olmanın getirdiği
4 puanı ve beraberlik üstünlüğünü kaybettirir. Bu oyunun bilerek konmuş ikilemidir: **kediyi tanımak mı, mühürlü
kalmak mı?**

### 5.3 Olasılıklar

Rastgele DNA'lı iki kedi için challenger'ın kazanma olasılığı:

| Challenger \ Opponent | İkisi de mühürlü ya da ikisi de değil | Yalnızca challenger mühürlü | Yalnızca opponent mühürlü |
| --- | --- | --- | --- |
| Pounce – Trick (avantajlı) | %93,8 | %98,4 | %89,1 |
| Trick – Guard (avantajlı) | %95,1 | %98,9 | %91,4 |
| Guard – Pounce (avantajlı) | %92,2 | %97,9 | %86,5 |
| Aynı taktik | %50,0 | ~%65,7 | ~%34,3 |
| Dezavantajlı taktik | %4,9–7,8 | %8,6–13,5 | %1,1–2,1 |

Bu tablodan çıkanlar:

- **Taktik belirleyicidir.** Doğru taktik ortalama %92–95 kazandırır. Oyunun kalbi, rakibin ne seçeceğini kimsenin
  bilmemesidir.
- **İçgüdü sürprizi mümkün kılar.** Yanlış taktiği seçen kedi, içgüdüsü 2 ve rakibininki 0 ise %50 kazanır. Bu kedi
  mühürlü, rakip mühürsüzse %75'e çıkar. Aynı taktikte içgüdüsü 1 farkla yüksek olan %87,5, 2 farkla yüksek olan her
  zaman kazanır.
- **Mühürlü kalmak ödüllendirilir.** Aynı taktikte mühürlü kutu %50 yerine yaklaşık %66 kazanır, galibiyeti de 4
  puan sayılır.

---

## 6. Haftalık tablo ve taç

- Hafta pazartesi 00:00 UTC'de başlar.
- Puanlar: galibiyet **3**, mühürlü galibiyet **4** (kazanan kutu kabul anında mühürlüyse), mağlubiyet **1**.
  Kaybedenin de puan alması oynamayı teşvik eder.
- **Haftanın lideri** en çok puanı olan kedidir. Eşitlikte o puana **önce ulaşan** liderliği korur. Geçmek için
  kesin olarak daha fazla puan gerekir.
- **Taç:** Hafta bittikten **1 gün sonra** (salı 00:00 UTC) o haftanın lideri **Weekly Crown** rozetini alır. Bunu herkes
  `crownWeek(hafta)` ile yapabilir (sitede **Crown last week's top cat**). Ayrıca her settle, gerekiyorsa geçen haftanın tacını kendiliğinden verir.
- O 1 günlük ara, hafta sonunda yapılıp henüz yazılmamış düelloların sayılabilmesi içindir.

---

## 7. Rozetler

Rozetler kalıcıdır ve kedide kalır.

| Rozet | Nasıl kazanılır |
| --- | --- |
| **First Blood** | İlk galibiyet. |
| **Won Blind** | Mühürlü bir kutuyla, yani hiç görülmemişken kazanmak. |
| **Hat-trick** | Üst üste 3 galibiyet. Seri haftalar arasında sürer, bir mağlubiyetle sıfırlanır. |
| **Sealed Legend** | Mühürlüyken toplam 5 galibiyet. |
| **Weekly Crown** | Bir haftanın birincisi olmak. |

---

## 8. Sicil

Her kedinin zincirde bir sicili vardır ve kediyle birlikte el değiştirir: galibiyetler, mağlubiyetler, mühürlü
galibiyetler, şu anki seri, en iyi seri, kanıtlanmış en yüksek kademe ve rozetler. Haftalık puanlar ayrıca hafta
hafta tutulur.

---

## 9. Kademe kanıtı (`claimTier` / `settleTier`)

Sahip, kedisinin bir kademeye ulaştığını DNA'yı açmadan kanıtlayabilir (sitede **Prove tier**).

- **Power** = DNA'nın 8 baytının toplamı (0–2040). Baytlar büyüdükçe seçenekler nadirleştiği için Power kabaca
  kedinin ne kadar nadir olduğunu ölçer.
- Arena şifreli olarak `Power ≥ eşik` karşılaştırmasını yapar ve **yalnızca evet/hayır cevabını** açar.
- Cevap **evet de olsa hayır da olsa** herkese açık olur. Başarısız bir deneme de görünür.
- Cevap `settleTier` ile zincire yazılır. Herkes yazabilir. Sicilde kanıtlanan en yüksek kademe tutulur, düşmez.
- Bunu yalnızca kedinin sahibi isteyebilir.

| Kademe | Eşik (Power) | Kedilerin ne kadarı |
| --- | --- | --- |
| Rare | ≥ 1200 | %19,9 |
| Epic | ≥ 1350 | %5,8 |
| Legendary | ≥ 1500 | %0,99 |
| Mythic | ≥ 1600 | %0,20 |

---

## 10. Gizlilik: kim neyi görür

| Bilgi | Kim görebilir |
| --- | --- |
| DNA ve özellikler | Kimse. Sahip peek yaparsa yalnızca o, open/reveal'den sonra herkes. |
| İçgüdüler, Power | Kimse, arena dahil. Peek yapmış sahip DNA'dan hesaplayabilir (site gösterir). Revealed kedide herkes. |
| Taktik | Dövüşten önce yalnızca kendi sahibi. Dövüşten sonra yalnızca iki oyuncu. |
| Skorlar, şans | Kimse. |
| Kazanan | Herkes. |
| Kutu durumu (mühürlü mü) | Herkes. |
| Kademe cevabı | Herkes, evet de olsa hayır da olsa. |
| Sicil, rozetler, puanlar | Herkes. |

---

## 11. Kenar durumlar

- **Açık meydan okuma varken kedi satılırsa:** Kabul `ChallengerMoved` ile reddedilir. Yeni sahip meydan okumayı geri
  çekebilir, ya da 3 günün dolmasını bekleyip yeni bir tane açabilir.
- **Kabul edilmiş ama sonucu yazılmamış düello:** Puan ve rozet settle'a kadar verilmez. Herkes settle edebilir.
  Puanlar yine dövüşün haftasına gider.
- **Taçtan sonra yazılan eski düello:** Puanlar o haftanın tablosuna eklenir, ama verilmiş taç değişmez.
- **Revealed kedi:** Kurallar aynıdır. Yalnızca mühürlü sayılmaz, sahnede kendisi olarak görünür.
- **Hafta sınırı:** "Bu hafta karşılaştı" kuralı kabul anının haftasına bakar. Pazar açılıp pazartesi kabul edilen
  düello pazartesinin haftasına sayılır.
- **Ücret:** Her adım bir işlemdir. Arbitrum Sepolia'da gerçek CoFHE ile ölçülen gas: arenaya giriş ≈85k, meydan okuma
  ≈1,0M, kabul ve dövüş ≈2,3M, settle ≈211k, kademe isteği ≈983k, kademe yazma ≈81k. 0,09 gwei'de bütün bir düello
  ≈0,0003 ETH tuttu. Ayrıca FHE ücreti yoktur.
- **CoFHE eşik ağı yavaşsa ya da kapalıysa:** Dövüş yapılmış olur ama sonuç yazılamaz. Ağ dönünce settle edilir, hiçbir
  şey kaybolmaz.

---

## 12. Bilinen açık kapılar

Bunlar sözleşmenin bugünkü haliyle bilinen sınırlardır. Her biri için etkisi ve olası çözümü yazıldı.

1. **Birden çok cüzdanla puan kasma.** `SameHolder` kuralı aynı cüzdanın kendiyle dövüşmesini engeller. Ama aynı kişi
   iki cüzdanla iki taktiği de seçip kazananı büyük olasılıkla belirleyebilir. Bir kedinin haftada kaç farklı rakiple
   dövüşebileceğine sınır yoktur, yalnızca aynı çift haftada bir kez karşılaşır.
   *Etkisi:* Puan ve rozetin parasal değeri yok, ama haftalık taç bu yolla alınabilir.
   *Olası çözüm:* Kedi başına haftalık sayılan düello sınırı (ör. ilk 5 düello), ya da taç için en az farklı rakip
   sayısı şartı.
2. **Sonuçlardan bilgi sızması.** Her düello herkese tek bir bit söyler: kimin kazandığı. Taktiği bilen iki oyuncu çok
   sayıda düelloyla rakibin içgüdüsü hakkında kaba bir fikir edinebilir, bu da "iki özellik nadir yarıda mı" kadar
   bilgidir. Haftada bir karşılaşma kuralı bunu yavaşlatır. Mühürlü bir kedinin mührü bozulmaz, DNA'sı açılmaz.
3. **Oyuncular birbirinin alışkanlıklarını öğrenir.** Her düellodan sonra iki taraf da rakibin taktiğini görür. Aynı
   rakiple tekrar tekrar oynayan biri onun hangi taktiği sevdiğini öğrenebilir. Bu bilerek bırakılmış bir oyun
   katmanıdır.
4. **Kademe denemeleri herkese açık.** Başarısız bir "Mythic" denemesi de görünür. Bu, sahibin kendi seçimidir.
5. **Taç bir günlük aradan sonra kesinleşir.** O bir gün içinde yazılan düellolar sıralamayı değiştirebilir. Sonra
   yazılanlar tabloya girer, tacı değiştirmez.
6. **Arena değişirse sicil taşınmaz.** Yeni bir arena sözleşmesi sıfırdan başlar. Kediler yeniden `enterArena` yapar.

---

## 13. Sözleşme özeti

| İşlev | Kim | Ne yapar |
| --- | --- | --- |
| `FheCat.enterArena(kedi)` | Sahip | Arenanın şifreli DNA üzerinde hesap yapmasına izin verir. |
| `challenge(kedi, rakip, taktik, kanıt)` | Sahip | Meydan okur (rakip 0 ise herkese açık). |
| `accept(düello, kedi, taktik, kanıt)` | Rakibin sahibi | Kabul eder, dövüş FHE ile hesaplanır. |
| `settle(düello, sonuç, imza)` | Herkes | Sonucu eşik ağının imzasıyla yazar, puan ve rozetleri verir. |
| `cancel(düello)` | Meydan okuyan kedinin sahibi | Kabul edilmemiş meydan okumayı geri çeker. |
| `crownWeek(hafta)` | Herkes | Biten haftanın tacını verir (bitişten 1 gün sonra). |
| `claimTier(kedi, kademe)` | Sahip | Kademe sorusunu FHE ile hesaplar, cevabı herkese açar. |
| `settleTier(istek, cevap, imza)` | Herkes | Kademe cevabını zincire yazar. |

| Sabit | Değer |
| --- | --- |
| Galibiyet / mühürlü galibiyet / mağlubiyet | 3 / 4 / 1 puan |
| Meydan okumanın açık kalma süresi | 3 gün |
| Hafta | Pazartesi 00:00 UTC'den pazartesiye |
| Taç için bekleme | Hafta bittikten 1 gün sonra |
| Sealed Legend için mühürlü galibiyet | 5 |
| Kademe eşikleri | Rare 1200, Epic 1350, Legendary 1500, Mythic 1600 |

Kaynaklar: `contracts/contracts/FheCatArena.sol`, `contracts/contracts/FheCat.sol`, kuralların TypeScript karşılığı
`art/src/arena.ts` ve sözleşme testleri.
