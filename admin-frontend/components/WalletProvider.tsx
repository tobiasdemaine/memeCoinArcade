'use client';

import { FC, ReactNode } from 'react';
import { Adapter, SolanaAdapter } from '@reown/appkit-adapter-solana';
import { solanaDevnet } from '@reown/appkit/networks';
import { createAppKit } from '@reown/appkit/react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { clusterApiUrl } from '@solana/web3.js';
import { Provider } from 'react-redux';
import { store } from '../store/index';

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const network = clusterApiUrl('devnet');
  const wallets: Adapter[] = []; // Reown AppKit handles wallet selection

  const projectId =
    process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_WALLET_CONNECT_PROJECT_ID';
  const metadata = {
    name: 'Solana Web3 Base Project',
    description: 'Solana Web 3 base Project',
    url: 'https://your-app-url.com',
    icons: ['https://your-app-url.com/icon.png'],
  };

  const solanaAdapter = new SolanaAdapter();

  createAppKit({
    projectId,
    metadata,
    networks: [solanaDevnet],
    adapters: [solanaAdapter],
  });

  return (
    <ConnectionProvider endpoint={network}>
      <WalletProvider wallets={wallets} autoConnect>
        <Provider store={store}>{children}</Provider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletContextProvider;
