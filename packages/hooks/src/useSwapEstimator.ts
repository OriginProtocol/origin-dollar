import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { parseUnits } from '@originprotocol/utils';
import { useDebouncedCallback } from 'use-debounce';

type UseSwapEstimatorProps = {
  address: `0x${string}` | string | undefined;
  settings: any;
  mode: string;
  fromToken: any;
  toToken: any;
  value: string | number;
  estimatesFor: any;
  onEstimate: any;
};

// @ts-ignore
const chainId = parseInt(process.env['NEXT_PUBLIC_ETHEREUM_RPC_CHAIN_ID'], 10);
const providerRpc = process.env['NEXT_PUBLIC_ETHEREUM_RPC_PROVIDER'];

const useSwapEstimator = ({
  address,
  settings,
  mode,
  fromToken,
  toToken,
  value,
  estimatesFor,
  onEstimate,
}: UseSwapEstimatorProps) => {
  const [isLoading, setIsLoading] = useState(false);

  // @ts-ignore
  const provider = new ethers.providers.JsonRpcProvider(providerRpc, {
    chainId,
  });

  const estimateMintSuitabilityVault = async () => {
    if (!estimatesFor.vault) {
      return {
        error: 'UNKNOWN',
      };
    }

    const fromTokenContract = new ethers.Contract(
      fromToken.address,
      fromToken.abi,
      provider
    );

    const vaultContract = new ethers.Contract(
      estimatesFor.vault.address,
      estimatesFor.vault.abi,
      provider
    );

    try {
      const [fromTokenAllowance, fromTokenDecimals] = await Promise.all([
        fromTokenContract['allowance'](address, vaultContract.address),
        fromTokenContract['decimals'](),
      ]);

      const fromTokenValue = parseUnits(String(value), fromTokenDecimals);
      const hasEnoughBalance = fromToken?.balanceOf.gte(fromTokenValue);

      if (!hasEnoughBalance) {
        return {
          error: 'NOT_ENOUGH_BALANCE',
        };
      }

      const receiveAmount = fromTokenValue;

      const minimumAmount = fromTokenValue.sub(
        fromTokenValue.mul(settings?.tolerance * 100).div(10000)
      );

      const hasProvidedAllowance = fromTokenAllowance.gte(fromTokenValue);

      return {
        contract: estimatesFor.vault,
        receiveAmount,
        minimumAmount,
        hasProvidedAllowance,
      };
    } catch (e) {
      // @ts-ignore
      const errorMessage = e?.data?.message || e?.message;
      if (errorMessage.includes('Mint amount lower than minimum')) {
        return {
          error: 'PRICE_TOO_HIGH',
        };
      }
      return {
        error: 'UNKNOWN',
      };
    }
  };

  const estimateRedeemSuitabilityVault = async () => {
    if (!estimatesFor.vault) {
      return {
        error: 'UNKNOWN',
      };
    }

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

      const receiveAmount = fromTokenValue;

      const minimumAmount = fromTokenValue.sub(
        fromTokenValue.mul(settings?.tolerance * 100).div(10000)
      );

      return {
        contract: estimatesFor.vault,
        receiveAmount,
        minimumAmount,
      };
    } catch (e) {
      // @ts-ignore
      const errorMessage = e?.data?.message || e?.message;
      if (errorMessage.includes('Mint amount lower than minimum')) {
        return {
          error: 'PRICE_TOO_HIGH',
        };
      }
      return {
        error: 'UNKNOWN',
      };
    }
  };

  const onFetchEstimations = useDebouncedCallback(async () => {
    try {
      setIsLoading(true);

      let vaultEstimate;

      if (mode === 'MINT') {
        vaultEstimate = await estimateMintSuitabilityVault();
      } else {
        vaultEstimate = await estimateRedeemSuitabilityVault();
      }

      setIsLoading(false);

      onEstimate({
        vaultEstimate,
      });
    } catch (e) {
      console.error(e);
    }
  }, 1000);

  useEffect(() => {
    (async function () {
      if (fromToken?.address && toToken?.address) {
        await onFetchEstimations();
      }
    })();
  }, [
    mode,
    value,
    fromToken?.address,
    toToken?.address,
    JSON.stringify(settings),
  ]);

  return { isLoading, onRefreshEstimates: onFetchEstimations };
};

export default useSwapEstimator;
