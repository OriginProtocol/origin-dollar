import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useClickAway, useFeeData } from '@originprotocol/hooks';
import { formatUnits, truncateDecimals } from '@originprotocol/utils';
import NumericInput from '../core/NumericInput';

type SettingsMenuProps = {
  i18n: any;
  onChange: any;
  settings: any;
};

const SettingsMenu = ({ i18n, onChange, settings }: SettingsMenuProps) => {
  const ref = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [showFrontRunMessage, setShowFrontRun] = useState(true);

  const { data: feeData } = useFeeData();

  // Set default gwei based on feeData
  useEffect(() => {
    if (!settings?.gwei && feeData?.gasPrice) {
      onChange({
        gwei: parseFloat(formatUnits(feeData?.gasPrice, 'gwei')).toFixed(2),
      });
    }
  }, [settings?.gwei, feeData?.gasPrice]);

  const handleToleranceChange = (newValue: number) => {
    const value = Math.min(Number(truncateDecimals(newValue, 2)), 50);
    setShowFrontRun(value > 1);
    onChange({
      tolerance: value,
    });
  };

  const handleGweiChange = (value: string) => {
    onChange({
      gwei: value,
    });
  };

  const handleAutoChange = () => {
    setShowFrontRun(false);
    onChange({
      tolerance: 0.1,
    });
  };

  useClickAway(ref, (e) => {
    setTimeout(() => {
      setIsOpen(false);
    }, 100);
  });

  useEffect(() => {
    if (settings.tolerance) {
      setShowFrontRun(settings.tolerance > 1);
    }
  }, [settings?.tolerance, settings?.gwei]);

  return (
    <div className="relative z-[999]">
      <button
        onClick={(e) => {
          setIsOpen(true);
        }}
        className="flex justify-center items-center w-[42px] h-[42px] bg-origin-bg-lgrey rounded-full overflow-hidden hover:opacity-90 duration-100 ease-in"
      >
        <Image
          src="/icons/settings.png"
          height={24}
          width={24}
          alt="settings"
        />
      </button>
      {isOpen && (
        <div
          ref={ref}
          className="absolute top-[48px] right-0 flex flex-col w-[300px] bg-origin-bg-lgrey z-[2] shadow-xl border border-[1px] border-origin-bg-dgrey rounded-xl"
        >
          <h2 className="flex flex-shrink-0 px-6 h-[80px] items-center">
            {i18n('settings.title')}
          </h2>
          <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
          <div className="flex flex-col justify-center h-full space-y-4 p-6">
            <div className="flex flex-col space-y-2">
              <label
                htmlFor="settings-tolerance"
                className="text-origin-dimmed"
              >
                {i18n('settings.tolerance')}
              </label>
              <div className="flex flex-row space-x-2">
                <div className="relative flex flex-row items-center px-6 justify-center w-full max-w-[120px] h-[44px] rounded-full overflow-hidden z-[2] bg-origin-blue bg-opacity-5 border border-origin-blue">
                  <NumericInput
                    id="settings-tolerance"
                    onChange={handleToleranceChange}
                    value={settings?.tolerance || ''}
                    className="text-right text-origin-dimmed focus:outline-none z-[2] px-2 flex items-center w-full h-full rounded-full bg-transparent"
                  />
                  <span className="text-origin-white">%</span>
                </div>
                <button
                  className="flex items-center justify-center flex-shrink-0 h-[44px] px-6 bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-full"
                  onClick={handleAutoChange}
                >
                  {i18n('settings.auto')}
                </button>
              </div>
              {showFrontRunMessage && (
                <span role="alert" className="text-origin-secondary text-sm">
                  {i18n('settings.frontRun')}
                </span>
              )}
            </div>
            <div className="flex flex-col space-y-2">
              <label htmlFor="settings-gasPrice" className="text-origin-dimmed">
                {i18n('settings.gasPrice')}
              </label>
              <div className="flex flex-row space-x-2">
                <div className="relative flex flex-row items-center px-6 justify-center max-w-[160px] w-full h-[44px] rounded-full overflow-hidden z-[2] bg-origin-blue bg-opacity-5 border border-origin-blue">
                  <NumericInput
                    id="settings-gasPrice"
                    onChange={handleGweiChange}
                    type="number"
                    value={settings?.gwei || ''}
                    className="text-right text-origin-dimmed focus:outline-none z-[2] px-2 flex items-center w-full h-full rounded-full bg-transparent"
                  />
                  <span className="text-origin-white text-sm">GWEI</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsMenu;
