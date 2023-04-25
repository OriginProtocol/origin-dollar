import seoConfig from '../src/seo';
import { DefaultSeo } from 'next-seo';
import { WagmiConfig, createClient, configureChains } from 'wagmi';
import {
  EthereumClient,
  w3mConnectors,
  w3mProvider,
} from '@web3modal/ethereum';
import { Web3Modal } from '@web3modal/react';
import { mainnet } from 'wagmi/chains';
import { SafeConnector } from 'wagmi/connectors/safe';
import { QueryClient, QueryClientProvider } from 'react-query';
import useAutoConnect from '../src/hooks/useAutoConnect';
import '../src/styles/global.scss';

const defaultQueryFn = async (url) => fetch(url).then((res) => res.json());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
    },
  },
});

const chains = [mainnet];

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

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

const RootElement = ({ Component, pageProps, router }) => {
  const url = `${seoConfig.baseURL}${router.route}`;
  useAutoConnect();
  return (
    <>
      <DefaultSeo
        defaultTitle={seoConfig.defaultTitle}
        titleTemplate={`%s | ${seoConfig.defaultTitle}`}
        description={seoConfig.description}
        openGraph={seoConfig.openGraph({ url })}
        twitter={seoConfig.twitter}
      />
      <Component {...pageProps} />
    </>
  );
};

const CoreApp = (props) => (
  <QueryClientProvider client={queryClient}>
    <WagmiConfig client={wagmiClient}>
      <RootElement {...props} />
    </WagmiConfig>
    <Web3Modal projectId={projectId} ethereumClient={ethereumClient} />
  </QueryClientProvider>
);

export default CoreApp;
