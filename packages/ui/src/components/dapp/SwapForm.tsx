import { useState, useMemo } from 'react';
import cx from 'classnames';
import Image from 'next/image';
import { BigNumber } from 'ethers';
import { formatWeiBalance } from '@originprotocol/utils';
import { SWAP_TYPES } from '../../constants';
import SettingsMenu from './SettingsMenu';
import NumericInput from '../core/NumericInput';
import SelectTokenPill from '../core/SelectTokenPill';
import TokenSelectionModal from './TokenSelectionModal';

type SwapFormProps = {
  i18n: any;
  swap: any;
  selectedToken: any;
  estimatedToken: any;
  settings: any;
  onSwap: any;
  onChangeSettings: any;
  onSwitchMode: any;
  swapTokens: any;
  isLoadingEstimate: boolean;
};

const SwapForm = ({
  i18n,
  swap,
  selectedToken,
  estimatedToken,
  settings,
  onSwap,
  onChangeSettings,
  onSwitchMode,
  swapTokens,
  isLoadingEstimate,
}: SwapFormProps) => {
  const [showTokenSelection, setShowTokenSelection] = useState(false);
  const { mode, value, selectedEstimate } = swap;
  const { receiveAmount, minimumAmount } = selectedEstimate || {};

  const isMint = mode === SWAP_TYPES.MINT;

  const onSelectToken = (tokenAddress: string) => {
    onSwap({
      [isMint ? 'selectedTokenAddress' : 'estimatedTokenAddress']: tokenAddress,
    });
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

  const handleSetMaxBalance = (maxValue: BigNumber) => {
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

export default SwapForm;
