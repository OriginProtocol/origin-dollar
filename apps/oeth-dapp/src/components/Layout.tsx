import React, { ReactNode, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from 'react-query';
import cx from 'classnames';
import { Typography } from '@originprotocol/origin-storybook';
import { useRouter } from 'next/router';
import { useWeb3Modal } from '@web3modal/react';
import { useAccount, useDisconnect } from 'wagmi';
import { shortAddress } from '@originprotocol/utils';
import WalletAvatar, { jsNumberForAddress } from 'react-jazzicon';
import { useClickAway } from 'react-use';

type Props = {
  children?: ReactNode;
};

const Logo = () => {
  return (
    <Link href="/">
      <Image src="/images/logo.png" width={184} height={24} alt="OETH Logo" />
    </Link>
  );
};

const DappNavigation = () => {
  const { pathname } = useRouter();
  const links = [
    {
      href: '/',
      label: 'Swap',
    },
    {
      href: '/wrap',
      label: 'Wrap',
    },
    {
      href: '/history',
      label: 'History',
    },
  ];
  return (
    <nav className="hidden lg:flex flex-row items-center h-full">
      <ul className="grid grid-cols-3 gap-4 h-[44px] bg-origin-bg-lgrey rounded-full overflow-hidden">
        {links.map(({ href, label }) => {
          const isActiveLink = pathname === href;
          return (
            <li
              key={href}
              className="flex justify-center items-center h-full w-full"
            >
              <Link
                href={href}
                className="relative flex items-center px-6 justify-center w-full h-full rounded-full overflow-hidden transition-all duration-300 ease-in"
                style={
                  isActiveLink
                    ? {
                        background:
                          'linear-gradient(#1E1F25, #1E1F25) padding-box,linear-gradient(to right, #B361E6 20%, #6A36FC 80%) border-box',
                        borderRadius: '50em',
                        border: '1px solid transparent',
                        borderImage:
                          'linear-gradient(90deg, #B361E6, #6A36FC) 1',
                      }
                    : {}
                }
              >
                <div
                  className={cx({
                    'absolute top-0 left-0 w-full h-full z-[1] rounded-full bg-gradient-to-r from-gradient1-from/10 to-gradient1-to/10':
                      isActiveLink,
                  })}
                />
                <Typography.Caption>{label}</Typography.Caption>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

const UserActivity = () => {
  const ref = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useClickAway(ref, () => {
    setIsOpen(false);
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
            Recent Activity
          </Typography.Body>
          <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
          <div className="flex flex-col justify-center h-full space-y-2">
            {activity?.length === 0 ? (
              <div className="flex flex-row items-center p-6">
                <Typography.Caption className="text-origin-dimmed">
                  No recent activtiy found
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

const WalletDisplay = ({ address, onDisconnect }) => {
  const ref = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useClickAway(ref, () => {
    setIsOpen(false);
  });

  const tokens = [
    {
      src: '/logos/lido.png',
      value: 4.771,
      symbol: 'stETH',
    },
    {
      src: '/logos/coinbase-wrapped-staked-eth.png',
      value: 3.311,
      symbol: 'cbETH',
    },
    {
      src: '/logos/rocket-pool.jpg',
      value: 2.412,
      symbol: 'rETH',
    },
    {
      src: '/logos/frax-ether.jpg',
      value: 1.677,
      symbol: 'sfrxETH',
    },
  ];

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
        }}
        className="relative flex flex-row space-x-4 items-center pl-2 pr-4 h-[44px] bg-origin-bg-lgrey rounded-full overflow-hidden"
      >
        <div className="flex items-center flex-shrink-0 w-[30px] h-full">
          <WalletAvatar diameter={30} seed={jsNumberForAddress(address)} />
        </div>
        <span>{shortAddress(address, 0)}</span>
      </button>
      {isOpen && (
        <div
          ref={ref}
          className="fixed top-[110px] right-[120px] flex flex-col w-[350px] bg-origin-bg-lgrey z-[1] shadow-xl border border-[1px] border-origin-bg-dgrey rounded-xl"
        >
          <div className="flex flex-row justify-between px-6 h-[80px] items-center">
            <Typography.Body className="flex flex-shrink-0" as="h2">
              Account
            </Typography.Body>
            <button
              className="h-[28px] bg-origin-white bg-opacity-20 rounded-full px-4 text-sm hover:bg-opacity-10 duration-100 ease-in"
              onClick={onDisconnect}
            >
              Disconnect
            </button>
          </div>
          <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
          <div className="flex flex-col justify-center h-full space-y-4 p-6">
            {tokens.map(({ src, value, symbol }) => (
              <div
                key={symbol}
                className="flex flex-row items-center space-x-2"
              >
                <Image
                  className="rounded-full"
                  src={src}
                  height={24}
                  width={24}
                  alt={symbol}
                />
                <span>{value}</span>
                <span>{symbol}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

const DappUser = ({ address, onConnect, onDisconnect, isConnected }) => {
  return (
    <div className="flex flex-row items-center space-x-2 h-full">
      <a
        href="/"
        target="_blank"
        className="hidden md:flex items-center px-6 h-[44px] bg-origin-bg-lgrey rounded-full overflow-hidden"
      >
        <Typography.Body>View on ipfs</Typography.Body>
      </a>
      {isConnected && address ? (
        <>
          <WalletDisplay address={address} onDisconnect={onDisconnect} />
          <UserActivity />
        </>
      ) : (
        <button
          onClick={onConnect}
          className="flex items-center h-[44px] px-6 bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-full"
        >
          Connect
        </button>
      )}
    </div>
  );
};

const apyOptions = [
  {
    label: '7 day trailing',
    id: '7d',
    value: 1,
  },
  {
    label: '30 day trailing',
    id: '30d',
    value: 2,
  },
  {
    label: '60 day trailing',
    id: '60d',
    value: 3,
  },
  {
    label: '90 day trailing',
    id: '90d',
    value: 4,
  },
  {
    label: '1 year trailing',
    id: '365d',
    value: 5,
  },
];

const APYStats = ({ isConnected }) => {
  const [selectedAPY, setSelectedAPY] = useState('30d');

  const ref = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useClickAway(ref, () => {
    setIsOpen(false);
  });

  // TODO: Flush out apy data
  const { data } = useQuery({
    queryKey: isConnected ? ['apy'] : null,
    queryFn: () => fetch('/api/stats/apy').then((res) => res.json()),
  });

  const selected = useMemo(() => {
    return apyOptions.find((item) => item.id === selectedAPY);
  }, [selectedAPY]);

  return (
    <div className="flex flex-col w-full h-[300px] bg-origin-bg-lgrey rounded-xl">
      <Typography.Body
        className="flex flex-shrink-0 px-10 h-[80px] items-center"
        as="h2"
      >
        APY
      </Typography.Body>
      <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
      <div className="flex flex-col px-10 justify-center h-full space-y-2">
        <div className="relative flex flex-row items-center w-full space-x-3">
          <Typography.H7 className="text-origin-dimmed">
            {selected?.label}
          </Typography.H7>
          <button
            onClick={() => {
              setIsOpen(true);
            }}
            className="flex justify-center items-center w-[22px] h-[22px] bg-origin-white bg-opacity-10 rounded-full overflow-hidden"
          >
            <Image
              className="relative top-[1px]"
              src="/icons/angledown.png"
              height={7}
              width={10}
              alt="angledown"
            />
          </button>
          {isOpen && (
            <div
              ref={ref}
              className="absolute top-[40px] right-0 flex flex-col bg-origin-bg-lgrey z-[1] shadow-xl border border-[1px] border-origin-bg-dgrey rounded-xl overflow-hidden"
            >
              <div className="flex flex-col w-full space-y-2">
                {apyOptions.map(({ label, value, id }) => (
                  <button
                    key={id}
                    className="flex items-center hover:bg-origin-bg-dgrey w-full h-[35px] px-4"
                    role="button"
                    onClick={() => {
                      setSelectedAPY(id);
                      setIsOpen(false);
                    }}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <Typography.Body className="text-4xl font-bold bg-gradient-to-r from-gradient1-from to-gradient1-to inline-block text-transparent bg-clip-text">
          {data?.[selectedAPY]?.toFixed(2)}%
        </Typography.Body>
      </div>
    </div>
  );
};

const OETHPortfolio = ({ address }) => {
  // TODO: Flush out oeth portfolio data
  const { data } = useQuery({
    queryKey: address ? ['oeth-portfolio', address] : null,
    queryFn: () => fetch(`/api/portfolio/${address}`).then((res) => res.json()),
  });
  return (
    <div className="flex flex-col w-full h-[300px] bg-origin-bg-lgrey rounded-xl">
      <Typography.Body
        className="flex flex-shrink-0 px-10 h-[80px] items-center"
        as="h2"
      >
        OETH Portfolio
      </Typography.Body>
      <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
      <div className="grid grid-cols-2 h-full">
        <div className="flex flex-col px-10 justify-center h-full space-y-2 border-r-[1px] border-origin-bg-dgrey">
          <Typography.H7 className="text-origin-dimmed">Balance</Typography.H7>
          <div className="flex flex-row items-center space-x-4 w-full">
            <Typography.H4 as="h2" className="text-3xl font-semibold">
              -
            </Typography.H4>
            <Image
              src="/icons/oeth.png"
              height={32}
              width={32}
              alt="OETH Logo"
            />
          </div>
        </div>
        <div className="flex flex-col justify-center h-full space-y-2">
          <div className="grid grid-cols-1 h-full w-full">
            <div className="flex flex-col px-10 w-full h-full justify-center border-b-[1px] border-origin-bg-dgrey space-y-2">
              <Typography.Caption2 className="text-origin-dimmed">
                Lifetime earnings
              </Typography.Caption2>
              <Typography.H7>-</Typography.H7>
            </div>
            <div className="flex flex-col px-10 w-full h-full justify-center space-y-2">
              <Typography.Caption2 className="text-origin-dimmed">
                Pending yield
              </Typography.Caption2>
              <Typography.H7>-</Typography.H7>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Layout = ({ children }: Props) => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useWeb3Modal();
  return (
    <div className="flex flex-col min-h-[100vh] h-full w-full bg-origin-bg-dgrey text-origin-white">
      <div className="flex flex-col mx-auto w-full h-[485px] bg-origin-bg-black px-10">
        <header className="flex flex-shrink-0 flex-row items-center justify-between mx-auto max-w-8xl w-full h-[150px] bg-transparent px-2 lg:px-20">
          <Logo />
          <DappNavigation />
          <DappUser
            address={address}
            onConnect={open}
            onDisconnect={disconnect}
            isConnected={isConnected}
          />
        </header>
        <div className="grid grid-cols-12 mx-auto max-w-4xl w-full bg-transparent gap-8 h-[254px]">
          <div className="col-span-4">
            <APYStats isConnected={isConnected} />
          </div>
          <div className="col-span-8">
            <OETHPortfolio address={address} />
          </div>
        </div>
      </div>
      <div className="flex flex-col w-full mx-auto max-w-4xl min-h-[calc(100vh-485px)] px-10 md:px-0 py-10">
        {children}
      </div>
    </div>
  );
};

export default Layout;
