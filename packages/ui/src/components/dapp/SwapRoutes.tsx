import Image from 'next/image';
import { useMemo } from 'react';
import { formatWeiBalance, formatUSD } from '@originprotocol/utils';

type SwapRoutesProps = {
  i18n: any;
  selectedEstimate: any;
  estimates: any;
};

const SwapRoutes = ({ i18n, selectedEstimate, estimates }: SwapRoutesProps) => {
  const hasMoreRoutes = estimates > 1;

  const isBest =
    selectedEstimate &&
    selectedEstimate?.contract?.address === estimates?.[0]?.contract?.address;

  const {
    contract,
    receiveAmount,
    effectivePrice,
    gasCostUsd,
    valueInUsd,
    toToken,
  } = selectedEstimate || {};

  const estimatedReceiveAmount = useMemo(
    () => (receiveAmount ? formatWeiBalance(receiveAmount) : 0),
    [receiveAmount]
  );

  return (
    <div className="flex flex-col w-full bg-origin-bg-lgrey rounded-xl p-4 lg:p-10 space-y-3 lg:space-y-6">
      <h3 className="flex flex-shrink-0 items-center">{i18n('swapRoutes')}</h3>
      <div className="relative flex flex-col space-y-2 py-3 lg:py-6 h-full w-full px-4 lg:px-10 bg-origin-bg-grey rounded-md">
        <div className="flex flex-row w-full justify-between">
          <div className="flex flex-row space-x-2">
            <span className="text-xl font-header font-semibold">
              {estimatedReceiveAmount || '-'} {toToken?.symbol}
            </span>
            <span className="hidden lg:flex text-origin-dimmed text-sm relative top-[4px]">
              ({i18n('estimate')})
            </span>
          </div>
          {isBest ? (
            <h4 className="text-xl font-header font-bold bg-gradient-to-r from-gradient3-from to-gradient3-to inline-block text-transparent bg-clip-text">
              Best
            </h4>
          ) : selectedEstimate ? (
            <h4 className="text-xl font-header text-[#FF4E4E]">-</h4>
          ) : null}
        </div>
        <div className="flex flex-col lg:flex-row w-full justify-between space-y-3">
          {selectedEstimate ? (
            <div className="flex flex-row">
              <span className="text-origin-dimmed min-w-[150px] text-sm">
                ≈{formatUSD(valueInUsd - gasCostUsd)} {i18n('afterFees')}
              </span>
              <span className="text-origin-dimmed min-w-[150px] text-sm">
                {i18n('effectivePrice')}: {formatUSD(effectivePrice || 0)}
              </span>
            </div>
          ) : (
            <div className="flex flex-row">
              <span className="text-origin-dimmed min-w-[150px] text-sm">
                -
              </span>
              <span className="text-origin-dimmed min-w-[150px] text-sm">
                -
              </span>
            </div>
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

export default SwapRoutes;
