import React, { useEffect, useRef, useState, useMemo } from 'react';
import cx from 'classnames';
import Image from 'next/image';
import { find, map, isEmpty, orderBy } from 'lodash';
import { ethers } from 'ethers';
import {
  useAccount,
  useContractReads,
  useClickAway,
  useKey,
  useLocalStorage,
  useLockBodyScroll,
  useTokenBalances,
  useDebouncedCallback,
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from '@originprotocol/hooks';
import {
  formatWeiBalance,
  parseUnits,
  MaxUint256,
} from '@originprotocol/utils';
import TokenImage from './TokenImage';
import ExternalCTA from '../core/ExternalCTA';
import NumericInput from '../core/NumericInput';
import SettingsMenu from './SettingsMenu';

const SWAP_TYPES = {
  MINT: 'MINT',
  REDEEM: 'REDEEM',
};

const STORED_TOKEN_LS_KEY = '@oeth-dapp/previousTokenAddress';

const TokenSelectionModal = ({ tokens, onClose, onSelect }) => {
  const ref = useRef(null);

  useKey('Escape', onClose);

  useClickAway(ref, () => {
    setTimeout(() => {
      onClose();
    }, 100);
  });

  useLockBodyScroll(true);

  return (
    <div className="fixed z-[9999] top-0 left-0 flex flex-col h-[100vh] w-[100vw] items-center justify-center">
      <div className="absolute top-0 left-0 flex flex-col h-full w-full bg-origin-bg-black bg-opacity-90 z-[1]" />
      <div
        ref={ref}
        className="flex flex-col mx-auto max-h-[60vh] w-full lg:w-[50vw] z-[2] bg-origin-bg-lgrey rounded-xl p-6 overflow-auto"
      >
        {map(tokens, (token, key) => {
          const { logoSrc, name, symbol, balanceOf } = token;
          return (
            <button
              key={key}
              className="flex flex-row flex-shrink-0 w-full justify-between p-2 hover:bg-origin-bg-dgrey duration-100 ease-in transition-all rounded-md opacity-70 hover:opacity-100 hover:shadow-md"
              onClick={onSelect.bind(null, token)}
            >
              <div className="flex flex-row space-x-4 text-left items-center">
                <div className="flex items-center flex-shrink-0 w-[40px] h-[40px] rounded-full overflow-hidden">
                  <TokenImage
                    src={logoSrc}
                    symbol={symbol}
                    name={name}
                    height={40}
                    width={40}
                  />
                </div>
                <div className="flex flex-col space-y-2">
                  <p className="focus:outline-none bg-transparent text-2xl font-semibold caret-gradient1-from">
                    {name}
                  </p>
                  <span className="text-origin-dimmed">{symbol}</span>
                </div>
              </div>
              <div className="flex flex-col space-y-2 justify-end text-right">
                <p className="focus:outline-none bg-transparent text-2xl font-semibold caret-gradient1-from">
                  {formatWeiBalance(balanceOf)}
                </p>
                <span className="text-origin-dimmed text-lg">
                  {/*${balanceOf * (conversions[swap.from?.asset] || 0)}*/}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SwapRoutes = ({ i18n, swap, settings }) => {
  const hasMoreRoutes = false;
  return (
    <div className="flex flex-col w-full bg-origin-bg-lgrey rounded-xl p-10 space-y-6">
      <h3 className="flex flex-shrink-0 items-center">{i18n('swapRoutes')}</h3>
      <div className="relative flex flex-col space-y-2 py-6 h-full w-full px-10 bg-origin-bg-grey rounded-md">
        <div className="flex flex-row space-x-2">
          <span>0 ETH</span>
          <span className="text-origin-dimmed">({i18n('estimate')})</span>
        </div>
        <div className="flex flex-row">
          <span className="text-origin-dimmed w-[150px]">-</span>
          <span className="text-origin-dimmed w-[150px]">-</span>
        </div>
      </div>
      {hasMoreRoutes && (
        <div className="flex flex-col w-full items-center justify-center">
          <button className="flex flex-row space-x-4 items-center justify-center w-[150px] py-1 bg-origin-white bg-opacity-10 rounded-full">
            <span>{i18n('show more')}</span>
            <Image
              className="relative top-[2px]"
              src="/icons/caretdown.png"
              height={6}
              width={8}
              alt="Caret down"
            />
          </button>
        </div>
      )}
    </div>
  );
};

const MintableActions = ({ i18n, swap, translationContext, onSuccess }) => {
  const { value, selectedToken, selectedEstimate } = swap || {};
  const { hasProvidedAllowance, contract, minimumAmount } =
    selectedEstimate || {};
  const weiValue = parseUnits(String(value), 18);

  const { config: allowanceWriteConfig, error: allowanceWriteError } =
    usePrepareContractWrite({
      address: selectedToken?.address,
      abi: selectedToken?.abi,
      functionName: 'approve',
      args: [contract?.address, weiValue || MaxUint256],
    });

  const {
    data: allowanceWriteData,
    isLoading: allowanceWriteIsLoading,
    write: allowanceWrite,
  } = useContractWrite(allowanceWriteConfig);

  const { config: swapWriteConfig, error: swapWriteError } =
    usePrepareContractWrite({
      address: contract?.address,
      abi: contract?.abi,
      functionName: 'mint',
      args: [selectedToken?.address, weiValue, minimumAmount],
    });

  const {
    data: swapWriteData,
    isLoading: swapWriteIsLoading,
    write: swapWrite,
  } = useContractWrite(swapWriteConfig);

  const swapWriteDisabled = !hasProvidedAllowance || !!swapWriteError;

  const {
    isLoading: allowanceWriteIsSubmitted,
    isSuccess: allowanceWriteIsSuccess,
  } = useWaitForTransaction({
    hash: allowanceWriteData?.hash,
  });

  useEffect(() => {
    if (allowanceWriteIsSuccess && onSuccess) {
      onSuccess('ALLOWANCE', { context: swapWriteData });
    }
  }, [allowanceWriteIsSuccess]);

  const { isLoading: snapWriteIsSubmitted, isSuccess: snapWriteIsSuccess } =
    useWaitForTransaction({
      hash: swapWriteData?.hash,
    });

  useEffect(() => {
    if (snapWriteIsSuccess && onSuccess) {
      onSuccess('MINTED', { context: swapWriteData });
    }
  }, [snapWriteIsSuccess]);

  return (
    <>
      {!hasProvidedAllowance && (
        <button
          className="flex items-center justify-center w-full h-[72px] text-xl bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-xl"
          onClick={() => {
            allowanceWrite?.();
          }}
        >
          {(() => {
            if (allowanceWriteIsLoading) {
              return i18n('approval.PENDING', translationContext);
            } else if (allowanceWriteIsSubmitted) {
              return i18n('approval.SUBMITTED', translationContext);
            } else if (allowanceWriteIsSuccess) {
              return i18n('approval.SUCCESS', translationContext);
            } else {
              return i18n('approval.DEFAULT', translationContext);
            }
          })()}
        </button>
      )}
      <button
        className={cx(
          'flex items-center justify-center w-full h-[72px] text-xl bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-xl',
          {
            'opacity-50 cursor-not-allowed': swapWriteDisabled,
          }
        )}
        onClick={() => {
          swapWrite?.();
        }}
        disabled={swapWriteDisabled}
      >
        {(() => {
          if (swapWriteIsLoading) {
            return i18n('swap.PENDING', translationContext);
          } else if (snapWriteIsSubmitted) {
            return i18n('swap.SUBMITTED', translationContext);
          } else if (snapWriteIsSuccess) {
            return i18n('swap.SUCCESS', translationContext);
          } else {
            return i18n('swap.DEFAULT', translationContext);
          }
        })()}
      </button>
    </>
  );
};

const RedeemActions = ({ i18n, swap, translationContext, onSuccess }) => {
  const { value, selectedEstimate } = swap || {};
  const { contract, minimumAmount } = selectedEstimate || {};
  const weiValue = parseUnits(String(value), 18);

  const { config: swapWriteConfig, error: swapWriteError } =
    usePrepareContractWrite({
      address: contract?.address,
      abi: contract?.abi,
      functionName: 'redeem',
      args: [weiValue, minimumAmount],
    });

  const {
    data: swapWriteData,
    isLoading: swapWriteIsLoading,
    write: swapWrite,
  } = useContractWrite(swapWriteConfig);

  const swapWriteDisabled = !!swapWriteError;

  const { isLoading: snapWriteIsSubmitted, isSuccess: snapWriteIsSuccess } =
    useWaitForTransaction({
      hash: swapWriteData?.hash,
    });

  useEffect(() => {
    if (snapWriteIsSuccess && onSuccess) {
      onSuccess('REDEEM', { context: swapWriteData });
    }
  }, [snapWriteIsSuccess]);

  return (
    <button
      className={cx(
        'flex items-center justify-center w-full h-[72px] text-xl bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-xl',
        {
          'opacity-50 cursor-not-allowed': swapWriteDisabled,
        }
      )}
      onClick={() => {
        swapWrite?.();
      }}
      disabled={swapWriteDisabled}
    >
      {(() => {
        if (swapWriteIsLoading) {
          return i18n('redeem.PENDING', translationContext);
        } else if (snapWriteIsSubmitted) {
          return i18n('redeem.SUBMITTED', translationContext);
        } else if (snapWriteIsSuccess) {
          return i18n('redeem.SUCCESS', translationContext);
        } else {
          return i18n('redeem.DEFAULT', translationContext);
        }
      })()}
    </button>
  );
};

const SwapActions = ({ i18n, swap, onSuccess }) => {
  const { mode, selectedToken, estimatedToken, selectedEstimate, value } =
    swap || {};
  const { error } = selectedEstimate || {};

  const isMint = mode === SWAP_TYPES.MINT;
  const parsedValue = !value ? 0 : parseFloat(value);
  const invalidInputValue = !parsedValue || isNaN(parsedValue);

  const translationContext = {
    targetContractName: 'Origin Vault',
    sourceTokenName: selectedToken?.symbol,
    targetTokenName: estimatedToken?.symbol,
  };

  return invalidInputValue || error ? (
    <div className="flex items-center justify-center w-full h-[72px] text-xl bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-xl opacity-50 cursor-not-allowed">
      {i18n(
        `errors.${invalidInputValue ? 'NO_INPUT_AMOUNT' : error}`,
        translationContext
      )}
    </div>
  ) : isMint ? (
    <MintableActions
      i18n={i18n}
      swap={swap}
      translationContext={translationContext}
      onSuccess={onSuccess}
    />
  ) : (
    <RedeemActions
      i18n={i18n}
      swap={swap}
      translationContext={translationContext}
      onSuccess={onSuccess}
    />
  );
};

const SelectTokenPill = ({ logoSrc, symbol, name, onClick, readOnly }) => (
  <button
    onClick={onClick}
    disabled={readOnly}
    className="relative flex flex-row items-center px-1 max-w-[160px] h-[40px] bg-origin-white bg-opacity-10 rounded-full overflow-hidden"
  >
    {!symbol ? (
      <span className="text-xs text-center w-full">...</span>
    ) : (
      <div className="flex flex-row items-center w-full h-full space-x-4 pr-2">
        <div className="flex items-center flex-shrink-0 w-[30px] h-full overflow-hidden">
          <TokenImage
            src={logoSrc}
            symbol={symbol}
            name={name}
            height={30}
            width={30}
          />
        </div>
        <span className="font-semibold text-xl w-full text-left">{symbol}</span>
        {!readOnly && (
          <Image
            className="flex flex-shrink-0 relative top-[2px] w-[12px]"
            src="/icons/angledown.png"
            height={9}
            width={12}
            alt="angledown"
          />
        )}
      </div>
    )}
  </button>
);

const SwapForm = ({
  i18n,
  swap,
  settings,
  onSwap,
  onChangeSettings,
  onSwitchMode,
  swapTokens,
  isLoadingEstimate,
}) => {
  const [showTokenSelection, setShowTokenSelection] = useState(false);
  const { mode, value, selectedToken, estimatedToken, selectedEstimate } = swap;
  const { receiveAmount, minimumAmount } = selectedEstimate || {};

  const isMint = mode === SWAP_TYPES.MINT;

  const onSelectToken = (token) => {
    onSwap(
      isMint
        ? {
            selectedToken: token,
          }
        : {
            estimatedToken: token,
          }
    );
  };

  const selectedTokenBalance = useMemo(
    () => formatWeiBalance(selectedToken?.balanceOf),
    [selectedToken?.balanceOf]
  );

  const estimatedTokenBalance = useMemo(
    () => formatWeiBalance(estimatedToken?.balanceOf),
    [estimatedToken?.balanceOf]
  );

  const estimatedReceiveAmount = useMemo(
    () => (receiveAmount ? formatWeiBalance(receiveAmount) : 0),
    [receiveAmount]
  );

  const estimatedMinimumAmount = useMemo(
    () => (minimumAmount ? formatWeiBalance(minimumAmount) : 0),
    [minimumAmount]
  );

  const handleSetMaxBalance = (maxValue) => {
    onSwap({
      value: formatWeiBalance(maxValue),
    });
  };

  return (
    <>
      <div className="flex flex-col w-full h-[440px] bg-origin-bg-lgrey rounded-xl">
        <div className="flex flex-row flex-shrink-0 items-center justify-between px-10 h-[80px]">
          <h2 className="flex flex-shrink-0">{i18n('title')}</h2>
          <SettingsMenu
            i18n={i18n}
            onChange={onChangeSettings}
            settings={settings}
          />
        </div>
        <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
        <div className="relative flex flex-col justify-center h-full w-full">
          <div className="relative flex flex-row gap-10 h-full w-full items-center justify-center px-10 bg-origin-bg-grey">
            <div className="flex flex-col w-full">
              {/* @ts-ignore */}
              <NumericInput
                className={cx(
                  'font-header focus:outline-none bg-transparent text-4xl h-[60px] text-origin-dimmed caret-gradient1-from',
                  {
                    'text-origin-white': value > 0,
                  }
                )}
                onChange={(newValue: number) =>
                  onSwap({
                    value: newValue,
                  })
                }
                value={value}
                placeholder="0"
              />
              <span className="text-origin-dimmed text-lg">$0</span>
            </div>
            <div className="flex flex-col flex-shrink-0 space-y-4">
              <div className="flex flex-row space-x-4 items-center">
                <span className="text-origin-dimmed">
                  {i18n('balance')}:{' '}
                  {selectedTokenBalance
                    ? parseFloat(selectedTokenBalance).toFixed(6)
                    : '-'}
                </span>
                <button
                  className="flex items-center justify-center px-2 bg-origin-white bg-opacity-10 text-origin-dimmed rounded-lg"
                  onClick={handleSetMaxBalance.bind(
                    null,
                    selectedToken?.balanceOf
                  )}
                >
                  {i18n('max')}
                </button>
              </div>
              <div className="flex justify-end w-full">
                <SelectTokenPill
                  onClick={() => setShowTokenSelection(true)}
                  {...selectedToken}
                  readOnly={!isMint}
                />
              </div>
            </div>
            {/* Switch toggle */}
            <div className="absolute bottom-[-26px] h-[52px] w-[52px] items-center justify-center">
              <button
                onClick={onSwitchMode}
                className="flex items-center justify-center h-full w-full rounded-full bg-origin-bg-lgrey border border-[2px] border-origin-bg-dgrey"
              >
                <Image
                  src="/icons/switch.png"
                  height={25}
                  width={14}
                  alt="Switch"
                />
              </button>
            </div>
          </div>
          <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
          <div className="flex flex-row gap-10 h-full w-full items-center px-10">
            <div className="flex flex-col w-full">
              {isLoadingEstimate ? (
                <p className="text-sm text-origin-dimmed">
                  {i18n('isLoading')}
                </p>
              ) : (
                <>
                  {/* @ts-ignore */}
                  <NumericInput
                    className={cx(
                      'font-header focus:outline-none bg-transparent text-4xl h-[60px] text-origin-dimmed caret-gradient1-from',
                      {
                        'text-origin-white': receiveAmount?.gt(0),
                      }
                    )}
                    value={estimatedReceiveAmount}
                    readOnly
                  />
                  <span className="text-origin-dimmed text-lg">$0</span>
                </>
              )}
            </div>
            <div className="flex flex-col flex-shrink-0 space-y-4">
              <div className="flex flex-row space-x-4 items-center">
                <span className="text-origin-dimmed">
                  {i18n('balance')}:{' '}
                  {estimatedTokenBalance
                    ? parseFloat(estimatedTokenBalance).toFixed(6)
                    : '-'}
                </span>
              </div>
              <SelectTokenPill
                onClick={() => setShowTokenSelection(true)}
                {...estimatedToken}
                readOnly={isMint}
              />
              <span className="text-origin-dimmed text-sm">
                {i18n('minReceived')}:{' '}
                {estimatedMinimumAmount
                  ? parseFloat(estimatedMinimumAmount).toFixed(6)
                  : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>
      {showTokenSelection && (
        <TokenSelectionModal
          tokens={swapTokens}
          onClose={() => setShowTokenSelection(false)}
          onSelect={(token: string) => {
            onSelectToken(token);
            setShowTokenSelection(false);
          }}
        />
      )}
    </>
  );
};

const useVault = ({ vault }) => {
  const { contract } = vault;
  const { data } = useContractReads({
    contracts: [
      {
        address: contract?.address,
        abi: contract?.abi,
        functionName: 'getAllAssets',
      },
      {
        address: contract?.address,
        abi: contract?.abi,
        functionName: 'getAllStrategies',
      },
    ],
  });
  const [assetContractAddresses, strategyContractAddresses] = data || [];
  return [
    {
      assetContractAddresses,
      strategyContractAddresses,
    },
  ];
};

const matchTokens = (tokens, contractAddress) => {
  const normalizedAddress = contractAddress?.toLowerCase();
  return find(
    tokens,
    ({ address }) => address?.toLowerCase() === normalizedAddress
  );
};

const useSwapEstimator = ({
  address,
  settings,
  mode,
  fromToken,
  toToken,
  value,
  estimatesFor,
  onEstimate,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const provider = new ethers.providers.StaticJsonRpcProvider(
    process.env.NEXT_PUBLIC_ETHEREUM_RPC_PROVIDER,
    { chainId: parseInt(process.env.NEXT_PUBLIC_ETHEREUM_RPC_CHAIN_ID) }
  );

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
      const [
        // priceUnitMint,
        rebaseThreshold,
        autoAllocateThreshold,
        fromTokenAllowance,
        fromTokenDecimals,
      ] = await Promise.all([
        // vaultContract.priceUnitMint(fromToken.address).catch((e) => {
        //   console.error(e);
        //   return null;
        // }),
        vaultContract.rebaseThreshold(),
        vaultContract.autoAllocateThreshold(),
        fromTokenContract.allowance(address, vaultContract.address),
        fromTokenContract.decimals(),
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

      const gasLimit = 200000;
      // await vaultContract.estimateGas.mint(
      //   fromToken.address,
      //   fromTokenValue,
      //   minimumAmount
      // );

      return {
        contract: estimatesFor.vault,
        rebaseThreshold,
        autoAllocateThreshold,
        receiveAmount,
        minimumAmount,
        gasLimit,
        hasProvidedAllowance,
      };
    } catch (e) {
      console.error(`ERROR: Vault swap suitability: ${e.message}`);
      if (
        e?.data?.message?.includes('Mint amount lower than minimum') ||
        e?.message.includes('Mint amount lower than minimum')
      ) {
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

    const vaultContract = new ethers.Contract(
      estimatesFor.vault.address,
      estimatesFor.vault.abi,
      provider
    );

    try {
      const [
        rebaseThreshold,
        autoAllocateThreshold,
        fromTokenAllowance,
        fromTokenDecimals,
      ] = await Promise.all([
        vaultContract.rebaseThreshold(),
        vaultContract.autoAllocateThreshold(),
        fromTokenContract.allowance(address, vaultContract.address),
        fromTokenContract.decimals(),
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

      const gasLimit = 200000;
      // await vaultContract.estimateGas.mint(
      //   fromToken.address,
      //   fromTokenValue,
      //   minimumAmount
      // );

      return {
        contract: estimatesFor.vault,
        rebaseThreshold,
        autoAllocateThreshold,
        receiveAmount,
        minimumAmount,
        gasLimit,
        hasProvidedAllowance,
      };
    } catch (e) {
      console.error(`ERROR: Vault swap suitability: ${e.message}`);
      if (
        e?.data?.message?.includes('Mint amount lower than minimum') ||
        e?.message.includes('Mint amount lower than minimum')
      ) {
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

      if (mode === SWAP_TYPES.MINT) {
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

const VaultSwap = ({ tokens, i18n, emptyState = null, vault }) => {
  const { address, isConnected } = useAccount();

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
    selectedToken: null,
    value: 0,
    selectedEstimate: null,
    estimatedToken: null,
    estimates: [],
    forceRefreshBit: 0,
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
    matchTokens.bind(null, tokensWithBalances)
  );

  const handleEstimate = (newEstimates) => {
    if (!newEstimates) return;
    const { vaultEstimate } = newEstimates;
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
      fromToken: swap?.selectedToken,
      toToken: swap?.estimatedToken,
      value: swap?.value,
      estimatesFor: {
        vault: vault?.contract,
      },
      onEstimate: handleEstimate,
    }
  );

  // Auto select a selected token and corresponding estimated token
  useEffect(() => {
    if (!swap?.selectedToken && !isEmpty(assetContractAddresses)) {
      setSwap((prev) => ({
        ...prev,
        estimatedToken: matchTokens(tokensWithBalances, vault.token.address),
        selectedToken:
          matchTokens(tokensWithBalances, storedTokenAddress) ||
          matchTokens(tokensWithBalances, assetContractAddresses?.[0]),
      }));
    }
  }, [
    JSON.stringify(assetContractAddresses),
    swap?.selectedToken,
    tokensWithBalances,
  ]);

  const onSwap = (changes) => {
    setSwap((prev) => ({
      ...prev,
      ...changes,
    }));
    // Persist to local storage
    if (changes?.selectedToken?.address) {
      setStoredTokenAddress(changes?.selectedToken?.address);
    }
  };

  const onChangeSettings = (settings) => {
    setSettings((prev) => ({
      ...prev,
      ...settings,
    }));
  };

  const onSwitchMode = () => {
    setSwap((prev) => ({
      ...prev,
      mode: prev.mode === SWAP_TYPES.MINT ? SWAP_TYPES.REDEEM : SWAP_TYPES.MINT,
      selectedToken: prev.estimatedToken,
      estimatedToken: prev.selectedToken,
    }));
  };

  const onSuccess = async () => {
    setSwap((prev) => ({
      ...prev,
      forceRefreshBit: prev.forceRefreshBit === 0 ? 1 : 0,
    }));
    await onRefreshEstimates();
  };

  return (
    <div key={swap?.forceRefreshBit} className="flex flex-col space-y-8">
      {!swap?.value && emptyState && <ExternalCTA {...emptyState} />}
      <SwapForm
        i18n={i18n}
        swap={swap}
        settings={settings}
        onSwap={onSwap}
        onChangeSettings={onChangeSettings}
        onSwitchMode={onSwitchMode}
        swapTokens={swapTokens}
        isLoadingEstimate={isLoadingEstimate}
      />
      <SwapRoutes i18n={i18n} swap={swap} settings={settings} />
      <SwapActions i18n={i18n} swap={swap} onSuccess={onSuccess} />
    </div>
  );
};

export default VaultSwap;
