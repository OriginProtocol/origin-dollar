import { useEffect, useState } from 'react';
import {
  useAccount,
  useLocalStorage,
  useWrapEstimator,
  useTokenBalances,
} from '@originprotocol/hooks';
import { findTokenByAddress } from '@originprotocol/utils';
import { STORED_WRAPPED_TOKEN_LS_KEY, SWAP_TYPES } from '../../constants';
import ExternalCTA from '../core/ExternalCTA';
import WrapForm from './WrapForm';
import WrapActions from './WrapActions';

type Token = {
  name: string;
  address: `0x${string}` | string | undefined;
  abi: never;
  decimals?: number;
  symbol?: string;
};

type WrapTokenProps = {
  i18n: any;
  unwrappedToken: any;
  wrappedToken: any;
  emptyState: any;
};

const WrapToken = ({
  i18n,
  unwrappedToken,
  wrappedToken,
  emptyState,
}: WrapTokenProps) => {
  const { address } = useAccount();

  const [storedTokenAddress, setStoredTokenAddress] = useLocalStorage(
    STORED_WRAPPED_TOKEN_LS_KEY,
    null
  );

  const [showingEmptyState] = useState(true);

  const [swap, setSwap] = useState({
    mode: null,
    selectedTokenAddress: null,
    estimatedTokenAddress: null,
    value: 0,
    selectedEstimate: null,
  });

  // Retrieve user token balances
  const { data: tokensWithBalances } = useTokenBalances({
    address,
    tokens: {
      [unwrappedToken?.symbol as string]: unwrappedToken,
      [wrappedToken?.symbol as string]: wrappedToken,
    },
  });

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
      mode: swap?.mode,
      fromToken: selectedToken,
      toToken: estimatedToken,
      proxy: wrappedToken,
      value: swap?.value,
      onEstimate: handleEstimate,
    }
  );

  // Auto select a selected token and corresponding estimated token
  useEffect(() => {
    if (!swap?.selectedTokenAddress) {
      const hasStored = findTokenByAddress(
        // @ts-ignore
        tokensWithBalances,
        storedTokenAddress
      );

      let estimatedTokenAddress: string | undefined;
      let selectedTokenAddress: string | undefined;
      let mode: string;

      if (hasStored && storedTokenAddress === wrappedToken.address) {
        selectedTokenAddress = wrappedToken.address;
        estimatedTokenAddress = unwrappedToken.address;
        mode = SWAP_TYPES.UNWRAP;
      } else {
        selectedTokenAddress = unwrappedToken.address;
        estimatedTokenAddress = wrappedToken.address;
        mode = SWAP_TYPES.WRAP;
      }

      // @ts-ignore
      setSwap((prev) => ({
        ...prev,
        mode,
        estimatedTokenAddress,
        selectedTokenAddress,
      }));
    }
  }, [swap?.selectedTokenAddress, tokensWithBalances]);

  const onSwap = (changes: {
    selectedTokenAddress: any;
    mode?: string;
    estimatedTokenAddress?: null;
    value?: number;
    selectedEstimate?: null;
    estimates?: never[];
  }) => {
    // @ts-ignore
    setSwap((prev) => ({
      ...prev,
      ...changes,
    }));
    // Persist to local storage
    if (changes?.selectedTokenAddress) {
      setStoredTokenAddress(changes?.selectedTokenAddress);
    }
  };

  const onSwitchMode = () => {
    // @ts-ignore
    setSwap((prev) => ({
      ...prev,
      mode: prev.mode === SWAP_TYPES.WRAP ? SWAP_TYPES.UNWRAP : SWAP_TYPES.WRAP,
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
    }, 300);
  };

  return (
    <div className="flex flex-col space-y-8">
      {showingEmptyState && emptyState && <ExternalCTA {...emptyState} />}
      <WrapForm
        i18n={i18n}
        swap={swap}
        selectedToken={selectedToken}
        estimatedToken={estimatedToken}
        onSwap={onSwap}
        onSwitchMode={onSwitchMode}
        isLoadingEstimate={isLoadingEstimate}
      />
      <WrapActions
        address={address}
        i18n={i18n}
        swap={swap}
        selectedToken={selectedToken}
        estimatedToken={estimatedToken}
        wrappedContract={wrappedToken}
        onSuccess={onSuccess}
      />
    </div>
  );
};

export default WrapToken;
