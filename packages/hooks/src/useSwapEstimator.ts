import { useEffect, useState } from 'react';
import { ethers, BigNumber } from 'ethers';
import { parseUnits } from '@originprotocol/utils';
import { useDebouncedCallback } from 'use-debounce';

type UseSwapEstimatorProps = {
  address: `0x${string}` | string | undefined;
  settings: any;
  mode: string;
  fromToken: any;
  toToken: any;
  value: number;
  estimatesBy: any;
  onEstimate: any;
};

export type SwapEstimate = {
  error?: string;
  feeData?: any;
  receiveAmount?: BigNumber;
  minimumAmount?: BigNumber;
  gasLimit?: number;
  contract?: any;
  hasProvidedAllowance?: boolean;
};

const providerRpc = process.env['NEXT_PUBLIC_ETHEREUM_RPC_PROVIDER'];

interface EstimateError extends Error {
  data: {
    message: string;
  };
}

const ONE_ETHER_WEI = 1000000000000000000;

const handleError = (e: EstimateError) => {
  console.log(e);

  const errorMessage = e?.data?.message || e?.message;

  if (errorMessage.includes('Mint amount lower than minimum')) {
    return {
      error: 'PRICE_TOO_HIGH',
    };
  } else if (errorMessage.includes('Asset price below peg')) {
    return {
      error: 'BELOW_PEG',
    };
  }

  return {
    error: 'UNKNOWN',
  };
};

type EstimateToken = {
  address: `0x${string}` | string;
  abi: any;
  name: string;
  symbol: string;
  balanceOf?: BigNumber;
};

type EstimateFnProps = {
  config: {
    contract: {
      address: `0x${string}` | string;
      abi: any;
    };
    token: EstimateToken;
    tokenPredicate: (a: EstimateToken) => boolean;
  };
  mode: string;
  toToken: EstimateToken;
  fromToken: EstimateToken;
  address: `0x${string}` | string;
  value: number;
  settings: {
    tolerance: number;
    gwei: number;
  };
};

const estimateVaultMint = async ({
  config,
  mode,
  fromToken,
  toToken,
  address,
  value,
  settings,
}: EstimateFnProps) => {
  if (!config.contract) {
    return {
      error: 'UNSUPPORTED',
    };
  } else if (
    config.tokenPredicate &&
    config.tokenPredicate &&
    !config.tokenPredicate({
      mode,
      fromToken,
      toToken,
    })
  ) {
    return {
      error: 'UNSUPPORTED',
    };
  }

  try {
    const provider = new ethers.providers.JsonRpcProvider(providerRpc);

    const signer = provider.getSigner(address);

    const feeData = await provider.getFeeData();

    const fromTokenContract = new ethers.Contract(
      fromToken.address,
      fromToken.abi,
      provider
    );

    const toTokenContract = new ethers.Contract(
      toToken.address,
      toToken.abi,
      provider
    );

    const vaultContract = new ethers.Contract(
      config.contract.address,
      config.contract.abi,
      provider
    );

    const [fromTokenAllowance, fromTokenDecimals, toTokenDecimals] =
      await Promise.all([
        fromTokenContract['allowance'](address, vaultContract.address),
        fromTokenContract['decimals'](),
        toTokenContract['decimals'](),
      ]);

    const fromTokenValue = parseUnits(String(value), fromTokenDecimals);

    const hasEnoughBalance =
      fromToken?.balanceOf && fromToken?.balanceOf.gte(fromTokenValue);

    if (!hasEnoughBalance) {
      return {
        error: 'NOT_ENOUGH_BALANCE',
      };
    }

    const oracleCoinPrice = await vaultContract['priceUnitMint'](
      fromToken.address
    );

    const receiveAmount = parseUnits(
      String(value * parseFloat(ethers.utils.formatUnits(oracleCoinPrice, 18))),
      toTokenDecimals
    );

    const minimumAmount = fromTokenValue.sub(
      fromTokenValue.mul(settings?.tolerance * 100).div(10000)
    );

    const hasProvidedAllowance = fromTokenAllowance.gte(fromTokenValue);

    // Needs approvals, get estimates
    if (!hasProvidedAllowance) {
      const [rebaseThreshold, autoAllocateThreshold] = await Promise.all([
        vaultContract['rebaseThreshold'](),
        vaultContract['autoAllocateThreshold'](),
      ]);

      let gasLimit = BigNumber.from(220000);

      if (fromTokenValue.gt(autoAllocateThreshold)) {
        // https://etherscan.io/tx/0x267da9abae04ae600d33d2c3e0b5772872e6138eaa074ce715afc8975c7f2deb
        gasLimit = BigNumber.from(2900000);
      } else if (fromTokenValue.gt(rebaseThreshold)) {
        // https://etherscan.io/tx/0xc8ac03e33cab4bad9b54a6e6604ef6b8e11126340b93bbca1348167f548ad8fd
        gasLimit = BigNumber.from(510000);
      }

      const approveGasLimit = await fromTokenContract
        .connect(signer)
        .estimateGas['approve'](vaultContract.address, fromTokenValue);

      return {
        contract: config.contract,
        gasLimit: gasLimit.add(approveGasLimit),
        receiveAmount,
        minimumAmount,
        hasProvidedAllowance,
        feeData,
      };
    }

    const gasLimit = await vaultContract
      .connect(signer)
      .estimateGas['mint'](fromToken.address, fromTokenValue, minimumAmount);

    return {
      contract: config.contract,
      gasLimit,
      receiveAmount,
      minimumAmount,
      hasProvidedAllowance,
      feeData,
    };
  } catch (e) {
    return handleError(e as EstimateError);
  }
};

