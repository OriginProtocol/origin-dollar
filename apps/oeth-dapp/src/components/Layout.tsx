import React, { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from 'react-query';
import cx from 'classnames';
import { Typography, Button } from '@originprotocol/origin-storybook';
import { useRouter } from 'next/router';

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
    <nav className="flex flex-row items-center h-full">
      <ul className="grid grid-cols-3 gap-4 h-[44px] bg-origin-bg-lgrey rounded-full overflow-hidden">
        {links.map(({ href, label }) => {
          return (
            <li
              key={href}
              className="flex justify-center items-center h-full w-full"
            >
              <Link
                href={href}
                className={cx(
                  'flex items-center px-6 justify-center w-full h-full rounded-full transition-all duration-300 ease-in',
                  {
                    'border border-[1px] bg-gradient-to-r from-gradient1-from/10 to-gradient1-to/10':
                      pathname === href,
                  }
                )}
              >
                <Typography.Caption>{label}</Typography.Caption>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

const DappUser = () => {
  const isConnected = false;
  return (
    <div className="flex flex-row items-center space-x-2 h-full">
      <div className="flex items-center px-8 h-[44px] bg-origin-bg-lgrey rounded-full overflow-hidden">
        <Typography.Body>View on ipfs</Typography.Body>
      </div>
      {isConnected ? (
        <>
          <div className="flex items-center px-8 h-[44px] bg-origin-bg-lgrey rounded-full overflow-hidden">
            0x12312312312
          </div>
          <div className="flex justify-center items-center w-[44px] h-[44px] bg-origin-bg-lgrey rounded-full overflow-hidden">
            i
          </div>
        </>
      ) : (
        <Button className="flex items-center h-[44px] px-4 bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-full">
          Connect
        </Button>
      )}
    </div>
  );
};

const APYStats = () => {
  const { isLoading, error, data, isFetching } = useQuery({
    queryKey: ['apy'],
    queryFn: () => fetch('/api/stats/apy').then((res) => res.json()),
  });

  console.log({
    isLoading,
    error,
    data,
    isFetching,
  });

  return (
    <div className="flex flex-col w-full h-[300px] bg-origin-bg-lgrey rounded-xl">
      <Typography.Body
        className="flex flex-shrink-0 px-10 h-[80px] items-center"
        as="h2"
      >
        APY
      </Typography.Body>
      <div className="h-[1px] w-full border-b-[2px] border-origin-bg-dgrey" />
      <div className="flex flex-col px-10 justify-center h-full space-y-2">
        <div className="flex flex-row items-center w-full space-x-3">
          <Typography.H7 className="text-origin-dimmed">
            30 day trailing
          </Typography.H7>
          <div className="flex items-center justify-center h-[24px] w-[24px] rounded-full bg-origin-white bg-opacity-10">
            i
          </div>
        </div>
        <Typography.Body className="text-4xl font-bold bg-gradient-to-r from-gradient1-from to-gradient1-to inline-block text-transparent bg-clip-text">
          {data?.apy.toFixed(2)}%
        </Typography.Body>
      </div>
    </div>
  );
};

const OETHPortfolio = () => {
  return (
    <div className="flex flex-col w-full h-[300px] bg-origin-bg-lgrey rounded-xl">
      <Typography.Body
        className="flex flex-shrink-0 px-10 h-[80px] items-center"
        as="h2"
      >
        OETH Portfolio
      </Typography.Body>
      <div className="h-[1px] w-full border-b-[2px] border-origin-bg-dgrey" />
      <div className="grid grid-cols-2 h-full">
        <div className="flex flex-col px-10 justify-center h-full space-y-2 border-r-[2px] border-origin-bg-dgrey">
          <Typography.H7 className="text-origin-dimmed">Balance</Typography.H7>
          <div className="flex flex-row items-center space-x-4 w-full">
            <Typography.H4 as="h2" className="text-3xl font-semibold">
              0
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
            <div className="flex flex-col px-10 w-full h-full justify-center border-b-[2px] border-origin-bg-dgrey space-y-2">
              <Typography.Caption2 className="text-origin-dimmed">
                Lifetime earnings
              </Typography.Caption2>
              <Typography.H7>0</Typography.H7>
            </div>
            <div className="flex flex-col px-10 w-full h-full justify-center space-y-2">
              <Typography.Caption2 className="text-origin-dimmed">
                Pending yield
              </Typography.Caption2>
              <Typography.H7>0</Typography.H7>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Layout = ({ children }: Props) => {
  return (
    <div className="flex flex-col min-h-[100vh] h-full w-full bg-origin-bg-grey text-origin-white">
      <div className="flex flex-col mx-auto w-full h-[485px] bg-origin-bg-black px-10">
        <header className="flex flex-shrink-0 flex-row items-center justify-between mx-auto max-w-8xl w-full h-[150px] bg-transparent px-2 md:px-20">
          <Logo />
          <DappNavigation />
          <DappUser />
        </header>
        <div className="grid grid-cols-12 mx-auto max-w-4xl w-full bg-transparent gap-8 h-[254px]">
          <div className="col-span-4">
            <APYStats />
          </div>
          <div className="col-span-8">
            <OETHPortfolio />
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
