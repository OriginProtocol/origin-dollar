import React, { useRef, useState } from 'react';
import { useClickAway } from 'react-use';
import Image from 'next/image';
import {
  shortenAddress,
  formatUnits,
  formatWeiBalance,
  getProviderName,
} from '@originprotocol/utils';
import {
  useAccount,
  useDisconnect,
  useTokenBalances,
} from '@originprotocol/hooks';
import WalletAvatar, { jsNumberForAddress } from 'react-jazzicon';
import { useWeb3Modal } from '@web3modal/react';
import orderBy from 'lodash/orderBy';
import TokenImage from '../core/TokenImage';

type UserActivityProps = {
  i18n: any;
};

const UserActivity = ({ i18n }: UserActivityProps) => {
  const ref = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useClickAway(ref, () => {
    setTimeout(() => {
      setIsOpen(false);
    }, 100);
  });

  const activity = [];

  return (
    <div className="relative">
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
          className="absolute top-[50px] right-0 flex flex-col w-[350px] bg-origin-bg-lgrey z-[9999] shadow-xl border border-[1px] border-origin-bg-dgrey rounded-xl"
        >
          <h2 className="flex flex-shrink-0 px-6 h-[80px] items-center">
            {i18n('activity.title')}
          </h2>
          <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
          <div className="flex flex-col justify-center h-full space-y-2">
            {activity?.length === 0 ? (
              <div className="flex flex-row items-center p-6">
                <span className="text-origin-dimmed">
                  {i18n('activity.noActivity')}
                </span>
              </div>
            ) : (
              <span>TODO: Events</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface UserMenuDropdownProps {
  address: `0x${string}` | string | undefined;
  i18n: any;
  tokens: any;
  onDisconnect: any;
  onClose: any;
}

const UserMenuDropdown = ({
  address,
  i18n,
  tokens,
  onDisconnect,
  onClose,
}: UserMenuDropdownProps) => {
  const providerName = getProviderName();
  const ref = useRef(null);

  useClickAway(ref, () => {
    setTimeout(() => {
      onClose();
    }, 100);
  });

  const { data, isError, isLoading } = useTokenBalances({ address, tokens });
  return (
    <div
      ref={ref}
      className="absolute top-[50px] right-0 flex flex-col w-[350px] bg-origin-bg-lgrey z-[9999] shadow-xl border border-[1px] border-origin-bg-dgrey rounded-xl"
    >
      <div className="flex flex-row justify-between px-6 h-[80px] items-center">
        <h2 className="flex flex-shrink-0">{i18n('wallet.account')}</h2>
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
            {/* Add other wallet icons and add back in */}
            {providerName === 'metamask' && (
              <Image
                src={`/wallets/${providerName}.png`}
                height={24}
                width={24}
                alt={`${providerName} wallet`}
              />
            )}
            <span className="text-lg">{shortenAddress(address)}</span>
          </div>
          <a
            href={`https://etherscan.io/address/${address}`}
            target="_blank"
            rel="noreferrer"
          >
            <Image
              src="/icons/external.png"
              height={10}
              width={10}
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
          orderBy(
            data,
            ({ balanceOf }) => formatWeiBalance(balanceOf),
            'desc'
          ).map(({ name, symbol, balanceOf, logoSrc }) => (
            <div
              key={name}
              className="flex flex-row items-center space-x-3 text-lg"
            >
              <TokenImage src={logoSrc} symbol={symbol} name={name} />
              <span>{Number(formatUnits(balanceOf)).toFixed(6)}</span>
              <span>{symbol}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

type UserMenuProps = {
  i18n: any;
  address: `0x${string}` | string | undefined;
  onDisconnect: any;
  tokens: any;
};

const UserMenu = ({ i18n, address, onDisconnect, tokens }: UserMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!address) {
    return null;
  }

  return (
    <div className="relative">
      <div
        role="button"
        onClick={() => {
          setIsOpen(true);
        }}
        tabIndex={0}
        className="relative flex flex-row space-x-4 items-center pl-2 pr-2 md:pr-4 h-[44px] bg-origin-bg-lgrey rounded-full overflow-hidden"
      >
        <span className="flex items-center flex-shrink-0 w-[30px] h-full">
          <WalletAvatar diameter={30} seed={jsNumberForAddress(address)} />
        </span>
        <span className="hidden md:flex">{shortenAddress(address)}</span>
      </div>
      {isOpen && (
        <UserMenuDropdown
          address={address}
          i18n={i18n}
          tokens={tokens}
          onDisconnect={onDisconnect}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

type WalletDisplayProps = {
  i18n: any;
  tokens: any;
};

const WalletDisplay = ({ i18n, tokens }: WalletDisplayProps) => {
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
