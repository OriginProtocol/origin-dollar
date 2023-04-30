import { useState } from 'react';
import { map } from 'lodash';
import cx from 'classnames';
import {
  findTokenByAddress,
  formatUnits,
  formatUSD,
} from '@originprotocol/utils';
import { SWAP_TYPES } from '../../constants';
import SettingsMenu from './SettingsMenu';
import TokenSelectionModal from './TokenSelectionModal';
import SwapInputValue from './SwapInputValue';
import SwapOutputValue from './SwapOutputValue';
import TokenImage from '../core/TokenImage';
import Image from 'next/image';

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
  const { breakdown, receiveAmount, minimumAmount } = selectedEstimate || {};
  const isMint = mode === SWAP_TYPES.MINT;

  const onShowTokenSelection = () => setShowTokenSelection(true);
  const onCloseTokenSelection = () => setShowTokenSelection(false);

  const conversion = conversions?.ethUsd || 0;
  const breakdownKeys = Object.keys(breakdown || {});

  return (
    <>
      <div className="flex flex-col w-full min-h-[420px] bg-origin-bg-lgrey rounded-xl">
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
          {breakdown && (
            <div className="flex flex-col items-center justify-center w-full">
              <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
              <div className="flex flex-col items-center justify-center w-full p-4 lg:p-10">
                {breakdownKeys.map((contractAddress, index) => {
                  const token = findTokenByAddress(swapTokens, contractAddress);

                  if (!token) return null;

                  const value = breakdown[contractAddress];
                  // @ts-ignore
                  const { logoSrc, name, symbolAlt, symbol, mix } = token;

                  const convertedEstimateValue = conversion
                    ? parseFloat(formatUnits(value, 18)) * conversion
                    : 0;

                  return (
                    <div
                      key={contractAddress}
                      className={cx(
                        'relative flex flex-row w-full items-center justify-center h-[100px] border border-t-[1px] border-origin-bg-lgrey px-4 lg:px-10 bg-origin-bg-grey',
                        {
                          'rounded-tr-md rounded-tl-md': index === 0,
                          'rounded-br-md rounded-bl-md':
                            index === breakdownKeys?.length - 1,
                        }
                      )}
                    >
                      <div className="flex flex-row w-full h-full items-center justify-between space-y-2">
                        <div className="flex flex-col space-y-2">
                          <span className="text-lg lg:text-2xl text-origin-white font-semibold">
                            {value
                              ? parseFloat(formatUnits(value, 18)).toFixed(18)
                              : 0}
                          </span>
                          <span className="text-origin-dimmed">
                            {formatUSD(convertedEstimateValue)}
                          </span>
                        </div>
                        <div className="flex flex-row space-x-3">
                          <TokenImage
                            src={logoSrc}
                            symbol={symbol}
                            name={name}
                            height={32}
                            width={32}
                            mix={mix}
                          />
                          <span className="text-2xl text-origin-white font-semibold">
                            {symbolAlt || symbol}
                          </span>
                        </div>
                      </div>
                      <div
                        className={cx(
                          'absolute bottom-[-21px] h-[42px] w-[42px] items-center justify-center',
                          {
                            hidden: index >= breakdownKeys?.length - 1,
                          }
                        )}
                        style={{ zIndex: index + 1 }}
                      >
                        <span className="flex font-header text-2xl items-center text-origin-dimmed justify-center h-full w-full rounded-full border border-t-[1px] border-origin-bg-lgrey bg-origin-bg-grey">
                          +
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
