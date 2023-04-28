import React, { useEffect, useState } from 'react';
import { isEmpty, orderBy } from 'lodash';
import {
  useAccount,
  useLocalStorage,
  useTokenBalances,
  useSwapEstimator,
  useVault,
} from '@originprotocol/hooks';
import { formatWeiBalance, findTokenByAddress } from '@originprotocol/utils';
import { SWAP_TYPES, STORED_TOKEN_LS_KEY } from '../../constants';
import SwapForm from './SwapForm';
import SwapRoutes from './SwapRoutes';
import SwapActions from './SwapActions';

type VaultSwapProps = {
  i18n: any;
  tokens: any;
  vault: any;
};

const VaultSwap = ({ tokens, i18n, vault }: VaultSwapProps) => {
  const { address } = useAccount();

  const [storedTokenAddress, setStoredTokenAddress] = useLocalStorage(
    STORED_TOKEN_LS_KEY,
    null
  );

  const [settings, setSettings] = useState({
    tolerance: 0.1,
    gwei: null,
  });

  const [swap, setSwap] = useState({
    mode: SWAP_TYPES.MINT,
    selectedTokenAddress: null,
    estimatedTokenAddress: null,
    value: 0,
    selectedEstimate: null,
    estimates: [],
  });

  const [{ assetContractAddresses }] = useVault({
    vault,
  });

  // Retrieve user token balances
  const { data: tokensWithBalances } = useTokenBalances({
    address,
    tokens,
  });

  // Swappable tokens based on supported vault assets
  const swapTokens = assetContractAddresses?.map(
    // @ts-ignore
    findTokenByAddress.bind(null, tokensWithBalances)
  );

  const selectedToken = findTokenByAddress(
    // @ts-ignore
    tokensWithBalances,
    swap?.selectedTokenAddress
  );

  const estimatedToken = findTokenByAddress(
    // @ts-ignore
    tokensWithBalances,
    swap?.estimatedTokenAddress
  );

  const handleEstimate = (newEstimates: { vaultEstimate: any }) => {
    if (!newEstimates) return;
    const { vaultEstimate } = newEstimates;
    // @ts-ignore
    setSwap((prev) => ({
      ...prev,
      selectedEstimate: vaultEstimate,
      estimates: orderBy(
        newEstimates,
        ({ receiveAmount }) => formatWeiBalance(receiveAmount),
        'desc'
      ),
    }));
  };

  // Watch for value changes to perform estimates
  const { isLoading: isLoadingEstimate, onRefreshEstimates } = useSwapEstimator(
    {
      address,
      settings,
      mode: swap?.mode,
      fromToken: selectedToken,
      toToken: estimatedToken,
      value: swap?.value,
      estimatesFor: {
        vault: vault?.contract,
      },
      onEstimate: handleEstimate,
    }
  );

  // Auto select a selected token and corresponding estimated token
  useEffect(() => {
    if (!swap?.selectedTokenAddress && !isEmpty(assetContractAddresses)) {
      const hasStored = findTokenByAddress(
        // @ts-ignore
        tokensWithBalances,
        storedTokenAddress
      );
      // @ts-ignore
      setSwap((prev) => ({
        ...prev,
        estimatedTokenAddress: vault.token.address,
        selectedTokenAddress: hasStored
          ? storedTokenAddress
          : assetContractAddresses?.[0],
      }));
    }
  }, [
    JSON.stringify(assetContractAddresses),
    swap?.selectedTokenAddress,
    tokensWithBalances,
  ]);

  const onSwap = (changes: {
    selectedTokenAddress: any;
    mode?: string;
    estimatedTokenAddress?: null;
    value?: number;
    selectedEstimate?: null;
    estimates?: never[];
  }) => {
    setSwap((prev) => ({
      ...prev,
      ...changes,
    }));
    // Persist to local storage
    if (changes?.selectedTokenAddress) {
      setStoredTokenAddress(changes?.selectedTokenAddress);
    }
  };

  const onChangeSettings = (settings: { tolerance: number; gwei: null }) => {
    setSettings((prev) => ({
      ...prev,
      ...settings,
    }));
  };

  const onSwitchMode = () => {
    setSwap((prev) => ({
      ...prev,
      mode: prev.mode === SWAP_TYPES.MINT ? SWAP_TYPES.REDEEM : SWAP_TYPES.MINT,
      selectedTokenAddress: prev.estimatedTokenAddress,
      estimatedTokenAddress: prev.selectedTokenAddress,
    }));
  };

  const onSuccess = () => {
    setSwap((prev) => ({
      ...prev,
    }));
    setTimeout(async () => {
      await onRefreshEstimates();
    }, 500);
  };

  return (
    <div className="flex flex-col space-y-8">
      <SwapForm
        i18n={i18n}
        swap={swap}
        selectedToken={selectedToken}
        estimatedToken={estimatedToken}
        settings={settings}
        onSwap={onSwap}
        onChangeSettings={onChangeSettings}
        onSwitchMode={onSwitchMode}
        swapTokens={swapTokens}
        isLoadingEstimate={isLoadingEstimate}
      />
      <SwapRoutes i18n={i18n} />
      <SwapActions
        i18n={i18n}
        swap={swap}
        selectedToken={selectedToken}
        estimatedToken={estimatedToken}
        targetContract={vault.contract}
        onSuccess={onSuccess}
      />
    </div>
  );
};

export default VaultSwap;
