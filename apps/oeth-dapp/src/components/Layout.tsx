import React, { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';

type Props = {
  children?: ReactNode;
};

const Layout = ({ children }: Props) => (
  <div className="flex flex-col min-h-[100vh] h-full w-full bg-origin-bg-grey">
    <div className="flex flex-col mx-auto w-full h-[434px] bg-origin-bg-black">
      <header className="flex flex-shrink-0 flex-row items-center justify-between mx-auto w-full h-[150px] bg-transparent px-2 md:px-20">
        <Link href="/">
          <Image
            src="/images/logo.png"
            width={184}
            height={24}
            alt="OETH Logo"
          />
        </Link>
        <nav className="flex flex-row items-center h-full">
          <ul className="flex flex-row items-center space-x-4 h-full">
            <li>
              <Link href="/">Swap</Link>
            </li>
            <li>
              <Link href="/wrap">Wrap</Link>
            </li>
            <li>
              <Link href="/history">History</Link>
            </li>
          </ul>
        </nav>
        <div className="flex flex-row items-center space-x-4 h-full">
          <div>View on ipfs</div>
          <div>Connect</div>
          <div>Icon</div>
        </div>
      </header>
      <div className="grid grid-cols-12 mx-auto max-w-4xl w-full bg-transparent gap-8 h-[254px]">
        <div className="col-span-4">
          <div className="flex flex-col w-full h-full bg-origin-bg-lgrey rounded-xl">
            APY
          </div>
        </div>
        <div className="col-span-8">
          <div className="flex flex-col w-full h-full bg-origin-bg-lgrey rounded-xl">
            OETH Portfolio
          </div>
        </div>
      </div>
    </div>
    <div className="flex flex-col w-full mx-auto max-w-4xl min-h-[calc(100vh-434px)] py-10">
      {children}
    </div>
  </div>
);

export default Layout;
