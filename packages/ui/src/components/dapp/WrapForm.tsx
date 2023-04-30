import SwapInputValue from './SwapInputValue';
import SwapOutputValue from './SwapOutputValue';

type WrapFormProps = {
  i18n: any;
  swap: any;
  selectedToken: any;
  estimatedToken: any;
  onSetMax: any;
  onSwitchMode: any;
  onChangeValue: any;
  isLoadingEstimate: boolean;
  conversion: number | undefined;
};

const WrapForm = ({
  i18n,
  swap,
  selectedToken,
  estimatedToken,
  onSwitchMode,
  isLoadingEstimate,
  onSetMax,
  onChangeValue,
  conversion,
}: WrapFormProps) => {
  const { value, selectedEstimate } = swap;
  const { receiveAmount } = selectedEstimate || {};
  return (
    <div className="flex flex-col w-full h-[420px] bg-origin-bg-lgrey rounded-xl">
      <div className="flex flex-row flex-shrink-0 items-center justify-between px-10 h-[80px]">
        <h2 className="flex flex-shrink-0">{i18n('title')}</h2>
      </div>
      <div className="relative flex flex-col justify-center h-full w-full">
        <div className="relative flex flex-col justify-center h-full w-full">
          <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
          <SwapInputValue
            i18n={i18n}
            value={value}
            onChangeValue={onChangeValue}
            onSetMax={onSetMax}
            selectedToken={selectedToken}
            onSwitchMode={onSwitchMode}
            canSelect={false}
            conversion={conversion || 1}
          />
          <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
          <SwapOutputValue
            i18n={i18n}
            isLoadingEstimate={isLoadingEstimate}
            receiveAmount={receiveAmount}
            estimatedToken={estimatedToken}
            canSelect={false}
            conversion={conversion || 1}
          />
        </div>
      </div>
    </div>
  );
};

export default WrapForm;
