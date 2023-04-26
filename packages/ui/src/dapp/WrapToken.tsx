import React, { useState } from 'react';
import Image from 'next/image';
import cx from 'classnames';
import { Typography } from '@originprotocol/origin-storybook';
import SettingsMenu from './SettingsMenu';
import ExternalCTA from '../core/ExternalCTA';

const WrapToken = ({ i18n, assets, emptyState }) => {
  const [showingEmptyState, setShowingEmptyState] = useState(true);

  const [showTokenSelection, setShowTokenSelection] = useState(false);
  const [conversions, setConversions] = useState({});

  const [swap, setSwap] = useState({
    from: {
      value: 0,
      balance: 0,
      asset: null,
    },
    to: {
      value: 0,
      balance: 0,
      asset: null,
    },
  });

  const isDisabled = !swap.from?.value || !swap.to?.value;

  return (
    <div className="flex flex-col space-y-8">
      {showingEmptyState && emptyState && <ExternalCTA {...emptyState} />}
      <div className="flex flex-col w-full h-[440px] bg-origin-bg-lgrey rounded-xl">
        <div className="flex flex-row flex-shrink-0 items-center justify-between px-10 h-[80px]">
          <Typography.Body className="flex flex-shrink-0" as="h2">
            {i18n('title')}
          </Typography.Body>
          <SettingsMenu />
        </div>
        <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
        <div className="relative flex flex-col justify-center h-full w-full">
          <div className="relative flex flex-row gap-10 h-full w-full items-center justify-center px-10 bg-origin-bg-grey">
            <div className="flex flex-col w-full">
              <input
                className={cx(
                  'focus:outline-none bg-transparent text-4xl h-[60px] font-semibold text-origin-dimmed caret-gradient1-from',
                  {
                    'text-origin-white': swap.from?.value > 0,
                  }
                )}
                value={swap.from?.value}
                placeholder="0"
                onChange={(e) => {
                  setSwap((prev) => ({
                    ...prev,
                    from: {
                      ...prev.from,
                      value: e.target.value,
                    },
                    to: {
                      ...prev.to,
                      value: e.target.value * 0.8,
                    },
                  }));
                }}
                type="number"
                onWheelCapture={(e) => {
                  e.currentTarget.blur();
                }}
              />
              <Typography.Caption className="text-origin-dimmed text-lg">
                ${swap?.from?.value * (conversions[swap.from?.asset] || 0)}
              </Typography.Caption>
            </div>
            <div className="flex flex-col flex-shrink-0 space-y-4">
              <div className="flex flex-row space-x-4 items-center">
                <Typography.Body className="text-lg text-origin-dimmed">
                  {i18n('balance')} -
                </Typography.Body>
                <button className="flex items-center justify-center px-2 py-1 bg-origin-white bg-opacity-10 text-origin-dimmed rounded-lg">
                  {i18n('max')}
                </button>
              </div>
              <button
                onClick={() => {
                  setShowTokenSelection(true);
                }}
                className="relative flex flex-row space-x-4 items-center pl-1 pr-4 h-[40px] bg-origin-white bg-opacity-10 rounded-full overflow-hidden"
              >
                <div className="flex items-center flex-shrink-0 w-[30px] h-full overflow-hidden">
                  <Image
                    className="rounded-full"
                    src="/logos/lido.png"
                    height={30}
                    width={30}
                    alt="logo"
                  />
                </div>
                <span className="font-semibold text-lg">stETH</span>
                <Image
                  className="relative top-[1px]"
                  src="/icons/angledown.png"
                  height={9}
                  width={12}
                  alt="angledown"
                />
              </button>
            </div>
            {/* Switch toggle */}
            <div className="absolute bottom-[-26px] h-[52px] w-[52px] items-center justify-center">
              <button
                onClick={() => ({})}
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
              <input
                className={cx(
                  'focus:outline-none bg-transparent text-4xl h-[60px] font-semibold text-origin-dimmed caret-gradient1-from',
                  {
                    'text-origin-white': swap.to?.value > 0,
                  }
                )}
                value={swap.to?.value}
                placeholder="0"
                onChange={(e) => {
                  setSwap((prev) => ({
                    ...prev,
                    to: {
                      ...prev.to,
                      value: e.target.value,
                    },
                    from: {
                      ...prev.from,
                      value: e.target.value * 0.8,
                    },
                  }));
                }}
                type="number"
                onWheelCapture={(e) => {
                  e.currentTarget.blur();
                }}
              />
              <Typography.Caption className="text-origin-dimmed text-lg">
                ${swap?.to?.value * (conversions[swap.to?.asset] || 0)}
              </Typography.Caption>
            </div>
            <div className="flex flex-col flex-shrink-0 space-y-4">
              <div className="flex flex-row space-x-4 items-center">
                <Typography.Body className="text-lg text-origin-dimmed">
                  {i18n('balance')} -
                </Typography.Body>
                <button className="flex items-center justify-center px-2 py-1 bg-origin-white bg-opacity-10 text-origin-dimmed rounded-lg">
                  {i18n('max')}
                </button>
              </div>
              <button
                onClick={() => {
                  // choose asset
                }}
                className="relative flex flex-row space-x-4 items-center pl-1 pr-4 h-[40px] bg-origin-white bg-opacity-10 rounded-full overflow-hidden"
              >
                <div className="flex items-center flex-shrink-0 w-[30px] h-full overflow-hidden">
                  <Image
                    className="rounded-full"
                    src="/logos/oeth.png"
                    height={30}
                    width={30}
                    alt="logo"
                  />
                </div>
                <span className="font-semibold text-lg">OETH</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {isDisabled ? (
        <button
          className="flex items-center justify-center w-full h-[72px] text-xl bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-xl opacity-50 cursor-not-allowed"
          disabled
        >
          {i18n('enterAmount')}
        </button>
      ) : (
        <button className="flex items-center justify-center w-full h-[72px] text-xl bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-xl">
          {i18n('wrap')}
        </button>
      )}
    </div>
  );
};

export default WrapToken;
