import { useEffect, useRef, useState } from 'react';
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from 'wagmi';
import { useI18n } from '../i18n';
import { DEFAULT_CHAIN, chainInfo } from '../config/chains';
import { useViewChain } from '../lib/hooks';
import { shortAddress } from '../lib/format';

export function ConnectButton() {
  const { t } = useI18n();
  const { address, isConnected, chainId } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const { walletOnWrongChain } = useViewChain();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  if (isConnected && address) {
    if (walletOnWrongChain) {
      return (
        <button className="btn btn-warn" onClick={() => switchChain.mutate({ chainId: DEFAULT_CHAIN.id })}>
          {t.wallet.switchTo(DEFAULT_CHAIN.name)}
        </button>
      );
    }
    return (
      <div className="wallet" ref={root}>
        <button className="btn btn-ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="dot" /> {shortAddress(address)}
        </button>
        {open && (
          <div className="menu" role="menu">
            <div className="menu-note">{chainInfo(chainId)?.chain.name}</div>
            <button
              className="menu-item"
              onClick={() => {
                disconnect.mutate();
                setOpen(false);
              }}
            >
              {t.wallet.disconnect}
            </button>
          </div>
        )}
      </div>
    );
  }

  // The generic `injected` connector is redundant once EIP-6963 has found real wallets.
  const discovered = connectors.filter((c) => c.type === 'injected' && c.id !== 'injected');
  const choices = discovered.length ? [...discovered, ...connectors.filter((c) => c.type === 'mock')] : connectors;
  const hasBrowserWallet = typeof window !== 'undefined' && 'ethereum' in window;

  return (
    <div className="wallet" ref={root}>
      <button className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {t.wallet.connect}
      </button>
      {open && (
        <div className="menu" role="menu">
          {choices.map((c) => (
            <button
              key={c.uid}
              className="menu-item"
              disabled={connect.isPending}
              onClick={() => connect.mutate({ connector: c }, { onSuccess: () => setOpen(false) })}
            >
              {c.icon && <img src={c.icon} alt="" width={18} height={18} />}
              {c.type === 'mock' ? t.wallet.devWallet : c.id === 'injected' ? t.wallet.browser : c.name}
            </button>
          ))}
          {!hasBrowserWallet && discovered.length === 0 && <div className="menu-note">{t.wallet.noWallet}</div>}
          {connect.error && <div className="menu-note error">{connect.error.message.split('\n')[0]}</div>}
        </div>
      )}
    </div>
  );
}
