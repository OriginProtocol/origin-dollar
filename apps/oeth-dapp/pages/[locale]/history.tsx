import { ErrorBoundary, TransactionHistory } from '@originprotocol/ui';
import { getStaticPaths, makeStaticProps } from '../../lib/getStatic';
import { useTranslation } from 'next-i18next';

const History = () => {
  const { t } = useTranslation('wrap');
  return (
    <ErrorBoundary>
      <TransactionHistory i18n={t} />
    </ErrorBoundary>
  );
};

const getStaticProps = makeStaticProps(['common', 'history']);

export { getStaticPaths, getStaticProps };

export default History;