const estimateVaultRedeem = async ({
  address,
  mode,
  toToken,
  config,
  fromToken,
  value,
  settings,
}: EstimateFnProps) => {
  if (!config.contract) {
    return {
      error: 'UNSUPPORTED',
    };
  } else if (
    config.tokenPredicate &&
    !config.tokenPredicate({
      mode,
      fromToken,
      toToken,
    })
  ) {
    return {
      error: 'UNSUPPORTED',
    };
  }

  try {
    const provider = new ethers.providers.JsonRpcProvider(providerRpc);

    const signer = provider.getSigner(address);

    const feeData = await provider.getFeeData();

    const fromTokenContract = new ethers.Contract(
      fromToken.address,
      fromToken.abi,
      provider
    );

    const vaultContract = new ethers.Contract(
      config.contract.address,
      config.contract.abi,
      provider
    );

    const [fromTokenDecimals, redeemFeeBps] = await Promise.all([
      fromTokenContract['decimals'](),
      vaultContract['redeemFeeBps'](),
    ]);

    const fromTokenValue = parseUnits(String(value), fromTokenDecimals);
    const hasEnoughBalance =
      fromToken?.balanceOf && fromToken?.balanceOf.gte(fromTokenValue);

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
      contract: config.contract,
      receiveAmount,
      minimumAmount,
      fromTokenValue,
      feeData,
    };
  } catch (e) {
    return handleError(e as EstimateError);
  }
};

const estimateZapperMint = async ({
  address,
  mode,
  toToken,
  config,
  fromToken,
  value,
  settings,
}: EstimateFnProps) => {
  if (!config.contract) {
    return {
      error: 'UNSUPPORTED',
    };
  } else if (
    config.tokenPredicate &&
    !config.tokenPredicate({
      mode,
      fromToken,
      toToken,
    })
  ) {
    return {
      error: 'UNSUPPORTED',
    };
  }

  try {
    const provider = new ethers.providers.JsonRpcProvider(providerRpc);

    const signer = provider.getSigner(address);

    const feeData = await provider.getFeeData();

    const fromTokenContract = new ethers.Contract(
      fromToken.address,
      fromToken.abi,
      provider
    );

    const toTokenContract = new ethers.Contract(
      toToken.address,
      toToken.abi,
      provider
    );

    const vaultContract = new ethers.Contract(
      config.contract.address,
      config.contract.abi,
      provider
    );

    const [fromTokenAllowance, fromTokenDecimals, toTokenDecimals] =
      await Promise.all([
        fromTokenContract['allowance'](address, vaultContract.address),
        fromTokenContract['decimals'](),
        toTokenContract['decimals'](),
      ]);

    const fromTokenValue = parseUnits(String(value), fromTokenDecimals);

    const hasEnoughBalance =
      fromToken?.balanceOf && fromToken?.balanceOf.gte(fromTokenValue);

    if (!hasEnoughBalance) {
      return {
        error: 'NOT_ENOUGH_BALANCE',
      };
    }

    const oracleCoinPrice = await vaultContract['priceUnitMint'](
      fromToken.address
    );

    const receiveAmount = parseUnits(
      String(value * parseFloat(ethers.utils.formatUnits(oracleCoinPrice, 18))),
      toTokenDecimals
    );

    const minimumAmount = fromTokenValue.sub(
      fromTokenValue.mul(settings?.tolerance * 100).div(10000)
    );

    const hasProvidedAllowance = fromTokenAllowance.gte(fromTokenValue);

    // Needs approvals, get estimates
    if (!hasProvidedAllowance) {
      const [rebaseThreshold, autoAllocateThreshold] = await Promise.all([
        vaultContract['rebaseThreshold'](),
        vaultContract['autoAllocateThreshold'](),
      ]);

      let gasLimit = BigNumber.from(220000);

      if (fromTokenValue.gt(autoAllocateThreshold)) {
        // https://etherscan.io/tx/0x267da9abae04ae600d33d2c3e0b5772872e6138eaa074ce715afc8975c7f2deb
        gasLimit = BigNumber.from(2900000);
      } else if (fromTokenValue.gt(rebaseThreshold)) {
        // https://etherscan.io/tx/0xc8ac03e33cab4bad9b54a6e6604ef6b8e11126340b93bbca1348167f548ad8fd
        gasLimit = BigNumber.from(510000);
      }

      const approveGasLimit = await fromTokenContract
        .connect(signer)
        .estimateGas['approve'](vaultContract.address, fromTokenValue);

      return {
        contract: config.contract,
        gasLimit: gasLimit.add(approveGasLimit),
        receiveAmount,
        minimumAmount,
        hasProvidedAllowance,
        feeData,
      };
    }

    const gasLimit = await vaultContract
      .connect(signer)
      .estimateGas['mint'](fromToken.address, fromTokenValue, minimumAmount);

    return {
      contract: config.contract,
      gasLimit,
      receiveAmount,
      minimumAmount,
      hasProvidedAllowance,
      feeData,
    };
  } catch (e) {
    return handleError(e as EstimateError);
  }
};

