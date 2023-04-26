import { DappLayout, SEO, DappContainer } from '@originprotocol/ui';
import { useAccount, useAutoConnect } from '@originprotocol/hooks';
import { contracts } from '@originprotocol/web3';
import { appWithTranslation, useTranslation } from 'next-i18next';
import pick from 'lodash/pick';
import nextI18NextConfig from '../next-i18next.config';
import '../src/styles/global.scss';

const App = ({ Component, pageProps, router }) => {
  const { t } = useTranslation('common');
  const { address } = useAccount();

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
        tokens: pick(contracts?.mainnet, ['stETH', 'rETH', 'sfrxETH']),
      }}
      stats={{
        queryFn: (props) => {
          console.log('props', props);
          return fetch('/api/stats/apy').then((res) => res.json());
        },
      }}
      portfolio={{
        logoSrc: '/images/oeth-logo-256x256.png',
        queryFn: (props) => {
          console.log('props', props);
          return fetch(`/api/portfolio/${address}`).then((res) => res.json());
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
