import React, { useMemo, useState } from 'react';
import { BigNumber } from 'ethers';
import { orderBy, isEmpty, values } from 'lodash';
import {
  useAccount,
  useTokenBalances,
  useSwapEstimator,
  usePersistState,
  useEthUsdPrice,
} from '@originprotocol/hooks';
import { formatWeiBalance, findTokenBySymbol } from '@originprotocol/utils';
import { SWAP_TYPES, STORED_TOKEN_LS_KEY } from '../../constants';
import SwapForm from './SwapForm';
import SwapRoutes from './SwapRoutes';
import SwapActions from './SwapActions';

type TokenSwapProps = {
  i18n: any;
  tokens: any;
  estimatesBy: any;
  supportedSwapTokens: string[];
  additionalRedeemTokens: any;
};

const FIELDS_TO_STORE = [
  'selectedTokenSymbol',
  'estimatedTokenSymbol',
  'mode',
  'value',
];

const TokenSwap = ({
  tokens,
  i18n,
  estimatesBy,
  supportedSwapTokens,
  additionalRedeemTokens,
}: TokenSwapProps) => {
  const { address } = useAccount();

  const [settings, setSettings] = useState({
    tolerance: 0.1,
    gwei: 0,
  });

  const [swap, setSwap] = useState({
    mode: SWAP_TYPES.MINT,
    selectedTokenSymbol: supportedSwapTokens?.[0],
    estimatedTokenSymbol: estimatesBy?.vault?.token?.symbol,
    value: 0,
    selectedEstimate: {
      contract: null,
      error: '',
      effectivePrice: BigNumber.from(0),
      receiveAmount: BigNumber.from(0),
      minimumAmount: BigNumber.from(0),
      hasProvidedAllowance: false,
    },
    estimates: [],
  });

  const {
    mode,
    selectedTokenSymbol,
    estimatedTokenSymbol,
    selectedEstimate,
    estimates,
    value,
  } = swap;

  usePersistState(swap, {
    storageKey: STORED_TOKEN_LS_KEY,
    saveFields: FIELDS_TO_STORE,
    onMount: (storedData: any) => {
      setSwap((prev) => ({
        ...prev,
        ...(storedData ?? {}),
      }));
    },
  });

  // Get current ETH in USD
  const [{ formatted: ethUsdPrice }] = useEthUsdPrice();

  // Retrieve user token balances
  const { data: tokensWithBalances, onRefresh: onRefreshBalances } =
    useTokenBalances({
      address,
      tokens,
    });

  // Swappable tokens based
  const swapTokens = useMemo(() => {
    let allTokens = supportedSwapTokens?.map(
      // @ts-ignore
      findTokenBySymbol.bind(null, tokensWithBalances)
    );
    if (mode === SWAP_TYPES.REDEEM) {
      // Add in additionalRedeemTokens
      allTokens = allTokens.concat(values(additionalRedeemTokens));
    }
    return allTokens;
  }, [mode, tokensWithBalances]);

  const selectedToken = findTokenBySymbol(
    // @ts-ignore
    tokensWithBalances,
    selectedTokenSymbol
  );

  // Account for additional types of redeem types
  const estimatedToken =
    additionalRedeemTokens[estimatedTokenSymbol] ||
    findTokenBySymbol(
      // @ts-ignore
      tokensWithBalances,
      estimatedTokenSymbol
    );

  const onSwapEstimates = (sortedGasEstimates: any) => {
    if (isEmpty(sortedGasEstimates)) return;
    setSwap((prev) => ({
      ...prev,
      selectedEstimate: sortedGasEstimates[0],
      estimates: sortedGasEstimates,
    }));
  };

  // Watch for value changes to perform estimates
  const { isLoading: isLoadingEstimate, onRefreshEstimates } = useSwapEstimator(
    {
      address,
      settings,
      mode,
      fromToken: selectedToken,
      toToken: estimatedToken,
      value,
      estimatesBy,
      onEstimate: onSwapEstimates,
      ethUsdPrice,
    }
  );

  const onSuccess = (transactionType: string) => {
    if (transactionType === 'MINTED' || transactionType === 'REDEEM') {
      setSwap((prev) => ({
        ...prev,
        value: 0,
        selectedEstimate: null,
        estimates: [],
      }));
    }
  };

  const onRefresh = async () => {
    await onRefreshEstimates();
    onRefreshBalances();
  };

  const onChangeValue = (value: number) => {
    setSwap((prev) => ({
      ...prev,
      value,
    }));
  };

  const onChangeSettings = (settings: { tolerance: number; gwei: number }) => {
    setSettings((prev) => ({
      ...prev,
      ...settings,
    }));
  };

  const onSwitchMode = () => {
    setSwap((prev) => {
      const wasmint = prev.mode === SWAP_TYPES.MINT;
      return {
        ...prev,
        mode: wasmint ? SWAP_TYPES.REDEEM : SWAP_TYPES.MINT,
        selectedTokenSymbol:
          !wasmint && additionalRedeemTokens[prev.estimatedTokenSymbol]
            ? supportedSwapTokens?.[0]
            : prev.estimatedTokenSymbol,
        estimatedTokenSymbol: prev.selectedTokenSymbol,
      };
    });
  };

  const onSelectToken = (tokenSymbol: string) => {
    // Vault token should be redeem only
    if (tokenSymbol === estimatesBy?.vault?.token?.symbol) {
      setSwap((prev) => {
        // No-op
        if (prev.selectedTokenSymbol === tokenSymbol) return prev;
        // Change mode to redeemable
        return {
          ...prev,
          selectedTokenSymbol: tokenSymbol,
          estimatedTokenSymbol: prev.selectedTokenSymbol,
          mode: SWAP_TYPES.REDEEM,
        };
      });
    } else {
      setSwap((prev) => ({
        ...prev,
        [prev.mode === SWAP_TYPES.MINT
          ? 'selectedTokenSymbol'
          : 'estimatedTokenSymbol']: tokenSymbol,
      }));
    }
  };

  const onSetMax = (maxValue: BigNumber) => {
    // @ts-ignore
    setSwap((prev) => ({
      ...prev,
      value: formatWeiBalance(maxValue),
    }));
  };

  return (
    <div className="flex flex-col space-y-4 lg:space-y-8">
      <SwapForm
        i18n={i18n}
        swap={swap}
        selectedToken={selectedToken}
        estimatedToken={estimatedToken}
        settings={settings}
        swapTokens={swapTokens}
        isLoadingEstimate={isLoadingEstimate}
        onChangeValue={onChangeValue}
        onSelectToken={onSelectToken}
        onChangeSettings={onChangeSettings}
        onSwitchMode={onSwitchMode}
        onSetMax={onSetMax}
        conversions={{
          ethUsd: ethUsdPrice,
        }}
      />
      <SwapRoutes
        i18n={i18n}
        selectedEstimate={selectedEstimate}
        estimates={estimates}
      />
      <SwapActions
        i18n={i18n}
        swap={swap}
        selectedToken={selectedToken}
        estimatedToken={estimatedToken}
        targetContract={selectedEstimate?.contract}
        onSuccess={onSuccess}
        onRefresh={onRefresh}
      />
    </div>
  );
};

export default TokenSwap;
