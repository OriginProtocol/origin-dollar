import { useMemo } from 'react';
import cx from 'classnames';
import Image from 'next/image';
import { BigNumber } from 'ethers';
import { formatWeiBalance } from '@originprotocol/utils';
import NumericInput from '../core/NumericInput';
import SelectTokenPill from '../core/SelectTokenPill';

type WrapFormProps = {
  i18n: any;
  swap: any;
  selectedToken: any;
  estimatedToken: any;
  onSwap: any;
  onSwitchMode: any;
  isLoadingEstimate: boolean;
};

const WrapForm = ({
  i18n,
  swap,
  selectedToken,
  estimatedToken,
  onSwap,
  onSwitchMode,
  isLoadingEstimate,
}: WrapFormProps) => {
  const { value, selectedEstimate } = swap;
  const { receiveAmount } = selectedEstimate || {};

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

  const handleSetMaxBalance = (maxValue: BigNumber) => {
    onSwap({
      value: formatWeiBalance(maxValue),
    });
  };

  return (
    <div className="flex flex-col w-full h-[440px] bg-origin-bg-lgrey rounded-xl">
      <div className="flex flex-row flex-shrink-0 items-center justify-between px-10 h-[80px]">
        <h2 className="flex flex-shrink-0">{i18n('title')}</h2>
      </div>
      <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
      <div className="relative flex flex-col justify-center h-full w-full">
        <div className="relative flex flex-row gap-10 h-full w-full items-center justify-center px-10 bg-origin-bg-grey">
          <div className="flex flex-col w-full">
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
              <SelectTokenPill {...selectedToken} readOnly />
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
              <p className="text-sm text-origin-dimmed">{i18n('isLoading')}</p>
            ) : (
              <>
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
            <SelectTokenPill {...estimatedToken} readOnly />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WrapForm;
