import seoConfig from '../src/seo';
import { DefaultSeo } from 'next-seo';
import { WagmiConfig, createClient, configureChains, mainnet } from 'wagmi';
import { QueryClient, QueryClientProvider } from 'react-query';
import { publicProvider } from 'wagmi/providers/public';
import '../src/styles/global.scss';

const defaultQueryFn = async (url) => fetch(url).then((res) => res.json());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
    },
  },
});

const { provider, webSocketProvider } = configureChains(
  [mainnet],
  [publicProvider()]
);

const wagmiClient = createClient({
  autoConnect: false,
  provider,
  webSocketProvider,
});

function MyApp({ Component, pageProps, router }) {
  const url = `${seoConfig.baseURL}${router.route}`;
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig client={wagmiClient}>
        <DefaultSeo
          defaultTitle={seoConfig.defaultTitle}
          titleTemplate={`%s | ${seoConfig.defaultTitle}`}
          description={seoConfig.description}
          openGraph={seoConfig.openGraph({ url })}
          twitter={seoConfig.twitter}
        />
        <Component {...pageProps} />
      </WagmiConfig>
    </QueryClientProvider>
  );
}

export default MyApp;
