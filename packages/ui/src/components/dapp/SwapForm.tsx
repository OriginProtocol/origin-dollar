import { useState } from 'react';
import { SWAP_TYPES } from '../../constants';
import SettingsMenu from './SettingsMenu';
import TokenSelectionModal from './TokenSelectionModal';
import SwapInputValue from './SwapInputValue';
import SwapOutputValue from './SwapOutputValue';

type SwapFormProps = {
  i18n: any;
  swap: any;
  selectedToken: any;
  estimatedToken: any;
  settings: any;
  onChangeValue: any;
  onChangeSettings: any;
  onSwitchMode: any;
  swapTokens: any;
  isLoadingEstimate: boolean;
  onSelectToken: any;
  onSetMax: any;
  conversions: {
    ethUsd: number | undefined;
  };
};

const SwapForm = ({
  i18n,
  swap,
  selectedToken,
  estimatedToken,
  settings,
  onChangeValue,
  onChangeSettings,
  onSelectToken,
  onSetMax,
  onSwitchMode,
  swapTokens,
  isLoadingEstimate,
  conversions,
}: SwapFormProps) => {
  const [showTokenSelection, setShowTokenSelection] = useState(false);
  const { mode, value, selectedEstimate } = swap;
  const { receiveAmount, minimumAmount } = selectedEstimate || {};
  const isMint = mode === SWAP_TYPES.MINT;

  const onShowTokenSelection = () => setShowTokenSelection(true);
  const onCloseTokenSelection = () => setShowTokenSelection(false);

  // TODO: Make dynamic as needed
  const conversion = conversions?.ethUsd || 0;

  return (
    <>
      <div className="flex flex-col w-full h-[440px] bg-origin-bg-lgrey rounded-xl">
        <div className="flex flex-row flex-shrink-0 items-center justify-between pl-6 pr-3 lg:pl-10 lg:pr-5 h-[80px]">
          <h2 className="flex flex-shrink-0 ">{i18n('title')}</h2>
          <SettingsMenu
            i18n={i18n}
            onChange={onChangeSettings}
            settings={settings}
          />
        </div>
        <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
        <div className="relative flex flex-col justify-center h-full w-full">
          <SwapInputValue
            i18n={i18n}
            value={value}
            onChangeValue={onChangeValue}
            onSetMax={onSetMax}
            selectedToken={selectedToken}
            onShowTokenSelection={onShowTokenSelection}
            onSwitchMode={onSwitchMode}
            canSelect={isMint}
            conversion={conversion}
          />
          <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
          <SwapOutputValue
            i18n={i18n}
            isLoadingEstimate={isLoadingEstimate}
            receiveAmount={receiveAmount}
            estimatedToken={estimatedToken}
            minimumAmount={minimumAmount}
            onShowTokenSelection={onShowTokenSelection}
            canSelect={!isMint}
            conversion={conversion}
          />
        </div>
      </div>
      {showTokenSelection && (
        <TokenSelectionModal
          tokens={swapTokens}
          onClose={onCloseTokenSelection}
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
