import { useEffect, useState } from 'react';
import cx from 'classnames';
import {
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from '@originprotocol/hooks';
import { parseUnits, MaxUint256 } from '@originprotocol/utils';
import { SWAP_TYPES } from '../../constants';

type SuccessContext = {
  context: any;
};

type ActionsProps = {
  i18n: any;
  swap: any;
  translationContext: any;
  onSuccess: (a: string, b: SuccessContext) => void;
  selectedToken?: any;
};

type SwapActionsProps = {
  i18n: any;
  swap: any;
  selectedToken: any;
  estimatedToken: any;
  onSuccess: (a: string, b: SuccessContext) => void;
};

const MintableActions = ({
  i18n,
  swap,
  selectedToken,
  translationContext,
  onSuccess,
}: ActionsProps) => {
  const [error, setError] = useState('');
  const { value, selectedEstimate } = swap || {};
  const { hasProvidedAllowance, contract, minimumAmount } =
    selectedEstimate || {};
  const weiValue = parseUnits(String(value), selectedToken?.decimals || 18);

  const { config: allowanceWriteConfig } = usePrepareContractWrite({
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

  useEffect(() => {
    if (swapWriteError) {
      const error = 'UNPREDICTABLE_GAS_LIMIT';
      // TODO: Add more error handling
      setError(error);
    } else {
      setError('');
    }
  }, [swapWriteError]);

  return (
    <>
      {!hasProvidedAllowance ? (
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
      ) : (
        error && (
          <span role="alert" className="text-origin-secondary text-sm">
            {i18n(`error.${error}`, translationContext)}
          </span>
        )
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

const RedeemActions = ({
  i18n,
  swap,
  translationContext,
  onSuccess,
}: ActionsProps) => {
  const [error, setError] = useState('');
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

  const { isLoading: snapWriteIsSubmitted, isSuccess: snapWriteIsSuccess } =
    useWaitForTransaction({
      hash: swapWriteData?.hash,
    });

  useEffect(() => {
    if (snapWriteIsSuccess && onSuccess) {
      onSuccess('REDEEM', { context: swapWriteData });
    }
  }, [snapWriteIsSuccess]);

  useEffect(() => {
    if (swapWriteError) {
      let error = 'UNPREDICTABLE_GAS_LIMIT';
      if (
        swapWriteError?.message?.includes('Redeem amount lower than minimum')
      ) {
        error = 'REDEEM_TOO_LOW';
      }
      setError(error);
    } else {
      setError('');
    }
  }, [swapWriteError]);

  return (
    <>
      {error && (
        <span role="alert" className="text-origin-secondary text-sm">
          {i18n(`error.${error}`, translationContext)}
        </span>
      )}
      <button
        className={cx(
          'flex items-center justify-center w-full h-[72px] text-xl bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-xl',
          {
            'opacity-50 cursor-not-allowed': !!swapWriteError,
          }
        )}
        onClick={() => {
          swapWrite?.();
        }}
        disabled={!!swapWriteError}
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
    </>
  );
};

const SwapActions = ({
  i18n,
  swap,
  selectedToken,
  estimatedToken,
  onSuccess,
}: SwapActionsProps) => {
  const { mode, selectedEstimate, value } = swap || {};
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
      selectedToken={selectedToken}
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

export default SwapActions;
