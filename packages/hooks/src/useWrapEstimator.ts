import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { parseUnits } from '@originprotocol/utils';
import { useDebouncedCallback } from 'use-debounce';

type UseWrapEstimatorProps = {
  address: `0x${string}` | string | undefined;
  mode: string | undefined | null;
  fromToken: any;
  toToken: any;
  proxy: any;
  value: string | number;
  onEstimate: any;
};

// @ts-ignore
const chainId = parseInt(process.env['NEXT_PUBLIC_ETHEREUM_RPC_CHAIN_ID'], 10);
const providerRpc = process.env['NEXT_PUBLIC_ETHEREUM_RPC_PROVIDER'];

const useWrapEstimator = ({
  address,
  mode,
  fromToken,
  toToken,
  value,
  onEstimate,
  proxy,
}: UseWrapEstimatorProps) => {
  const [isLoading, setIsLoading] = useState(false);

  // @ts-ignore
  const provider = new ethers.providers.JsonRpcProvider(providerRpc, {
    chainId,
  });

  const proxyContract = new ethers.Contract(proxy.address, proxy.abi, provider);

  const estimateWrap = async () => {
    const fromTokenContract = new ethers.Contract(
      fromToken.address,
      fromToken.abi,
      provider
    );

    // convertToShares

    try {
      const [fromTokenAllowance, fromTokenDecimals] = await Promise.all([
        fromTokenContract['allowance'](address, proxyContract.address),
        fromTokenContract['decimals'](),
      ]);

      const fromTokenValue = parseUnits(String(value), fromTokenDecimals);
      const hasEnoughBalance = fromToken?.balanceOf.gte(fromTokenValue);

      if (!hasEnoughBalance) {
        return {
          error: 'NOT_ENOUGH_BALANCE',
        };
      }

      const receiveAmount = await proxyContract['convertToShares'](
        fromTokenValue
      );

      const hasProvidedAllowance = fromTokenAllowance.gte(fromTokenValue);

      return {
        contract: proxy,
        receiveAmount,
        hasProvidedAllowance,
      };
    } catch (e) {
      return {
        error: 'UNKNOWN',
      };
    }
  };

  const estimateUnwrap = async () => {
    const fromTokenContract = new ethers.Contract(
      fromToken.address,
      fromToken.abi,
      provider
    );

    try {
      const fromTokenDecimals = await fromTokenContract['decimals']();
      const fromTokenValue = parseUnits(String(value), fromTokenDecimals);
      const hasEnoughBalance = fromToken?.balanceOf.gte(fromTokenValue);

      if (!hasEnoughBalance) {
        return {
          error: 'NOT_ENOUGH_BALANCE',
        };
      }

      const receiveAmount = await proxyContract['convertToAssets'](
        fromTokenValue
      );

      return {
        contract: proxy,
        receiveAmount,
      };
    } catch (e) {
      return {
        error: 'UNKNOWN',
      };
    }
  };

  const onFetchEstimations = useDebouncedCallback(async () => {
    try {
      setIsLoading(true);

      let estimate;

      if (mode === 'WRAP') {
        estimate = await estimateWrap();
      } else {
        estimate = await estimateUnwrap();
      }

      setIsLoading(false);

      onEstimate(estimate);
    } catch (e) {
      console.error(e);
    }
  }, 1000);

  useEffect(() => {
    (async function () {
      if (fromToken?.address && toToken?.address && mode) {
        await onFetchEstimations();
      }
    })();
  }, [mode, value, fromToken?.address, toToken?.address]);

  return { isLoading, onRefreshEstimates: onFetchEstimations };
};

export default useWrapEstimator;
