import { useEffect, useRef, useState } from 'react';
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from 'wagmi';
import { DEFAULT_CHAIN, chainInfo } from '../config/chains';
import { useViewChain } from '../lib/hooks';
import { shortAddress } from '../lib/format';

/** `sm` in the top bar, `wide` inside a panel. */
export function ConnectButton({ size }: { size?: 'sm' | 'wide' }) {
  const { address, isConnected, chainId } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const { walletOnWrongChain } = useViewChain();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = size ? `btn-${size}` : '';
  const wrap = `wallet ${size === 'wide' ? 'wallet-wide' : ''}`;

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
        <button
          className={`btn btn-warn ${btn}`}
          title={`Switch to ${DEFAULT_CHAIN.name}`}
          onClick={() => switchChain.mutate({ chainId: DEFAULT_CHAIN.id })}
        >
          {/* The top bar has no room for a chain name. */}
          <span>{size === 'sm' ? 'Switch network' : `Switch to ${DEFAULT_CHAIN.name}`}</span>
        </button>
      );
    }
    return (
      <div className={wrap} ref={root}>
        <button className={`btn btn-ghost ${btn}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <i className="blink-dot" aria-hidden="true" />
          <span className="mono">{shortAddress(address)}</span>
        </button>
        {open && (
          <div className="menu box">
            <p className="menu-note">{chainInfo(chainId)?.chain.name}</p>
            <button
              className="menu-item"
              onClick={() => {
                disconnect.mutate();
                setOpen(false);
              }}
            >
              Disconnect
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
    <div className={wrap} ref={root}>
      <button className={`btn ${btn}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>Connect wallet</span>
      </button>
      {open && (
        <div className="menu box">
          {choices.map((c) => (
            <button
              key={c.uid}
              className="menu-item"
              disabled={connect.isPending}
              onClick={() => connect.mutate({ connector: c }, { onSuccess: () => setOpen(false) })}
            >
              {c.icon && <img src={c.icon} alt="" width={24} height={24} />}
              {c.type === 'mock' ? 'Dev wallet' : c.id === 'injected' ? 'Browser wallet' : c.name}
            </button>
          ))}
          {!hasBrowserWallet && discovered.length === 0 && (
            <p className="menu-note">No browser wallet found. Install MetaMask or Rabby, or open this page in your wallet app.</p>
          )}
          {connect.error && <p className="menu-note error">{connect.error.message.split('\n')[0]}</p>}
        </div>
      )}
    </div>
  );
}
