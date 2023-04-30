import { useMemo, useState } from 'react';
import Image from 'next/image';
import { formatWeiBalance, formatUSD } from '@originprotocol/utils';
import cx from 'classnames';

type SwapRoutesProps = {
  i18n: any;
  selectedEstimate: any;
  estimates: any;
  isLoadingEstimate: boolean;
  onSelect: any;
};

type EstimateViewProps = {
  i18n: any;
  estimate: any;
  bestContractAddress: string;
  onSelect?: any;
  isSelected: boolean;
  translationContext: any;
};

const EstimateView = ({
  i18n,
  estimate,
  bestContractAddress,
  onSelect,
  isSelected,
  translationContext,
}: EstimateViewProps) => {
  const {
    contract,
    receiveAmount,
    effectivePrice,
    gasCostUsd,
    valueInUsd,
    toToken,
    error,
    diff,
  } = estimate || {};

  const estimatedReceiveAmount = useMemo(
    () => (receiveAmount ? formatWeiBalance(receiveAmount) : 0),
    [receiveAmount]
  );

  const hasEstimate = receiveAmount?.gt(0);

  const isBest =
    hasEstimate &&
    estimate &&
    estimate?.contract?.address === bestContractAddress;

  const isSelectable = onSelect && hasEstimate && !isSelected && !error;

  return (
    <button
      className={cx(
        'relative flex flex-col space-y-2 py-3 lg:py-6 h-full w-full px-4 lg:px-10 bg-origin-bg-grey rounded-md',
        {
          'cursor-pointer': isSelectable,
          'cursor-default': !isSelectable,
        }
      )}
      tabIndex={onSelect ? 0 : -1}
      style={
        isSelected
          ? {
              background:
                'linear-gradient(#18191C, #18191C) padding-box,linear-gradient(to right, #B361E6 20%, #6A36FC 80%) border-box',
              border: '1px solid transparent',
              borderImage: 'linear-gradient(90deg, #B361E6, #6A36FC) 1',
            }
          : {}
      }
      onClick={() => {
        if (isSelectable) {
          onSelect(estimate);
        }
      }}
      disabled={!isSelectable}
    >
      <div className="flex flex-row w-full justify-between">
        <div className="flex flex-row space-x-2">
          <span className="text-xl font-header font-semibold">
            <span>{estimatedReceiveAmount || '-'}</span>
            <span className="ml-2">
              {toToken?.symbolAlt || toToken?.symbol}
            </span>
          </span>
          {hasEstimate && (
            <span className="hidden lg:flex text-origin-dimmed text-sm relative top-[4px]">
              ({i18n('estimate')})
            </span>
          )}
        </div>
        {isBest ? (
          <h4 className="text-xl font-header font-bold bg-gradient-to-r from-gradient3-from to-gradient3-to inline-block text-transparent bg-clip-text">
            Best
          </h4>
        ) : diff ? (
          <h4 className="text-xl font-header text-[#FF4E4E]">{diff}%</h4>
        ) : !hasEstimate || error ? (
          <h4 className="font-header text-[#FF4E4E]">
            {i18n(`errors.${error || 'NO_ESTIMATES'}`, translationContext)}
          </h4>
        ) : null}
      </div>
      <div className="flex flex-col lg:flex-row w-full justify-between space-y-3">
        {hasEstimate ? (
          <div className="flex flex-row">
            <span className="text-origin-dimmed min-w-[150px] text-sm">
              ≈{formatUSD(valueInUsd - gasCostUsd)} {i18n('afterFees')}
            </span>
            <span className="text-origin-dimmed min-w-[150px] text-sm">
              {i18n('effectivePrice')}: {formatUSD(effectivePrice || 0)}
            </span>
          </div>
        ) : (
          <div />
        )}
        <div className="flex flex-row space-x-4">
          <span className="flex flex-row text-origin-dimmed">
            <Image
              className="scale-[80%] mr-1"
              src="/icons/gas.png"
              height={14}
              width={18}
              alt="Gas price"
            />
            {formatUSD(gasCostUsd || 0)}
          </span>
          <span className="text-origin-dimmed">{contract?.name}</span>
        </div>
      </div>
    </button>
  );
};

const LoadingEstimate = () => (
  <div className="relative flex flex-col items-center justify-center space-y-2 py-3 lg:py-6 h-[120px] w-full px-4 lg:px-10 bg-origin-bg-grey rounded-md animate-pulse cursor-wait">
    <div className="flex flex-row w-full justify-between">
      <span className="inline-block min-h-[1em] w-[160px] bg-current opacity-10 rounded-md" />
    </div>
    <div className="flex flex-col lg:flex-row w-full justify-between space-y-2">
      <span className="inline-block min-h-[1em] w-[290px] bg-current opacity-10 rounded-md" />
      <span className="inline-block min-h-[1em] w-[225px] bg-current opacity-10 rounded-md" />
    </div>
  </div>
);

const SwapRoutes = ({
  i18n,
  selectedEstimate,
  estimates,
  onSelect,
  isLoadingEstimate,
}: SwapRoutesProps) => {
  const [isShowingMore, setIsShowingMore] = useState(false);
  const hasMoreRoutes = estimates.length > 1;
  const bestContractAddress = estimates?.[0]?.contract?.address;
  const selectedHasEstimate = selectedEstimate?.receiveAmount?.gt(0);

  const translationContext = {
    targetContractName: selectedEstimate?.contract?.name || 'Unknown',
    sourceTokenName: selectedEstimate?.fromToken?.symbol,
    targetTokenName: selectedEstimate?.toToken?.symbol,
  };

  return (
    <div className="flex flex-col w-full bg-origin-bg-lgrey rounded-xl p-4 lg:p-10 space-y-3 lg:space-y-6">
      <h3 className="flex flex-shrink-0 items-center">{i18n('swapRoutes')}</h3>
      {isLoadingEstimate ? (
        <LoadingEstimate />
      ) : (
        <>
          <EstimateView
            i18n={i18n}
            estimate={selectedEstimate}
            bestContractAddress={bestContractAddress}
            isSelected={selectedHasEstimate}
            translationContext={translationContext}
          />
          {hasMoreRoutes && (
            <div className="flex flex-col w-full items-center justify-center space-y-4">
              {isShowingMore &&
                estimates
                  .filter(
                    (estimate: any) =>
                      estimate?.contract?.name !==
                      selectedEstimate?.contract.name
                  )
                  .map((estimate: any) => (
                    <EstimateView
                      key={estimate?.contract?.address}
                      i18n={i18n}
                      estimate={estimate}
                      bestContractAddress={bestContractAddress}
                      onSelect={onSelect}
                      isSelected={false}
                      translationContext={translationContext}
                    />
                  ))}
              <button
                className="flex flex-row space-x-4 items-center justify-center px-4 py-1 bg-origin-white bg-opacity-10 rounded-full"
                onClick={() => setIsShowingMore((prev) => !prev)}
              >
                <span>
                  {isShowingMore ? i18n('showLess') : i18n('showMore')}
                </span>
                <Image
                  className={cx('relative top-[2px]', {
                    'rotate-[180deg]': isShowingMore,
                  })}
                  src="/icons/caretdown.png"
                  height={6}
                  width={8}
                  alt="Caret down"
                />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SwapRoutes;
