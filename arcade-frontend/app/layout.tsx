import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import WalletProvider from '../components/WalletProvider';
import { theme } from '../theme';

import '@mantine/core/styles.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider theme={theme}>
          <WalletProvider>{children}</WalletProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
