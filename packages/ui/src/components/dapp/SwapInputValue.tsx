import Image from 'next/image';
import { useMemo } from 'react';
import cx from 'classnames';
import { formatUSD, formatWeiBalance, parseUnits } from '@originprotocol/utils';
import NumericInput from '../core/NumericInput';
import SelectTokenPill from '../core/SelectTokenPill';

type SwapInputValueProps = {
  i18n: any;
  value: any;
  onChangeValue: any;
  onSetMax: any;
  selectedToken: any;
  onSwitchMode: any;
  canSelect: boolean;
  onShowTokenSelection?: any;
  conversion: number;
};

const SwapInputValue = ({
  i18n,
  value,
  onChangeValue,
  onSetMax,
  selectedToken,
  onShowTokenSelection,
  canSelect,
  onSwitchMode,
  conversion,
}: SwapInputValueProps) => {
  const selectedTokenBalance = useMemo(
    () => formatWeiBalance(selectedToken?.balanceOf),
    [selectedToken?.balanceOf]
  );

  const isMax =
    value && selectedToken?.balanceOf?.eq(parseUnits(String(value), 18));

  const convertedValue = conversion
    ? parseFloat(String(value || 0)) * conversion
    : 0;

  return (
    <div className="relative flex flex-shrink-0 flex-row h-[155px] w-full items-center justify-center px-4 lg:px-10 bg-origin-bg-grey">
      <div className="flex flex-col w-[50%]">
        <NumericInput
          className={cx(
            'font-header font-semibold focus:outline-none bg-transparent text-2xl lg:text-4xl h-[60px] text-origin-dimmed caret-gradient1-from',
            {
              'text-origin-white': value > 0,
            }
          )}
          onChange={(newValue: number) => onChangeValue(newValue)}
          value={value}
          placeholder="0"
        />
        <span className="text-origin-dimmed text-lg">
          {formatUSD(convertedValue)}
        </span>
      </div>
      <div className="flex flex-col w-[50%] items-end flex-shrink-0 space-y-4">
        <div className="flex flex-row space-x-4 items-center">
          <span className="text-sm lg:text-base text-origin-dimmed">
            {i18n('balance')}:{' '}
            {selectedTokenBalance
              ? parseFloat(selectedTokenBalance).toFixed(6)
              : '-'}
          </span>
          {!isMax && (
            <button
              className="flex items-center justify-center px-2 bg-origin-white bg-opacity-10 text-origin-dimmed rounded-lg"
              onClick={onSetMax.bind(null, selectedToken?.balanceOf)}
            >
              {i18n('max')}
            </button>
          )}
        </div>
        <SelectTokenPill
          onClick={onShowTokenSelection}
          {...selectedToken}
          readOnly={!canSelect}
        />
      </div>
      {/* Switch toggle */}
      <div className="absolute bottom-[-26px] h-[52px] w-[52px] items-center justify-center">
        <button
          onClick={onSwitchMode}
          className="flex items-center justify-center h-full w-full rounded-full bg-origin-bg-lgrey border border-[2px] border-origin-bg-dgrey"
        >
          <Image src="/icons/switch.png" height={25} width={14} alt="Switch" />
        </button>
      </div>
    </div>
  );
};

export default SwapInputValue;
