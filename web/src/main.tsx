import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './config/wagmi';
import { App } from './App';
// The homepage's design system (fonts, colours, boxes, buttons, the night sky),
// the arena's fight scene (shared with the admin's Arena tab), then this site's own pieces.
import '../../landing/css/styles.css';
import '../../landing/css/fight.css';
import './styles.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
