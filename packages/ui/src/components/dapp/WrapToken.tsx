import { useState } from 'react';
import { BigNumber } from 'ethers';
import {
  useAccount,
  usePersistState,
  useWrapEstimator,
  useTokenBalances,
  useEthUsdPrice,
} from '@originprotocol/hooks';
import { findTokenByAddress, formatWeiBalance } from '@originprotocol/utils';
import { STORED_WRAPPED_LS_KEY, SWAP_TYPES } from '../../constants';
import ExternalCTA from '../core/ExternalCTA';
import WrapForm from './WrapForm';
import WrapActions from './WrapActions';

type WrapTokenProps = {
  i18n: any;
  unwrappedToken: any;
  wrappedToken: any;
  emptyState: any;
};

const FIELDS_TO_STORE = ['mode', 'value'];

const WrapToken = ({
  i18n,
  unwrappedToken,
  wrappedToken,
  emptyState,
}: WrapTokenProps) => {
  const { address } = useAccount();

  const [swap, setSwap] = useState({
    mode: SWAP_TYPES.WRAP,
    selectedTokenAddress: unwrappedToken.address,
    estimatedTokenAddress: wrappedToken.address,
    value: 0,
    selectedEstimate: null,
    showingEmptyState: true,
  });

  const {
    mode,
    selectedTokenAddress,
    estimatedTokenAddress,
    value,
    selectedEstimate,
    showingEmptyState,
  } = swap;

  usePersistState(swap, {
    storageKey: STORED_WRAPPED_LS_KEY,
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
      tokens: {
        [unwrappedToken?.symbol as string]: unwrappedToken,
        [wrappedToken?.symbol as string]: wrappedToken,
      },
    });

  const selectedToken = findTokenByAddress(
    // @ts-ignore
    tokensWithBalances,
    selectedTokenAddress
  );

  const estimatedToken = findTokenByAddress(
    // @ts-ignore
    tokensWithBalances,
    estimatedTokenAddress
  );

  const handleEstimate = (selectedEstimate: any) => {
    if (!selectedEstimate) return;
    // @ts-ignore
    setSwap((prev) => ({
      ...prev,
      selectedEstimate,
    }));
  };

  // Watch for value changes to perform estimates
  const { isLoading: isLoadingEstimate, onRefreshEstimates } = useWrapEstimator(
    {
      address,
      mode,
      fromToken: selectedToken,
      toToken: estimatedToken,
      proxy: wrappedToken,
      value,
      onEstimate: handleEstimate,
    }
  );

  const onRefresh = async () => {
    await onRefreshEstimates();
    onRefreshBalances();
  };

  const onSuccess = (transactionType: string, { context }: any) => {
    if (transactionType === 'WRAPPED' || transactionType === 'UNWRAPPED') {
      setSwap((prev) => ({
        ...prev,
        value: 0,
      }));
    }
  };

  const onChangeValue = (value: number) => {
    setSwap((prev) => ({
      ...prev,
      value,
    }));
  };

  const onSwitchMode = () => {
    setSwap((prev) => ({
      ...prev,
      mode: prev.mode === SWAP_TYPES.WRAP ? SWAP_TYPES.UNWRAP : SWAP_TYPES.WRAP,
      selectedTokenAddress: prev.estimatedTokenAddress,
      estimatedTokenAddress: prev.selectedTokenAddress,
    }));
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
      {showingEmptyState && emptyState && <ExternalCTA {...emptyState} />}
      <WrapForm
        i18n={i18n}
        swap={swap}
        selectedToken={selectedToken}
        estimatedToken={estimatedToken}
        isLoadingEstimate={isLoadingEstimate}
        onChangeValue={onChangeValue}
        onSwitchMode={onSwitchMode}
        onSetMax={onSetMax}
        conversions={{
          ethUsd: ethUsdPrice,
        }}
      />
      <WrapActions
        address={address}
        i18n={i18n}
        swap={swap}
        selectedToken={selectedToken}
        estimatedToken={estimatedToken}
        wrappedContract={wrappedToken}
        onSuccess={onSuccess}
        onRefresh={onRefresh}
      />
    </div>
  );
};

export default WrapToken;
