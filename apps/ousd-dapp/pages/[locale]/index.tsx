import { ErrorBoundary, TokenSwap } from '@originprotocol/ui';
import { contracts } from '@originprotocol/web3';
import { useTranslation } from 'next-i18next';
import pick from 'lodash/pick';
import { getStaticPaths, makeStaticProps } from '../../lib/getStatic';
import { DAPP_TOKENS, STORED_TOKEN_LS_KEY } from '../../src/constants';
import { BigNumber } from 'ethers';

const canUseOUSDVault = ({ mode, fromToken, toToken }) => {
  if (mode === 'MINT') {
    return [
      contracts.mainnet.DAI.symbol,
      contracts.mainnet.USDT.symbol,
      contracts.mainnet.USDC.symbol,
    ].includes(fromToken?.symbol);
  } else if (mode === 'REDEEM') {
    // Can only return a MIX of tokens
    return ['MIX'].includes(toToken?.symbol);
  }
};

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
            canEstimateSwap: canUseOUSDVault,
          },
        }}
        supportedSwapTokens={[
          contracts.mainnet.OUSD.symbol,
          contracts.mainnet.DAI.symbol,
          contracts.mainnet.USDC.symbol,
          contracts.mainnet.USDT.symbol,
        ]}
        additionalRedeemTokens={{
          MIX: {
            name: 'Mix',
            symbol: 'MIX',
            tokens: [],
            balanceOf: BigNumber.from(0),
            logoSrc: '/tokens/MIX.png',
          },
        }}
        storageKey={STORED_TOKEN_LS_KEY}
      />
    </ErrorBoundary>
  );
};

const getStaticProps = makeStaticProps(['common', 'swap']);

export { getStaticPaths, getStaticProps };

export default Swap;
