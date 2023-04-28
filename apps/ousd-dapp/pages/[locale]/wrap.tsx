import { ErrorBoundary, WrapToken } from '@originprotocol/ui';
import { useTranslation } from 'next-i18next';
import { contracts } from '@originprotocol/web3';
import { getStaticPaths, makeStaticProps } from '../../lib/getStatic';

const Wrap = () => {
  const { t } = useTranslation('wrap');
  return (
    <ErrorBoundary>
      <WrapToken
        i18n={t}
        unwrappedToken={contracts.mainnet.OUSD}
        wrappedToken={contracts.mainnet.WOUSD}
        emptyState={{
          description: t('description'),
          cta: t('learnMore'),
          externalHref: 'https://www.ousd.com',
        }}
      />
    </ErrorBoundary>
  );
};

const getStaticProps = makeStaticProps(['common', 'wrap']);

export { getStaticPaths, getStaticProps };

export default Wrap;
