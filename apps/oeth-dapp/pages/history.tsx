import { ErrorBoundary, TransactionHistory } from '@originprotocol/ui';
import i18n from '../src/i18n';

const History = () => {
  return (
    <ErrorBoundary>
      <TransactionHistory />
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

export default History;
