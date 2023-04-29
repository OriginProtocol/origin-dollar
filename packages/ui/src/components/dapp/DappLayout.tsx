import React, { ReactNode } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import Link from '../core/Link';
import DappNavigation from './DappNavigation';
import APY from './APY';

const Portfolio = dynamic(() => import('./Portfolio'), {
  ssr: false,
});

const WalletDisplay = dynamic(() => import('./WalletDisplay'), {
  ssr: false,
});

type DappProps = {
  config: any;
  stats: any;
  portfolio: any;
  i18n: any;
  children?: ReactNode;
};

const DappLayout = ({
  config,
  children,
  stats,
  portfolio,
  i18n,
}: DappProps) => {
  const { logoSrc, links, ipfsUrl, tokens } = config;
  return (
    <div className="flex flex-col min-h-[100vh] h-full w-full bg-origin-bg-dgrey text-origin-white">
      <div className="flex flex-col mx-auto w-full h-[470px] bg-origin-bg-black px-4 lg:px-10">
        <header className="flex flex-shrink-0 flex-row items-center justify-between mx-auto max-w-8xl w-full h-[100px] lg:h-[150px] bg-transparent px-2 lg:px-10">
          <Link href="/">
            <Image
              className="relative scale-[90%] right-[10px] lg:scale-100 lg:right-0"
              src={logoSrc}
              width={184}
              height={24}
              alt="Logo"
            />
          </Link>
          <div className="hidden lg:flex flex-row items-center h-full">
            <DappNavigation links={links} />
          </div>
          <div className="flex flex-row items-center space-x-2 h-full">
            <a
              href={ipfsUrl}
              target="_blank"
              className="flex items-center px-6 h-[44px] bg-origin-bg-lgrey rounded-full overflow-hidden"
            >
              <span className="flex lg:hidden">
                {i18n('nav.viewIpfs.mobile')}
              </span>
              <span className="hidden lg:flex">
                {i18n('nav.viewIpfs.desktop')}
              </span>
            </a>
            <WalletDisplay i18n={i18n} tokens={tokens} />
          </div>
        </header>
        <div className="flex lg:hidden flex-row items-center justify-center w-full pt-1 pb-6">
          <DappNavigation links={links} />
        </div>
        <div className="grid grid-cols-12 mx-auto max-w-4xl w-full bg-transparent gap-4 lg:gap-8 h-[254px]">
          <div className="col-span-12 lg:col-span-4">
            <APY i18n={i18n} stats={stats} />
          </div>
          <div className="col-span-12 lg:col-span-8">
            <Portfolio i18n={i18n} portfolio={portfolio} />
          </div>
        </div>
      </div>
      <div className="flex flex-col w-full mx-auto max-w-4xl min-h-[calc(100vh-485px)] px-4 sm:px-0 py-4 lg:py-6">
        {children}
      </div>
    </div>
  );
};

export default DappLayout;
