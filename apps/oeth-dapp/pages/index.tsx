import { ErrorBoundary, Layout } from '../src/components';
import React, { useEffect, useRef, useState } from 'react';
import { Typography } from '@originprotocol/origin-storybook';
import Image from 'next/image';
import { useClickAway } from 'react-use';
import cx from 'classnames';
import { map } from 'lodash';

const Settings = () => {
  const ref = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [showFrontRunMessage, setShowFrontRun] = useState(true);

  const [settings, setSettings] = useState({
    tolerance: 0.5,
    gwei: 54,
  });

  useClickAway(ref, () => {
    setIsOpen(false);
  });

  return (
    <div className="relative">
      <button
        onClick={() => {
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
            Settings
          </Typography.Body>
          <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
          <div className="flex flex-col justify-center h-full space-y-2 p-6">
            <div className="flex flex-col space-y-2">
              <Typography.Caption className="text-origin-dimmed">
                Price Tolerance
              </Typography.Caption>
              <div className="flex flex-row space-x-2">
                <div className="relative flex flex-row items-center px-6 justify-center w-full max-w-[120px] h-[44px] rounded-full overflow-hidden z-[2] bg-origin-blue bg-opacity-5 border border-origin-blue">
                  <input
                    onChange={(e) => {
                      setSettings((prev) => ({
                        ...prev,
                        tolerance: e.target.value || '',
                      }));
                    }}
                    value={settings?.tolerance || ''}
                    className="text-right text-origin-dimmed focus:outline-none z-[2] px-2 flex items-center w-full h-full rounded-full bg-transparent"
                  />
                  <span className="text-origin-white">%</span>
                </div>
                <button className="flex items-center justify-center flex-shrink-0 h-[44px] px-6 bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-full">
                  Auto
                </button>
              </div>
              {showFrontRunMessage && (
                <Typography.Caption className="text-origin-secondary">
                  Your transaction may be frontrun
                </Typography.Caption>
              )}
            </div>
            <div className="flex flex-col space-y-2">
              <Typography.Caption className="text-origin-dimmed">
                Gas Price
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

const OETHLearnMore = () => (
  <div className="flex flex-col w-full items-start justify-center h-[140px] bg-origin-bg-lgrey rounded-xl px-10 space-y-4">
    <Typography.Body>
      Wrapped wOETH is a non-rebasing tokenized vault that appreciates in value
      instead of growing in number
    </Typography.Body>
    <span className="inline-block">
      <a
        href="https://oeth.com"
        target="_blank"
        rel="noreferrer"
        className="flex flex-row space-x-4 items-center justify-center h-[44px] px-6 bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-full"
      >
        <span>Learn More</span>
        <Image
          src="/icons/external.png"
          height={8}
          width={8}
          alt="Learn about OETH"
        />
      </a>
    </span>
  </div>
);

const assetMappings = {
  STETH: {
    symbol: 'stETH',
    label: 'Lido Staked ETH',
    imageSrc: '/logos/lido.png',
  },
  OETH: {
    symbol: 'oETH',
    label: 'Origin ETH',
    imageSrc: '/logos/oeth.png',
  },
  cbETH: {
    symbol: 'oETH',
    label: 'Coinbase Wrapped ETH',
    imageSrc: '/logos/coinbase-wrapped-staked-eth.png',
  },
  RETH: {
    symbol: 'rETH',
    label: 'Rocket Pool ETH',
    imageSrc: '/logos/rocket-pool.jpg',
  },
  FRXETH: {
    symbol: 'frxETH',
    label: 'Frax ETH',
    imageSrc: '/logos/frax-ether.jpg',
  },
  WETH: {
    symbol: 'wETH',
    label: 'Wrapped ETH',
  },
};

const Swap = () => {
  const ref = useRef(null);
  const [showingEmptyState, setShowingEmptyState] = useState(false);
  const [showTokenSelection, setShowTokenSelection] = useState(false);
  const [conversions, setConversions] = useState({});

  const [swap, setSwap] = useState({
    from: {
      value: 0,
      balance: 0,
      asset: assetMappings.STETH.symbol,
    },
    to: {
      value: 0,
      balance: 0,
      asset: assetMappings.OETH.symbol,
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
        asset: assetMappings[id].symbol,
      },
      to: {
        value: 0,
        balance: 0,
      },
    }));
  };

  useClickAway(ref, () => {
    setShowTokenSelection(false);
  });

  useEffect(() => {
    if (showTokenSelection) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [showTokenSelection]);

  return (
    <ErrorBoundary>
      <Layout>
        <div className="flex flex-col space-y-8">
          {showingEmptyState && <OETHLearnMore />}
          <div className="flex flex-col w-full h-[440px] bg-origin-bg-lgrey rounded-xl">
            <div className="flex flex-row flex-shrink-0 items-center justify-between px-10 h-[80px]">
              <Typography.Body className="flex flex-shrink-0" as="h2">
                Swap
              </Typography.Body>
              <Settings />
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
                      Balance: -
                    </Typography.Body>
                    <button className="flex items-center justify-center px-2 py-1 bg-origin-white bg-opacity-10 text-origin-dimmed rounded-lg">
                      max
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
                      Balance: -
                    </Typography.Body>
                    <button className="flex items-center justify-center px-2 py-1 bg-origin-white bg-opacity-10 text-origin-dimmed rounded-lg">
                      max
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
            <Typography.Body
              className="flex flex-shrink-0 items-center"
              as="h3"
            >
              Swap routes
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
                  <span>show more</span>
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
              Enter Amount
            </button>
          ) : (
            <button className="flex items-center justify-center w-full h-[72px] text-xl bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-xl">
              Swap
            </button>
          )}
        </div>
      </Layout>
      {showTokenSelection && (
        <div className="fixed z-[9999] top-0 left-0 flex flex-col h-[100vh] w-[100vw] items-center justify-center">
          <div className="absolute top-0 left-0 flex flex-col h-full w-full bg-origin-bg-black bg-opacity-90 z-[1]" />
          <div
            ref={ref}
            className="flex flex-col mx-auto h-[50vh] w-full lg:w-[50vw] z-[2] bg-origin-bg-lgrey rounded-xl p-6 overflow-auto"
          >
            {map(assetMappings, ({ symbol, label, imageSrc }, key) => (
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
                    <Image src={imageSrc} height={40} width={40} alt={label} />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <Typography.Body className="focus:outline-none bg-transparent text-2xl font-semibold caret-gradient1-from">
                      {label}
                    </Typography.Body>
                    <Typography.Caption className="text-origin-dimmed">
                      {symbol}
                    </Typography.Caption>
                  </div>
                </div>
                <div className="flex flex-col space-y-2 justify-end text-right">
                  <p className="focus:outline-none bg-transparent text-2xl font-semibold caret-gradient1-from">
                    0.0000
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
    </ErrorBoundary>
  );
};

export default Swap;
