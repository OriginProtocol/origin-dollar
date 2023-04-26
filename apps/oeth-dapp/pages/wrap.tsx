import { ErrorBoundary, WrapToken } from '@originprotocol/ui';
import i18n from '../src/i18n';
import { useTranslation } from 'next-i18next';

const assets = {
  woETH: {
    symbol: 'woETH',
    label: 'Wrapped OETH',
    imageSrc: '/logos/lido.png',
  },
  OETH: {
    symbol: 'oETH',
    label: 'Origin ETH',
    imageSrc: '/logos/oeth.png',
  },
};

const Wrap = () => {
  const { t } = useTranslation('wrap');
  return (
    <ErrorBoundary>
      <WrapToken
        i18n={t}
        assets={assets}
        emptyState={{
          description: t('description'),
          cta: t('learnMore'),
          externalHref: 'https://www.oeth.com',
        }}
      />
    </ErrorBoundary>
  );
};

export const getServerSideProps = async ({ locale }) => {
  return {
    props: {
      ...(await i18n(locale ?? 'en')),
    },
  };
};

export default Wrap;
