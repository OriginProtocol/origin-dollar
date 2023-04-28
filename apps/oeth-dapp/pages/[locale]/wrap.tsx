import { ErrorBoundary, WrapToken } from '@originprotocol/ui';
import { useTranslation } from 'next-i18next';
import pick from 'lodash/pick';
import { contracts } from '@originprotocol/web3';
import { getStaticPaths, makeStaticProps } from '../../lib/getStatic';

const Wrap = () => {
  const { t } = useTranslation('wrap');
  return (
    <ErrorBoundary>
      <WrapToken
        i18n={t}
        tokens={pick(contracts.mainnet, ['OETH', 'woETH'])}
        emptyState={{
          description: t('description'),
          cta: t('learnMore'),
          externalHref: 'https://www.oeth.com',
        }}
      />
    </ErrorBoundary>
  );
};

const getStaticProps = makeStaticProps(['common', 'wrap']);

export { getStaticPaths, getStaticProps };

export default Wrap;
