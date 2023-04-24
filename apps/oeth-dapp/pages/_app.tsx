import seoConfig from '../src/seo';
import { DefaultSeo } from 'next-seo';
import '../src/styles/global.scss';

import { WagmiConfig, createClient, configureChains, mainnet } from "wagmi";
import { publicProvider } from "wagmi/providers/public";
import { SafeConnector } from "wagmi/connectors/safe";

import useAutoConnect from '../src/hooks/useAutoConnect';

const { provider, webSocketProvider } = configureChains(
  [mainnet],
  [publicProvider()]
);

const wagmiClient = createClient({
  autoConnect: false,
  provider,
  webSocketProvider,
  connectors: [
    new SafeConnector({
      chains: [],
      options: {
        allowedDomains: [/gnosis-safe.io$/, /app.safe.global$/]
      }
    })
  ]
});

function RootElement({ Component, pageProps, router }) {
  useAutoConnect()

  const url = `${seoConfig.baseURL}${router.route}`;
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
}

function CoreApp(props) {
  return (
    <WagmiConfig client={wagmiClient}>
      <RootElement {...props} />
    </WagmiConfig>
  );
}

export default CoreApp;
