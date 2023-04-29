import { ErrorBoundary, TokenSwap } from '@originprotocol/ui';
import { contracts } from '@originprotocol/web3';
import { useTranslation } from 'next-i18next';
import pick from 'lodash/pick';
import { getStaticPaths, makeStaticProps } from '../../lib/getStatic';
import { DAPP_TOKENS } from '../../src/constants';

const Swap = () => {
  const { t } = useTranslation('swap');
  return (
    <ErrorBoundary>
      <TokenSwap
        i18n={t}
        tokens={pick(contracts.mainnet, DAPP_TOKENS)}
        estimatesBy={{
          vault: {
            contract: contracts.mainnet.VaultProxy,
            token: contracts.mainnet.OUSD,
          },
        }}
        supportedSwapTokens={[
          contracts.mainnet.DAI.symbol,
          contracts.mainnet.USDC.symbol,
          contracts.mainnet.USDT.symbol,
        ]}
        additionalRedeemTokens={{
          MIX: {
            name: 'Mix',
            symbol: 'Mix',
            tokens: [],
          },
        }}
      />
    </ErrorBoundary>
  );
};

const getStaticProps = makeStaticProps(['common', 'swap']);

export { getStaticPaths, getStaticProps };

export default Swap;
