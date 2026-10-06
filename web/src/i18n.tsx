import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const en = {
  nav: { mint: 'Mint', how: 'How it works', cats: 'My cats', arena: 'Arena', traits: 'Traits' },
  wallet: {
    connect: 'Connect wallet',
    devWallet: 'Dev wallet',
    browser: 'Browser wallet',
    noWallet: 'No browser wallet found. Install MetaMask or Rabby, or open this page in your wallet app.',
    disconnect: 'Disconnect',
    wrongNetwork: 'Wrong network',
    switchTo: (chain: string) => `Switch to ${chain}`,
  },
  hero: {
    kicker: 'An FHE collection on Fhenix',
    title: 'Pixel cats born encrypted.',
    body: 'Every FheCat is born in a sealed box. Its DNA comes from Fhenix FHE randomness and nobody can see it: not the team, not you, not a bot. Keep it sealed, peek in private or open it for everyone. Your call.',
    mint: 'Mint a cat',
    follow: 'Follow @FheCat',
  },
  mint: {
    title: 'Mint',
    soon: 'Launching soon on Fhenix. Follow @FheCat for the date.',
    minted: 'Minted',
    phase: 'Phase',
    phases: ['Closed', 'Allowlist', 'Public'],
    price: 'Price',
    free: 'Free',
    perWallet: (n: string) => `Max ${n} per wallet`,
    unlimited: 'No wallet limit',
    quantity: 'Quantity',
    button: (n: number) => `Mint ${n} ${n === 1 ? 'cat' : 'cats'}`,
    closed: 'Sale is closed',
    soldOut: 'Sold out',
    notListed: 'This wallet is not on the allowlist',
    limitReached: 'Wallet limit reached',
    confirm: 'Confirm in your wallet...',
    pending: 'Minting...',
    success: 'Minted! Your cats were born in sealed boxes. Find them below.',
    faucet: 'Need testnet ETH?',
    faucetLink: 'Get some from a faucet',
    network: 'Network',
    contract: 'Contract',
  },
  how: {
    title: 'How it works',
    steps: [
      {
        title: 'Mint blind',
        body: 'The contract asks the Fhenix coprocessor for an encrypted random 64-bit DNA. At birth only the contract may use the ciphertext: nobody can decrypt it, not even you.',
      },
      {
        title: 'Peek in private',
        body: 'Peek and the contract adds you to the ciphertext’s access list; with a free permit your cat is decrypted inside your browser. It is marked Peeked for good, so buyers know it may have been seen.',
      },
      {
        title: 'Open & reveal',
        body: 'Open the box and the DNA becomes publicly decryptable. The Fhenix threshold network decrypts and signs it, the contract checks the signature and your cat appears for everyone.',
      },
      {
        title: 'Or stay sealed',
        body: 'Nothing ever forces a reveal. A sealed cat can still fight blind duels in the arena, where only the winner is made public.',
      },
    ],
    sniping: 'No rarity sniping: traits cannot be known at mint time, not even by the contract owner.',
    badges: { private: 'private', onchain: 'on-chain', vs: 'vs' },
  },
  cats: {
    title: 'My cats',
    connect: 'Connect your wallet to see your cats.',
    empty: 'No cats yet. Mint one above!',
    states: ['Unopened', 'Peeked', 'Open', 'Revealed'],
    stateNotes: [
      'Nobody has ever seen this cat.',
      'A holder has peeked. Still sealed for everyone else.',
      'The box is open: anyone can finish the reveal.',
      '',
    ],
    seen: 'Only you can see this',
    peek: 'Peek',
    hide: 'Hide',
    open: 'Open the box',
    reveal: 'Reveal',
    peekWarn: 'Peeking marks this cat as Peeked for good, so later buyers know it may have been seen. Nobody else will see it.',
    openWarn: 'Opening makes this cat’s DNA public and shows it to everyone. It cannot be undone.',
    confirmPeek: 'Peek in private',
    confirmOpen: 'Open for everyone',
    cancel: 'Cancel',
    peekNote: 'Decrypted in your browser. Nothing was published.',
    signing: 'Sign the decryption permit...',
    decrypting: 'Decrypting with Fhenix...',
    confirm: 'Confirm the transaction...',
    mining: 'Waiting for the transaction...',
    view: 'Explorer',
    save: 'Save SVG',
  },
  arena: {
    title: 'Arena',
    body: 'Cats fight blind. A cat’s Power is the sum of its eight DNA bytes, worked out under FHE and never decrypted; rarer traits mean more power. A duel only makes the winner public, a tier proof only a yes or a no. The cats stay sealed.',
    yours: 'Your cats',
    noCats: 'Mint a cat to play.',
    enter: 'Enter arena',
    record: (w: number, l: number) => `${w}W · ${l}L`,
    tiers: ['', 'Rare', 'Epic', 'Legendary', 'Mythic'],
    tierInfo: ['', 'Power ≥ 1200, about 1 in 5', 'Power ≥ 1350, about 1 in 17', 'Power ≥ 1500, about 1 in 100', 'Power ≥ 1600, about 1 in 500'],
    challenge: 'Challenge',
    opponent: 'Opponent # (empty: anyone)',
    send: 'Send',
    prove: 'Prove tier',
    proveWarn: 'The answer becomes public either way.',
    open: 'Open challenges',
    noOpen: 'No open challenges.',
    vsAnyone: (a: string) => `#${a} vs anyone`,
    vs: (a: string, b: string) => `#${a} vs #${b}`,
    acceptWith: 'Accept with',
    accept: 'Accept',
    withdraw: 'Withdraw',
    pending: 'Waiting for a result',
    settle: 'Settle',
    results: 'Results',
    beat: (w: string, l: string) => `#${w} beat #${l}`,
    proven: (id: string, tier: string) => `#${id} is ${tier}`,
    notProven: (id: string, tier: string) => `#${id} is not ${tier}`,
    working: 'Working...',
  },
  latest: { title: 'Latest cats', empty: 'The first cats will appear here.' },
  traits: {
    title: 'Traits & rarity',
    body: 'Rarity weights are public and fixed in the contract; which traits a cat gets stays sealed until its box is opened.',
    count: (traits: number, options: number) => `${traits} traits · ${options} options`,
    labels: ['Background', 'Fur', 'Pattern', 'Eyes', 'Mouth', 'Headwear', 'Accessory', 'Aura'],
  },
  errors: {
    rejected: 'Request rejected in the wallet.',
    generic: 'Something went wrong',
  },
  footer: {
    note: 'A testnet collection on Fhenix CoFHE. Testnet tokens have no monetary value.',
    art: 'Art and metadata are generated fully on-chain.',
  },
};

