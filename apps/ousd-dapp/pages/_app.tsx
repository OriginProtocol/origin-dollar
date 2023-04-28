import { DappLayout, SEO, DappContainer } from '@originprotocol/ui';
import { useAccount, useAutoConnect } from '@originprotocol/hooks';
import { contracts } from '@originprotocol/web3';
import { appWithTranslation, useTranslation } from 'next-i18next';
import pick from 'lodash/pick';
import nextI18NextConfig from '../next-i18next.config';
import '../src/styles/global.scss';
import { DAPP_TOKENS } from '../src/constants';

const App = ({ Component, pageProps, router }) => {
  const { t } = useTranslation('common');
  const { address } = useAccount();
  const isWrap = router?.state?.route.includes('/wrap');

  useAutoConnect();

  return (
    <DappLayout
      i18n={t}
      config={{
        ipfsUrl: 'https://ousd.eth.limo/',
        logoSrc: '/images/logo.png',
        links: [
          {
            href: '/',
            label: t('nav.swap'),
          },
          {
            href: '/wrap',
            label: t('nav.wrap'),
          },
          {
            href: '/history',
            label: t('nav.history'),
          },
        ],
        tokens: pick(contracts?.mainnet, DAPP_TOKENS),
      }}
      stats={{
        queryFn: () => fetch('/api/stats/apy').then((res) => res.json()),
      }}
      portfolio={{
        token: isWrap ? contracts.mainnet.woETH : contracts.mainnet.OETH,
        queryFn: ({ queryKey }) => {
          const [, tokenAddress] = queryKey;
          return fetch(
            `/api/portfolio/${address}?token=${
              tokenAddress || contracts.mainnet.OETH.address
            }`
          ).then((res) => res.json());
        },
      }}
    >
      <SEO appId="oeth" route={router.route} />
      <Component {...pageProps} />
    </DappLayout>
  );
};

const OETHDapp = (props) => (
  <DappContainer>
    <App {...props} />
  </DappContainer>
);

export default appWithTranslation(OETHDapp, nextI18NextConfig);
