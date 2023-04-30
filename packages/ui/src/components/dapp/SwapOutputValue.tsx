import { useMemo } from 'react';
import cx from 'classnames';
import { formatWeiBalance, formatUSD } from '@originprotocol/utils';
import NumericInput from '../core/NumericInput';
import SelectTokenPill from '../core/SelectTokenPill';

type SwapOutputValueProps = {
  i18n: any;
  estimatedToken: any;
  receiveAmount: any;
  isLoadingEstimate: boolean;
  canSelect: boolean;
  minimumAmount?: any;
  onShowTokenSelection?: any;
  conversion: number;
};

const SwapOutputValue = ({
  i18n,
  isLoadingEstimate,
  receiveAmount,
  minimumAmount,
  estimatedToken,
  onShowTokenSelection,
  canSelect,
  conversion,
}: SwapOutputValueProps) => {
  const estimatedReceiveAmount = useMemo(
    () => (receiveAmount ? formatWeiBalance(receiveAmount) : 0),
    [receiveAmount]
  );

  const convertedEstimateValue = conversion
    ? parseFloat(String(estimatedReceiveAmount)) * conversion
    : 0;

  const estimatedTokenBalance = useMemo(
    () => formatWeiBalance(estimatedToken?.balanceOf),
    [estimatedToken?.balanceOf]
  );

  const estimatedMinimumAmount = useMemo(
    () => (minimumAmount ? formatWeiBalance(minimumAmount) : 0),
    [minimumAmount]
  );

  return (
    <div className="flex flex-shrink-0 flex-row h-[155px] w-full items-center px-4 lg:px-10">
      <div className="flex flex-col w-[50%]">
        {isLoadingEstimate ? (
          <div className="flex flex-col space-y-2">
            <span className="animate-pulse inline-block min-h-[22px] w-[180px] bg-current opacity-10 rounded-md" />
            <span className="animate-pulse inline-block min-h-[16px] w-[80px] bg-current opacity-10 rounded-md" />
          </div>
        ) : (
          <>
            <NumericInput
              className={cx(
                'font-header font-semibold focus:outline-none bg-transparent text-2xl lg:text-4xl h-[60px] text-origin-dimmed caret-gradient1-from',
                {
                  'text-origin-white': receiveAmount?.gt(0),
                }
              )}
              value={estimatedReceiveAmount}
              readOnly
            />
            <span className="text-origin-dimmed text-lg">
              {formatUSD(convertedEstimateValue)}
            </span>
          </>
        )}
      </div>
      <div className="flex flex-col flex-shrink-0 space-y-4 items-end w-[50%]">
        <div className="flex flex-row space-x-4 items-center">
          <span className="text-sm lg:text-base text-origin-dimmed">
            {i18n('balance')}:{' '}
            {estimatedTokenBalance
              ? parseFloat(estimatedTokenBalance).toFixed(6)
              : '-'}
          </span>
        </div>
        <SelectTokenPill
          onClick={onShowTokenSelection}
          {...estimatedToken}
          readOnly={!canSelect}
        />
        {estimatedMinimumAmount ? (
          <span className="text-origin-dimmed text-sm">
            {i18n('minReceived')}:{' '}
            {estimatedMinimumAmount
              ? parseFloat(estimatedMinimumAmount).toFixed(6)
              : '-'}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default SwapOutputValue;
