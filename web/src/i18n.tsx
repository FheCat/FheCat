import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const en = {
  nav: { mint: 'Mint', how: 'How it works', cats: 'My cats', traits: 'Traits' },
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
    body: 'Every FheCat gets its DNA from Fhenix FHE randomness at mint. Nobody (not the team, not you, not a bot) knows its traits until it is revealed. Only its holder can peek.',
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
    success: 'Minted! Your cats were born encrypted. Peek at them below.',
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
        body: 'The contract asks the Fhenix coprocessor for an encrypted random 64-bit DNA. On-chain it only ever exists as a ciphertext.',
      },
      {
        title: 'Peek privately',
        body: 'Sign a free permit and your cat is decrypted inside your browser. The ciphertext’s access list names only its holder.',
      },
      {
        title: 'Reveal on-chain',
        body: 'When you are ready, the Fhenix threshold network decrypts the DNA and signs the result. The contract checks the signature and your cat appears for everyone.',
      },
      {
        title: 'Grand reveal',
        body: 'After the grand reveal date anyone can unveil the cats that are still hidden, so the whole collection ends up on-chain.',
      },
    ],
    sniping: 'No rarity sniping: traits cannot be known at mint time, not even by the contract owner.',
    badges: { private: 'private', onchain: 'on-chain' },
  },
  cats: {
    title: 'My cats',
    connect: 'Connect your wallet to see your cats.',
    empty: 'No cats yet. Mint one above!',
    encrypted: 'Encrypted',
    peeked: 'Only you can see this',
    revealed: 'Revealed',
    publicOn: 'Anyone can reveal',
    peek: 'Peek',
    hide: 'Hide',
    reveal: 'Reveal',
    peekNote: 'Decrypted in your browser. Nothing was published.',
    signing: 'Sign the decryption permit...',
    decrypting: 'Decrypting with Fhenix...',
    confirm: 'Confirm the transaction...',
    revealing: 'Revealing on-chain...',
    fallback: 'Your permit could not be used, so decryption is opened to everyone first (one extra transaction).',
    grand: (when: string) => `Grand reveal: ${when}`,
    grandOpen: 'The grand reveal has started. Any cat can now be revealed by anyone.',
    view: 'Explorer',
    save: 'Save SVG',
  },
  latest: { title: 'Latest cats', empty: 'The first cats will appear here.' },
  traits: {
    title: 'Traits & rarity',
    body: 'Rarity weights are public and fixed in the contract; which traits a cat gets stays encrypted until it is revealed.',
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
  nav: { mint: 'Mint', how: 'Nasıl çalışır', cats: 'Kedilerim', traits: 'Özellikler' },
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
    body: 'Her FheCat, mint anında DNA’sını Fhenix’in FHE rastgeleliğinden alır. Reveal edilene kadar özelliklerini kimse bilemez: ne ekip, ne sen, ne de botlar. Yalnızca sahibi gizlice bakabilir.',
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
    success: 'Mintlendi! Kedilerin şifreli doğdu. Aşağıdan gizlice bakabilirsin.',
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
        body: 'Kontrat, Fhenix yardımcı işlemcisinden şifreli, rastgele 64 bitlik bir DNA ister. Bu DNA zincirde yalnızca şifreli (ciphertext) olarak bulunur.',
      },
      {
        title: 'Gizlice bak',
        body: 'Ücretsiz bir izin imzala, kedin tarayıcının içinde çözülsün. Şifreli verinin erişim listesinde yalnızca sahibi vardır.',
      },
      {
        title: 'Zincirde reveal et',
        body: 'Hazır olduğunda Fhenix eşik ağı (threshold network) DNA’yı çözer ve sonucu imzalar. Kontrat imzayı doğrular ve kedin herkes için görünür olur.',
      },
      {
        title: 'Büyük reveal',
        body: 'Büyük reveal tarihinden sonra hâlâ gizli olan kedileri herkes açabilir; böylece koleksiyonun tamamı zincirde görünür olur.',
      },
    ],
    sniping: 'Nadirlik avcılığı yok: özellikler mint anında bilinemez, kontrat sahibi tarafından bile.',
    badges: { private: 'gizli', onchain: 'zincirde' },
  },
  cats: {
    title: 'Kedilerim',
    connect: 'Kedilerini görmek için cüzdanını bağla.',
    empty: 'Henüz kedin yok. Yukarıdan bir tane mintle!',
    encrypted: 'Şifreli',
    peeked: 'Bunu yalnızca sen görüyorsun',
    revealed: 'Reveal edildi',
    publicOn: 'Herkes reveal edebilir',
    peek: 'Gizlice bak',
    hide: 'Gizle',
    reveal: 'Reveal et',
    peekNote: 'Tarayıcında çözüldü. Hiçbir şey yayınlanmadı.',
    signing: 'Çözme iznini imzala...',
    decrypting: 'Fhenix ile çözülüyor...',
    confirm: 'İşlemi onayla...',
    revealing: 'Zincirde reveal ediliyor...',
    fallback: 'İznin kullanılamadı; önce çözme herkese açılıyor (bir ek işlem).',
    grand: (when: string) => `Büyük reveal: ${when}`,
    grandOpen: 'Büyük reveal başladı. Artık her kediyi herkes reveal edebilir.',
    view: 'Explorer',
    save: 'SVG indir',
  },
  latest: { title: 'Son kediler', empty: 'İlk kediler burada görünecek.' },
  traits: {
    title: 'Özellikler ve nadirlik',
    body: 'Nadirlik ağırlıkları herkese açık ve kontratta sabit; bir kedinin hangi özellikleri aldığı ise reveal edilene kadar şifreli kalır.',
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
