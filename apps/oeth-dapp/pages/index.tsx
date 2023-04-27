import { ErrorBoundary, VaultSwap } from '@originprotocol/ui';
import { contracts } from '@originprotocol/web3';
import { useTranslation } from 'next-i18next';
import pick from 'lodash/pick';
import i18n from '../src/i18n';
import { DAPP_TOKENS } from '../src/constants';

const Swap = () => {
  const { t } = useTranslation('swap');
  return (
    <ErrorBoundary>
      <VaultSwap
        i18n={t}
        tokens={pick(contracts.mainnet, DAPP_TOKENS)}
        vault={{
          contract: contracts.mainnet.OETHVaultProxy,
          token: contracts.mainnet.OETH,
        }}
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
