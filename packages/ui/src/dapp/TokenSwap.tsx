import React, { useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import Image from 'next/image';
import map from 'lodash/map';
import { useClickAway } from 'react-use';
import { Typography } from '@originprotocol/origin-storybook';
import ExternalCTA from '../core/ExternalCTA';
import SettingsMenu from './SettingsMenu';

const TokenSwap = ({ tokens, i18n, emptyState = null }) => {
  const ref = useRef(null);
  const [showTokenSelection, setShowTokenSelection] = useState(false);
  const [conversions, setConversions] = useState({});

  console.log(tokens);

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
  const hasMoreRoutes = false;

  const onSelectToken = (id) => {
    setSwap((prev) => ({
      ...prev,
      from: {
        value: 0,
        balance: 0,
        asset: tokens[id].symbol,
      },
      to: {
        value: 0,
        balance: 0,
      },
    }));
  };

  useClickAway(ref, () => {
    setTimeout(() => {
      setShowTokenSelection(false);
    }, 100);
  });

  useEffect(() => {
    if (showTokenSelection) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [showTokenSelection]);

  const noValueEntered = !swap?.from?.value;

  return (
    <>
      <div className="flex flex-col space-y-8">
        {noValueEntered && emptyState && <ExternalCTA {...emptyState} />}
        <div className="flex flex-col w-full h-[440px] bg-origin-bg-lgrey rounded-xl">
          <div className="flex flex-row flex-shrink-0 items-center justify-between px-10 h-[80px]">
            <Typography.Body className="flex flex-shrink-0" as="h2">
              {i18n('title')}
            </Typography.Body>
            <SettingsMenu i18n={i18n} />
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
                  onClick={() => {
                    setSwap((prev) => ({
                      from: prev.to,
                      to: prev.from,
                    }));
                  }}
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
        <div className="flex flex-col w-full bg-origin-bg-lgrey rounded-xl p-10 space-y-6">
          <Typography.Body className="flex flex-shrink-0 items-center" as="h3">
            {i18n('swapRoutes')}
          </Typography.Body>
          <div className="relative flex flex-col space-y-2 py-6 h-full w-full px-10 bg-origin-bg-grey rounded-md">
            <div className="flex flex-row space-x-2">
              <span>0 ETH</span>
              <span className="text-origin-dimmed">(estimate)</span>
            </div>
            <div className="flex flex-row">
              <span className="text-origin-dimmed w-[150px]">-</span>
              <span className="text-origin-dimmed w-[150px]">-</span>
            </div>
          </div>
          {hasMoreRoutes && (
            <div className="flex flex-col w-full items-center justify-center">
              <button className="flex flex-row space-x-4 items-center justify-center w-[150px] py-1 bg-origin-white bg-opacity-10 rounded-full">
                <span>{i18n('show more')}</span>
                <Image
                  className="relative top-[2px]"
                  src="/icons/caretdown.png"
                  height={6}
                  width={8}
                  alt="Caret down"
                />
              </button>
            </div>
          )}
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
            {i18n('swap')}
          </button>
        )}
      </div>
      {showTokenSelection && (
        <div className="fixed z-[9999] top-0 left-0 flex flex-col h-[100vh] w-[100vw] items-center justify-center">
          <div className="absolute top-0 left-0 flex flex-col h-full w-full bg-origin-bg-black bg-opacity-90 z-[1]" />
          <div
            ref={ref}
            className="flex flex-col mx-auto h-[50vh] w-full lg:w-[50vw] z-[2] bg-origin-bg-lgrey rounded-xl p-6 overflow-auto"
          >
            {map(tokens, ({ logoSrc, name, symbol, balanceOf }, key) => (
              <button
                key={key}
                className="flex flex-row flex-shrink-0 w-full justify-between p-4 hover:bg-origin-bg-dgrey duration-100 ease-in transition-all rounded-md"
                onClick={() => {
                  onSelectToken(key);
                  setShowTokenSelection(false);
                }}
              >
                <div className="flex flex-row space-x-4 text-left items-center">
                  <div className="flex items-center flex-shrink-0 w-[40px] h-[40px] rounded-full overflow-hidden">
                    <Image src={logoSrc} height={40} width={40} alt={name} />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <Typography.Body className="focus:outline-none bg-transparent text-2xl font-semibold caret-gradient1-from">
                      {name}
                    </Typography.Body>
                    <Typography.Caption className="text-origin-dimmed">
                      {symbol}
                    </Typography.Caption>
                  </div>
                </div>
                <div className="flex flex-col space-y-2 justify-end text-right">
                  <p className="focus:outline-none bg-transparent text-2xl font-semibold caret-gradient1-from">
                    {balanceOf}
                  </p>
                  <Typography.Caption className="text-origin-dimmed text-lg">
                    ${swap?.from?.value * (conversions[swap.from?.asset] || 0)}
                  </Typography.Caption>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default TokenSwap;
