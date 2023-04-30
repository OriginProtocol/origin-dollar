import { ErrorBoundary, TokenSwap } from '@originprotocol/ui';
import { contracts } from '@originprotocol/web3';
import { useTranslation } from 'next-i18next';
import pick from 'lodash/pick';
import { getStaticPaths, makeStaticProps } from '../../lib/getStatic';
import { DAPP_TOKENS, STORED_TOKEN_LS_KEY } from '../../src/constants';
import { BigNumber } from 'ethers';
import { useEthUsdPrice } from '@originprotocol/hooks';

const canUseOETHVault = ({ mode, fromToken, toToken }) => {
  if (mode === 'MINT') {
    // Cant use ETH or sfrxETH
    // Can use WETH, stETH, rETH, frxETH
    return (
      !['ETH', contracts.mainnet.sfrxETH.symbol].includes(fromToken?.symbol) &&
      [
        contracts.mainnet.WETH.symbol,
        contracts.mainnet.stETH.symbol,
        contracts.mainnet.rETH.symbol,
        contracts.mainnet.frxETH.symbol,
      ].includes(fromToken?.symbol)
    );
  } else if (mode === 'REDEEM') {
    // Can only return a MIX of tokens
    return ['OETH_MIX'].includes(toToken?.symbol);
  }
};

const canUseZapper = ({ mode, fromToken }) => {
  // Must be MINT and needs to be ETH or sfrxETH
  return (
    mode === 'MINT' &&
    ['ETH', contracts.mainnet.sfrxETH.symbol].includes(fromToken?.symbol)
  );
};

const Swap = () => {
  const { t } = useTranslation('swap');

  // Get current ETH in USD
  const [{ formatted: usdConversionPrice }] = useEthUsdPrice();

  return (
    <ErrorBoundary>
      <TokenSwap
        i18n={t}
        tokens={pick(contracts.mainnet, DAPP_TOKENS)}
        estimatesBy={{
          vault: {
            contract: contracts.mainnet.OETHVaultProxy,
            token: contracts.mainnet.OETH,
            canEstimateSwap: canUseOETHVault,
          },
          zapper: {
            contract: contracts.mainnet.OETHZapper,
            canEstimateSwap: canUseZapper,
          },
        }}
        supportedSwapTokens={[
          'ETH',
          contracts.mainnet.OETH.symbol,
          contracts.mainnet.WETH.symbol,
          contracts.mainnet.stETH.symbol,
          contracts.mainnet.rETH.symbol,
          contracts.mainnet.frxETH.symbol,
          contracts.mainnet.sfrxETH.symbol,
        ]}
        additionalRedeemTokens={{
          OETH_MIX: {
            name: 'Mixed Redeem',
            symbol: 'OETH_MIX',
            symbolAlt: 'Mix',
            mix: [
              contracts.mainnet.frxETH.symbol,
              contracts.mainnet.rETH.symbol,
              contracts.mainnet.stETH.symbol,
              contracts.mainnet.WETH.symbol,
            ],
            balanceOf: BigNumber.from(0),
          },
        }}
        storageKey={STORED_TOKEN_LS_KEY}
        usdConversionPrice={usdConversionPrice}
      />
    </ErrorBoundary>
  );
};

const getStaticProps = makeStaticProps(['common', 'swap']);

export { getStaticPaths, getStaticProps };

export default Swap;
