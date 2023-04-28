import { ErrorBoundary, VaultSwap } from '@originprotocol/ui';
import { contracts } from '@originprotocol/web3';
import { useTranslation } from 'next-i18next';
import pick from 'lodash/pick';
import { getStaticPaths, makeStaticProps } from '../../lib/getStatic';
import { DAPP_TOKENS } from '../../src/constants';

const Swap = () => {
  const { t } = useTranslation('swap');
  return (
    <ErrorBoundary>
      <VaultSwap
        i18n={t}
        tokens={pick(contracts.mainnet, DAPP_TOKENS)}
        vault={{
          contract: contracts.mainnet.VaultProxy,
          token: contracts.mainnet.OUSD,
        }}
      />
    </ErrorBoundary>
  );
};

const getStaticProps = makeStaticProps(['common', 'swap']);

export { getStaticPaths, getStaticProps };

export default Swap;
