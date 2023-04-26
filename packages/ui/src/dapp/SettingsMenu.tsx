import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useClickAway } from '@originprotocol/hooks';
import { Typography } from '@originprotocol/origin-storybook';
import { truncateDecimals } from '@originprotocol/utils';

const SettingsMenu = ({ i18n }) => {
  const ref = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [showFrontRunMessage, setShowFrontRun] = useState(true);

  const [settings, setSettings] = useState({
    tolerance: 0.1,
    gwei: 20,
  });

  useClickAway(ref, (e) => {
    setTimeout(() => {
      setIsOpen(false);
    }, 100);
  });

  useEffect(() => {
    setShowFrontRun(settings.tolerance > 1);
  }, [settings.tolerance]);

  return (
    <div className="relative">
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
          <Typography.Body
            className="flex flex-shrink-0 px-6 h-[80px] items-center"
            as="h2"
          >
            {i18n('settings.title')}
          </Typography.Body>
          <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
          <div className="flex flex-col justify-center h-full space-y-2 p-6">
            <div className="flex flex-col space-y-2">
              <Typography.Caption className="text-origin-dimmed">
                {i18n('settings.tolerance')}
              </Typography.Caption>
              <div className="flex flex-row space-x-2">
                <div className="relative flex flex-row items-center px-6 justify-center w-full max-w-[120px] h-[44px] rounded-full overflow-hidden z-[2] bg-origin-blue bg-opacity-5 border border-origin-blue">
                  <input
                    onChange={(e) => {
                      e.preventDefault();
                      let value = 0;
                      if (!isNaN(e.target.value)) {
                        value = Math.min(
                          truncateDecimals(e.target.value, 2),
                          50
                        );
                        setShowFrontRun(value > 1);
                        setSettings((prev) => ({
                          ...prev,
                          tolerance: value,
                        }));
                      }
                    }}
                    value={settings?.tolerance || ''}
                    className="text-right text-origin-dimmed focus:outline-none z-[2] px-2 flex items-center w-full h-full rounded-full bg-transparent"
                  />
                  <span className="text-origin-white">%</span>
                </div>
                <button
                  className="flex items-center justify-center flex-shrink-0 h-[44px] px-6 bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-full"
                  onClick={() => {
                    setShowFrontRun(false);
                    setSettings((prev) => ({
                      ...prev,
                      tolerance: 0.1,
                    }));
                  }}
                >
                  {i18n('settings.auto')}
                </button>
              </div>
              {showFrontRunMessage && (
                <Typography.Caption className="text-origin-secondary">
                  {i18n('settings.frontRun')}
                </Typography.Caption>
              )}
            </div>
            <div className="flex flex-col space-y-2">
              <Typography.Caption className="text-origin-dimmed">
                {i18n('settings.gasPrice')}
              </Typography.Caption>
              <div className="flex flex-row space-x-2">
                <div className="relative flex flex-row items-center px-6 justify-center max-w-[160px] w-full h-[44px] rounded-full overflow-hidden z-[2] bg-origin-blue bg-opacity-5 border border-origin-blue">
                  <input
                    onChange={(e) => {
                      setSettings((prev) => ({
                        ...prev,
                        gwei: e.target.value || '',
                      }));
                    }}
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
