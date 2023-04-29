import { ErrorBoundary, TokenSwap } from '@originprotocol/ui';
import { contracts } from '@originprotocol/web3';
import { useTranslation } from 'next-i18next';
import pick from 'lodash/pick';
import { getStaticPaths, makeStaticProps } from '../../lib/getStatic';
import { DAPP_TOKENS } from '../../src/constants';

const canUseOETHVault = ({ mode, fromToken }) => {
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
    // Cant use anything but MIX
    return !['MIX'].includes(fromToken?.symbol);
  }
};

const canUseZapper = ({ mode, symbol }) =>
  // Must be minting and needs to be ETH or sfrxETH
  mode === 'MINT' && ['ETH', contracts.mainnet.sfrxETH.symbol].includes(symbol);

const Swap = () => {
  const { t } = useTranslation('swap');
  return (
    <ErrorBoundary>
      <TokenSwap
        i18n={t}
        tokens={pick(contracts.mainnet, DAPP_TOKENS)}
        estimatesBy={{
          vault: {
            contract: contracts.mainnet.OETHVaultProxy,
            token: contracts.mainnet.OETH,
            tokenPredicate: canUseOETHVault,
          },
          zapper: {
            contract: contracts.mainnet.OETHZapper,
            tokenPredicate: canUseZapper,
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
