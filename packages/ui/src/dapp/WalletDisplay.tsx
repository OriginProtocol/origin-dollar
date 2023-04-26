import React, { forwardRef, useMemo, useRef, useState } from 'react';
import { useClickAway } from 'react-use';
import Image from 'next/image';
import { Typography } from '@originprotocol/origin-storybook';
import { shortenAddress, formatUnits } from '@originprotocol/utils';
import {
  useBalance,
  useAccount,
  useContractReads,
  useDisconnect,
  erc20ABI,
} from '@originprotocol/hooks';
import WalletAvatar, { jsNumberForAddress } from 'react-jazzicon';
import { useWeb3Modal } from '@web3modal/react';
import orderBy from 'lodash/orderBy';
import TokenImage from './TokenImage';

const UserActivity = ({ i18n }) => {
  const ref = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useClickAway(ref, () => {
    setTimeout(() => {
      setIsOpen(false);
    }, 100);
  });

  const activity = [];

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
        }}
        className="flex justify-center items-center w-[42px] h-[42px] bg-origin-bg-lgrey rounded-full overflow-hidden"
      >
        <Image
          src="/icons/activity.png"
          height={28}
          width={28}
          alt="activity"
        />
      </button>
      {isOpen && (
        <div
          ref={ref}
          className="fixed top-[110px] right-[120px] flex flex-col w-[350px] bg-origin-bg-lgrey z-[1] shadow-xl border border-[1px] border-origin-bg-dgrey rounded-xl"
        >
          <Typography.Body
            className="flex flex-shrink-0 px-6 h-[80px] items-center"
            as="h2"
          >
            {i18n('activity.title')}
          </Typography.Body>
          <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
          <div className="flex flex-col justify-center h-full space-y-2">
            {activity?.length === 0 ? (
              <div className="flex flex-row items-center p-6">
                <Typography.Caption className="text-origin-dimmed">
                  {i18n('activity.noActivity')}
                </Typography.Caption>
              </div>
            ) : (
              <span>TODO: Events</span>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const UserMenuDropdown = forwardRef(
  ({ address, i18n, tokens, onDisconnect }, ref) => {
    const tokenKeys = Object.keys(tokens);

    const { data: ethBalance } = useBalance({
      address,
    });

    const { data, isError, isLoading } = useContractReads({
      contracts: tokenKeys.map((key) => {
        const { address: contractAddress, abi = erc20ABI } = tokens[key];
        return {
          address: contractAddress,
          abi,
          functionName: 'balanceOf',
          args: [address],
        };
      }),
    });

    const balances = useMemo(() => {
      return tokenKeys.reduce(
        (acc, key, index) => {
          acc[key] = {
            ...tokens[key],
            balanceOf: Number(formatUnits(data?.[index] ?? '0')),
          };
          return acc;
        },
        {
          ETH: {
            name: 'ETH',
            symbol: 'ETH',
            balanceOf: Number(ethBalance?.formatted),
            logoSrc: '/tokens/ETH.png',
          },
        }
      );
    }, [JSON.stringify(tokenKeys), JSON.stringify(data), ethBalance]);

    return (
      <div
        ref={ref}
        className="fixed top-[110px] right-[120px] flex flex-col w-[350px] bg-origin-bg-lgrey z-[1] shadow-xl border border-[1px] border-origin-bg-dgrey rounded-xl"
      >
        <div className="flex flex-row justify-between px-6 h-[80px] items-center">
          <Typography.Body className="flex flex-shrink-0" as="h2">
            {i18n('wallet.account')}
          </Typography.Body>
          <button
            className="h-[28px] bg-origin-white bg-opacity-20 rounded-full px-4 text-sm hover:bg-opacity-10 duration-100 ease-in"
            onClick={onDisconnect}
          >
            {i18n('wallet.disconnect')}
          </button>
        </div>
        <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
        <div className="flex flex-col justify-center h-full space-y-4 p-6">
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center space-x-4">
              <span>TODO</span>
              <span>{shortenAddress(address)}</span>
            </div>
            <a
              href={`https://etherscan.io/address/${address}`}
              target="_blank"
              rel="noreferrer"
            >
              <Image
                src="/icons/external.png"
                height={8}
                width={8}
                alt="View address on Etherscan"
              />
            </a>
          </div>
        </div>
        <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
        <div className="flex flex-col justify-center h-full space-y-4 p-6">
          {isError ? (
            <span>Error</span>
          ) : isLoading ? (
            <span>Loading...</span>
          ) : (
            orderBy(balances, 'balanceOf', 'desc').map(
              ({ name, symbol, balanceOf, logoSrc }) => (
                <div
                  key={name}
                  className="flex flex-row items-center space-x-3"
                >
                  <TokenImage src={logoSrc} symbol={symbol} name={name} />
                  <span>{balanceOf?.toFixed(4)}</span>
                  <span>{symbol}</span>
                </div>
              )
            )
          )}
        </div>
      </div>
    );
  }
);

const UserMenu = ({ i18n, address, onDisconnect, tokens }) => {
  const ref = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useClickAway(ref, () => {
    setTimeout(() => {
      setIsOpen(false);
    }, 100);
  });

  if (!address) {
    return null;
  }

  return (
    <>
      <div
        role="button"
        onClick={() => {
          setIsOpen(true);
        }}
        tabIndex={0}
        className="relative flex flex-row space-x-4 items-center pl-2 pr-4 h-[44px] bg-origin-bg-lgrey rounded-full overflow-hidden"
      >
        <span className="flex items-center flex-shrink-0 w-[30px] h-full">
          <WalletAvatar diameter={30} seed={jsNumberForAddress(address)} />
        </span>
        <span>{shortenAddress(address)}</span>
      </div>
      {isOpen && (
        <UserMenuDropdown
          ref={ref}
          address={address}
          i18n={i18n}
          tokens={tokens}
          onDisconnect={onDisconnect}
        />
      )}
    </>
  );
};

const WalletDisplay = ({ i18n, tokens }) => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useWeb3Modal();
  return isConnected ? (
    <>
      <UserMenu
        i18n={i18n}
        address={address}
        onDisconnect={() => disconnect()}
        tokens={tokens}
      />
      <UserActivity i18n={i18n} />
    </>
  ) : (
    <button
      onClick={() => open()}
      className="flex items-center h-[44px] px-6 bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-full"
    >
      {i18n('wallet.connect')}
    </button>
  );
};

export default WalletDisplay;
