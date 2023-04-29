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
  conversions: {
    ethUsd: number | undefined;
  };
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
  conversions,
}: WrapFormProps) => {
  const { value, selectedEstimate } = swap;
  const { receiveAmount } = selectedEstimate || {};
  const conversion = conversions?.ethUsd || 0;
  return (
    <div className="flex flex-col w-full h-[440px] bg-origin-bg-lgrey rounded-xl">
      <div className="flex flex-row flex-shrink-0 items-center justify-between px-10 h-[80px]">
        <h2 className="flex flex-shrink-0">{i18n('title')}</h2>
      </div>
      <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
      <div className="relative flex flex-col justify-center h-full w-full">
        <div className="relative flex flex-col justify-center h-full w-full">
          <SwapInputValue
            i18n={i18n}
            value={value}
            onChangeValue={onChangeValue}
            onSetMax={onSetMax}
            selectedToken={selectedToken}
            onSwitchMode={onSwitchMode}
            canSelect={false}
            conversion={conversion}
          />
          <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
          <SwapOutputValue
            i18n={i18n}
            isLoadingEstimate={isLoadingEstimate}
            receiveAmount={receiveAmount}
            estimatedToken={estimatedToken}
            canSelect={false}
            conversion={conversion}
          />
        </div>
      </div>
    </div>
  );
};

export default WrapForm;