const estimateFlipperSwap = async ({
  address,
  mode,
  toToken,
  config,
  fromToken,
  value,
  settings,
}: EstimateFnProps) => {
  if (!config.contract) {
    return {
      error: 'UNSUPPORTED',
    };
  } else if (
    config.tokenPredicate &&
    !config.tokenPredicate({
      mode,
      fromToken,
      toToken,
    })
  ) {
    return {
      error: 'UNSUPPORTED',
    };
  }
};

const estimateUniswapV2Swap = async ({
  address,
  mode,
  toToken,
  config,
  fromToken,
  value,
  settings,
}: EstimateFnProps) => {
  if (!config.contract) {
    return {
      error: 'UNSUPPORTED',
    };
  } else if (
    config.tokenPredicate &&
    !config.tokenPredicate({
      mode,
      fromToken,
      toToken,
    })
  ) {
    return {
      error: 'UNSUPPORTED',
    };
  }
};

const estimateUniswapV3Swap = async ({
  address,
  mode,
  toToken,
  config,
  fromToken,
  value,
  settings,
}: EstimateFnProps) => {
  if (!config.contract) {
    return {
      error: 'UNSUPPORTED',
    };
  } else if (
    config.tokenPredicate &&
    !config.tokenPredicate({
      mode,
      fromToken,
      toToken,
    })
  ) {
    return {
      error: 'UNSUPPORTED',
    };
  }
};

const estimateCurveSwap = async ({
  address,
  mode,
  toToken,
  config,
  fromToken,
  value,
  settings,
}: EstimateFnProps) => {
  if (!config.contract) {
    return {
      error: 'UNSUPPORTED',
    };
  } else if (
    config.tokenPredicate &&
    !config.tokenPredicate({
      mode,
      fromToken,
      toToken,
    })
  ) {
    return {
      error: 'UNSUPPORTED',
    };
  }
};

const estimateSushiSwap = async ({
  address,
  mode,
  toToken,
  config,
  fromToken,
  value,
  settings,
}: EstimateFnProps) => {
  if (!config.contract) {
    return {
      error: 'UNSUPPORTED',
    };
  } else if (
    config.tokenPredicate &&
    !config.tokenPredicate({
      mode,
      fromToken,
      toToken,
    })
  ) {
    return {
      error: 'UNSUPPORTED',
    };
  }
};

const useSwapEstimator = ({
  address,
  settings,
  mode,
  fromToken,
  toToken,
  value,
  estimatesBy,
  onEstimate,
}: UseSwapEstimatorProps) => {
  const [isLoading, setIsLoading] = useState(false);

  // Defined swap, mint/redeem estimators
  const estimateLookup = {
    vault: mode === 'MINT' ? estimateVaultMint : estimateVaultRedeem,
    zapper: mode === 'MINT' ? estimateZapperMint : null,
    flipper: estimateFlipperSwap,
    uniswapV2: estimateUniswapV2Swap,
    uniswapV3: estimateUniswapV3Swap,
    sushiswap: estimateSushiSwap,
    curve: estimateCurveSwap,
  };

  const onFetchEstimations = useDebouncedCallback(async () => {
    try {
      setIsLoading(true);

      const estimates = await Promise.all(
        Object.keys(estimatesBy).map((estimateKey) =>
          // @ts-ignore
          estimateLookup[estimateKey]?.({
            config: estimatesBy[estimateKey],
            fromToken,
            toToken,
            address,
            value,
            settings,
          })
        )
      );

      console.log({
        estimates,
      });

      setIsLoading(false);

      onEstimate(estimates);

      return true;
    } catch (e) {
      console.error(`ERROR: While fetching estimations`, e);
      return false;
    }
  }, 1000);

  useEffect(() => {
    onFetchEstimations();
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
