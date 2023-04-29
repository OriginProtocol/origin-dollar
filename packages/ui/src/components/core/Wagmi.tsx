import { WagmiConfig, createClient, configureChains } from 'wagmi';
import {
  EthereumClient,
  w3mConnectors,
  w3mProvider,
} from '@web3modal/ethereum';
import { Web3Modal } from '@web3modal/react';
import { mainnet, localhost } from 'wagmi/chains';
import { SafeConnector } from 'wagmi/connectors/safe';
import { ReactNode } from 'react';

const chains = [mainnet, localhost];

const useWagmiClient = () => {
  const projectId = process.env['NEXT_PUBLIC_WC_PROJECT_ID'] || '';

  const { provider } = configureChains(chains, [w3mProvider({ projectId })]);

  const wagmiClient = createClient({
    autoConnect: true,
    connectors: [
      ...w3mConnectors({ projectId, version: 1, chains }),
      new SafeConnector({
        options: {
          allowedDomains: [/gnosis-safe.io$/, /app.safe.global$/],
        },
      }),
    ],
    provider,
  });

  const ethereumClient = new EthereumClient(wagmiClient, chains);

  return {
    projectId,
    wagmiClient,
    ethereumClient,
  };
};

const Wagmi = ({ children }: { children: ReactNode }) => {
  const { projectId, wagmiClient, ethereumClient } = useWagmiClient();
  return (
    <>
      <WagmiConfig client={wagmiClient}>{children}</WagmiConfig>
      <Web3Modal projectId={projectId} ethereumClient={ethereumClient} />
    </>
  );
};

export default Wagmi;
