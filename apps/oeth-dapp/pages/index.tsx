import { ErrorBoundary, TokenSwap } from '@originprotocol/ui';
import { contracts } from '@originprotocol/web3';
import { useTranslation } from 'next-i18next';
import pick from 'lodash/pick';
import i18n from '../src/i18n';

const Swap = () => {
  const { t } = useTranslation('swap');
  return (
    <ErrorBoundary>
      <TokenSwap
        i18n={t}
        tokens={pick(contracts?.mainnet, ['wETH', 'stETH', 'rETH', 'sfrxETH'])}
      />
    </ErrorBoundary>
  );
};

export const getStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await i18n(locale ?? 'en')),
    },
  };
};

export default Swap;