type Dict = typeof en;

const tr: Dict = {
  nav: { mint: 'Mint', how: 'Nasıl çalışır', cats: 'Kedilerim', arena: 'Arena', traits: 'Özellikler' },
  wallet: {
    connect: 'Cüzdan bağla',
    devWallet: 'Geliştirici cüzdanı',
    browser: 'Tarayıcı cüzdanı',
    noWallet: 'Tarayıcı cüzdanı bulunamadı. MetaMask veya Rabby kur ya da bu sayfayı cüzdan uygulamanın tarayıcısında aç.',
    disconnect: 'Bağlantıyı kes',
    wrongNetwork: 'Yanlış ağ',
    switchTo: (chain: string) => `${chain} ağına geç`,
  },
  hero: {
    kicker: 'Fhenix üzerinde bir FHE koleksiyonu',
    title: 'Şifreli doğan piksel kediler.',
    body: 'Her FheCat kapalı bir kutuda doğar. DNA’sı Fhenix’in FHE rastgeleliğinden gelir ve kimse göremez: ne ekip, ne sen, ne de botlar. Kapalı tut, gizlice bak ya da herkese aç. Karar senin.',
    mint: 'Kedi mintle',
    follow: '@FheCat’i takip et',
  },
  mint: {
    title: 'Mint',
    soon: 'Çok yakında Fhenix’te. Tarih için @FheCat’i takip et.',
    minted: 'Mintlenen',
    phase: 'Aşama',
    phases: ['Kapalı', 'Allowlist', 'Herkese açık'],
    price: 'Fiyat',
    free: 'Ücretsiz',
    perWallet: (n: string) => `Cüzdan başına en fazla ${n}`,
    unlimited: 'Cüzdan limiti yok',
    quantity: 'Adet',
    button: (n: number) => `${n} kedi mintle`,
    closed: 'Satış kapalı',
    soldOut: 'Tükendi',
    notListed: 'Bu cüzdan allowlist’te değil',
    limitReached: 'Cüzdan limitine ulaştın',
    confirm: 'Cüzdanında onayla...',
    pending: 'Mintleniyor...',
    success: 'Mintlendi! Kedilerin kapalı kutularda doğdu. Aşağıda seni bekliyorlar.',
    faucet: 'Test ağı ETH’si mi lazım?',
    faucetLink: 'Faucet’ten al',
    network: 'Ağ',
    contract: 'Kontrat',
  },
  how: {
    title: 'Nasıl çalışır',
    steps: [
      {
        title: 'Kör mint',
        body: 'Kontrat, Fhenix yardımcı işlemcisinden şifreli, rastgele 64 bitlik bir DNA ister. Doğduğunda şifreli veriyi yalnızca kontrat kullanabilir: kimse çözemez, sen bile.',
      },
      {
        title: 'Gizlice bak',
        body: 'Bakınca kontrat seni şifreli verinin erişim listesine ekler; ücretsiz bir izinle kedin tarayıcının içinde çözülür. Kedi kalıcı olarak "Bakıldı" işaretlenir, böylece alıcılar görülmüş olabileceğini bilir.',
      },
      {
        title: 'Aç ve reveal et',
        body: 'Kutuyu açınca DNA herkesçe çözülebilir olur. Fhenix eşik ağı (threshold network) DNA’yı çözüp imzalar, kontrat imzayı doğrular ve kedin herkes için görünür.',
      },
      {
        title: 'Ya da kapalı kalsın',
        body: 'Hiçbir şey reveal’ı zorlamaz. Kapalı bir kedi arenada kör düellolara da girebilir; orada yalnızca kazanan açıklanır.',
      },
    ],
    sniping: 'Nadirlik avcılığı yok: özellikler mint anında bilinemez, kontrat sahibi tarafından bile.',
    badges: { private: 'gizli', onchain: 'zincirde', vs: 'vs' },
  },
  cats: {
    title: 'Kedilerim',
    connect: 'Kedilerini görmek için cüzdanını bağla.',
    empty: 'Henüz kedin yok. Yukarıdan bir tane mintle!',
    states: ['Kapalı', 'Bakıldı', 'Açık', 'Reveal edildi'],
    stateNotes: [
      'Bu kediyi kimse görmedi.',
      'Bir sahibi baktı. Başka herkes için hâlâ kapalı.',
      'Kutu açık: reveal’ı herkes tamamlayabilir.',
      '',
    ],
    seen: 'Bunu yalnızca sen görüyorsun',
    peek: 'Gizlice bak',
    hide: 'Gizle',
    open: 'Kutuyu aç',
    reveal: 'Reveal et',
    peekWarn: 'Bakmak bu kediyi kalıcı olarak "Bakıldı" işaretler; sonraki alıcılar görülmüş olabileceğini bilir. Başka kimse görmez.',
    openWarn: 'Kutuyu açmak bu kedinin DNA’sını herkese açar ve kediyi herkese gösterir. Geri alınamaz.',
    confirmPeek: 'Gizlice bak',
    confirmOpen: 'Herkese aç',
    cancel: 'Vazgeç',
    peekNote: 'Tarayıcında çözüldü. Hiçbir şey yayınlanmadı.',
    signing: 'Çözme iznini imzala...',
    decrypting: 'Fhenix ile çözülüyor...',
    confirm: 'İşlemi onayla...',
    mining: 'İşlem bekleniyor...',
    view: 'Explorer',
    save: 'SVG indir',
  },
  arena: {
    title: 'Arena',
    body: 'Kediler kör dövüşür. Bir kedinin Gücü, DNA’sının 8 baytının toplamıdır; FHE ile hesaplanır ve hiç çözülmez. Nadir özellik, daha çok güç demektir. Düello yalnızca kazananı, kademe kanıtı yalnızca evet ya da hayır cevabını açıklar. Kediler kapalı kalır.',
    yours: 'Kedilerin',
    noCats: 'Oynamak için bir kedi mintle.',
    enter: 'Arenaya gir',
    record: (w: number, l: number) => `${w}G · ${l}M`,
    tiers: ['', 'Rare', 'Epic', 'Legendary', 'Mythic'],
    tierInfo: ['', 'Güç ≥ 1200, yaklaşık 5’te 1', 'Güç ≥ 1350, yaklaşık 17’de 1', 'Güç ≥ 1500, yaklaşık 100’de 1', 'Güç ≥ 1600, yaklaşık 500’de 1'],
    challenge: 'Meydan oku',
    opponent: 'Rakip # (boş: herkes)',
    send: 'Gönder',
    prove: 'Kademe kanıtla',
    proveWarn: 'Cevap, evet de olsa hayır da olsa herkese açık olur.',
    open: 'Açık meydan okumalar',
    noOpen: 'Açık meydan okuma yok.',
    vsAnyone: (a: string) => `#${a} vs herkes`,
    vs: (a: string, b: string) => `#${a} vs #${b}`,
    acceptWith: 'Şu kediyle kabul et',
    accept: 'Kabul et',
    withdraw: 'Geri çek',
    pending: 'Sonuç bekleyenler',
    settle: 'Sonucu yaz',
    results: 'Sonuçlar',
    beat: (w: string, l: string) => `Kazanan #${w}, kaybeden #${l}`,
    proven: (id: string, tier: string) => `#${id}: ${tier} ✓`,
    notProven: (id: string, tier: string) => `#${id}: ${tier} değil`,
    working: 'İşleniyor...',
  },
  latest: { title: 'Son kediler', empty: 'İlk kediler burada görünecek.' },
  traits: {
    title: 'Özellikler ve nadirlik',
    body: 'Nadirlik ağırlıkları herkese açık ve kontratta sabit; bir kedinin hangi özellikleri aldığı ise kutusu açılana kadar gizli kalır.',
    count: (traits: number, options: number) => `${traits} özellik · ${options} seçenek`,
    labels: ['Arka plan', 'Kürk', 'Desen', 'Gözler', 'Ağız', 'Başlık', 'Aksesuar', 'Aura'],
  },
  errors: {
    rejected: 'İstek cüzdanda reddedildi.',
    generic: 'Bir şeyler ters gitti',
  },
  footer: {
    note: 'Fhenix CoFHE üzerinde bir test ağı koleksiyonu. Test ağı tokenlerinin parasal değeri yoktur.',
    art: 'Görseller ve metadata tamamen zincir üzerinde üretilir.',
  },
};

export type Lang = 'en' | 'tr';
const DICTS: Record<Lang, Dict> = { en, tr };

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('fhecat.lang');
    if (saved === 'en' || saved === 'tr') return saved;
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

const I18nContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Dict }>({
  lang: 'en',
  setLang: () => {},
  t: en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('fhecat.lang', lang);
    } catch {
      /* storage unavailable */
    }
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t: DICTS[lang] }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
