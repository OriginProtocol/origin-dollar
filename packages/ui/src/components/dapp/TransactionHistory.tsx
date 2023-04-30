import React from 'react';
import Image from 'next/image';
import { useAccount } from '@originprotocol/hooks';
import { useWeb3Modal } from '@web3modal/react';

type HistoryProps = {
  i18n: any;
};

const TransactionHistory = ({ i18n }: HistoryProps) => {
  const { isConnected } = useAccount();
  const { open } = useWeb3Modal();
  return (
    <div className="flex flex-col space-y-8">
      <div className="flex flex-col w-full min-h-[440px] bg-origin-bg-lgrey rounded-xl">
        <div className="flex flex-row flex-shrink-0 items-center justify-between px-10 h-[80px]">
          <h2 className="flex flex-shrink-0">History</h2>
          <div className="hidden lg:flex flex-row items-center space-x-4">
            <button className="flex flex-row items-center space-x-2 h-[28px] bg-origin-white bg-opacity-10 rounded-full px-4 text-sm hover:bg-opacity-10 duration-100 ease-in">
              <span className="text-origin-dimmed">Yields</span>
              <span className="h-[6px] w-[6px] bg-origin-bg-lgrey rounded-full" />
            </button>
            <button className="flex flex-row items-center space-x-2 h-[28px] bg-origin-white bg-opacity-10 rounded-full px-4 text-sm hover:bg-opacity-10 duration-100 ease-in">
              <span className="text-origin-dimmed">Swaps</span>
              <span className="h-[6px] w-[6px] bg-origin-bg-lgrey rounded-full" />
            </button>
            <button className="flex flex-row items-center space-x-2 h-[28px] bg-origin-white bg-opacity-10 rounded-full px-4 text-sm hover:bg-opacity-10 duration-100 ease-in">
              <span className="text-origin-dimmed">Sent</span>
              <span className="h-[6px] w-[6px] bg-origin-bg-lgrey rounded-full" />
            </button>
            <button className="flex flex-row items-center space-x-2 h-[28px] bg-origin-white bg-opacity-10 rounded-full px-4 text-sm hover:bg-opacity-10 duration-100 ease-in">
              <span className="text-origin-dimmed">Received</span>
              <span className="h-[6px] w-[6px] bg-origin-bg-lgrey rounded-full" />
            </button>
          </div>
          <button className="h-[28px] bg-origin-white bg-opacity-20 rounded-full px-4 text-sm hover:bg-opacity-10 duration-100 ease-in">
            Export CSV
          </button>
        </div>
        <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
        <div className="relative flex flex-col h-full w-full">
          {!isConnected ? (
            <div className="flex flex-col w-full items-center justify-center h-[400px] bg-origin-bg-lgrey rounded-xl px-10 space-y-4">
              <span className="text-origin-dimmed">
                Swap now to start seeing your awards here
              </span>
              <button
                onClick={() => open()}
                className="flex items-center h-[44px] px-6 bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-full"
              >
                Connect
              </button>
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm text-left text-origin-dimmed">
                <thead className="text-origin-dimmed border-b border-origin-bg-dgrey">
                  <tr className="h-[80px]">
                    <th scope="col" className="px-6 py-3">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Change
                    </th>
                    <th scope="col" className="px-6 py-3">
                      APY
                    </th>
                    <th scope="col" className="px-6 py-3">
                      OETH Balance
                    </th>
                    <th scope="col" className="px-6 py-3">
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b-[1px] border-origin-bg-dgrey h-[80px] text-origin-white">
                    <td scope="row" className="px-6 py-4 whitespace-nowrap">
                      04.04.2023
                    </td>
                    <td className="px-6 py-4">Yield</td>
                    <td className="px-6 py-4">0.00167366</td>
                    <td className="px-6 py-4">8.46%</td>
                    <td className="px-6 py-4">14.82942836</td>
                    <td className="px-6 py-4 text-right">
                      <a href="#" className="font-medium hover:underline">
                        <Image
                          src="/icons/rightupdiagonal.png"
                          height={12}
                          width={12}
                          alt="External link"
                        />
                      </a>
                    </td>
                  </tr>
                  <tr className="border-b-[1px] border-origin-bg-dgrey h-[80px] text-origin-white">
                    <td scope="row" className="px-6 py-4 whitespace-nowrap">
                      04.04.2023
                    </td>
                    <td className="px-6 py-4">Yield</td>
                    <td className="px-6 py-4">0.00167366</td>
                    <td className="px-6 py-4">8.46%</td>
                    <td className="px-6 py-4">14.82942836</td>
                    <td className="px-6 py-4 text-right">
                      <a href="#" className="font-medium hover:underline">
                        <Image
                          src="/icons/rightupdiagonal.png"
                          height={12}
                          width={12}
                          alt="External link"
                        />
                      </a>
                    </td>
                  </tr>
                  <tr className="border-b-[1px] border-origin-bg-dgrey h-[80px] text-origin-white">
                    <td scope="row" className="px-6 py-4 whitespace-nowrap">
                      04.04.2023
                    </td>
                    <td className="px-6 py-4">Yield</td>
                    <td className="px-6 py-4">0.00167366</td>
                    <td className="px-6 py-4">8.46%</td>
                    <td className="px-6 py-4">14.82942836</td>
                    <td className="px-6 py-4 text-right">
                      <a href="#" className="font-medium hover:underline">
                        <Image
                          src="/icons/rightupdiagonal.png"
                          height={12}
                          width={12}
                          alt="External link"
                        />
                      </a>
                    </td>
                  </tr>
                  <tr className="border-b-[1px] border-origin-bg-dgrey h-[80px] text-origin-white">
                    <td scope="row" className="px-6 py-4 whitespace-nowrap">
                      04.04.2023
                    </td>
                    <td className="px-6 py-4">Yield</td>
                    <td className="px-6 py-4">0.00167366</td>
                    <td className="px-6 py-4">8.46%</td>
                    <td className="px-6 py-4">14.82942836</td>
                    <td className="px-6 py-4 text-right">
                      <a href="#" className="font-medium hover:underline">
                        <Image
                          src="/icons/rightupdiagonal.png"
                          height={12}
                          width={12}
                          alt="External link"
                        />
                      </a>
                    </td>
                  </tr>
                  <tr className="border-b-[1px] border-origin-bg-dgrey h-[80px] text-origin-white">
                    <td scope="row" className="px-6 py-4 whitespace-nowrap">
                      04.04.2023
                    </td>
                    <td className="px-6 py-4">Yield</td>
                    <td className="px-6 py-4">0.00167366</td>
                    <td className="px-6 py-4">8.46%</td>
                    <td className="px-6 py-4">14.82942836</td>
                    <td className="px-6 py-4 text-right">
                      <a href="#" className="font-medium hover:underline">
                        <Image
                          src="/icons/rightupdiagonal.png"
                          height={12}
                          width={12}
                          alt="External link"
                        />
                      </a>
                    </td>
                  </tr>
                  <tr className="border-b-[1px] border-origin-bg-dgrey h-[80px] text-origin-white">
                    <td scope="row" className="px-6 py-4 whitespace-nowrap">
                      04.04.2023
                    </td>
                    <td className="px-6 py-4">Yield</td>
                    <td className="px-6 py-4">0.00167366</td>
                    <td className="px-6 py-4">8.46%</td>
                    <td className="px-6 py-4">14.82942836</td>
                    <td className="px-6 py-4 text-right">
                      <a href="#" className="font-medium hover:underline">
                        <Image
                          src="/icons/rightupdiagonal.png"
                          height={12}
                          width={12}
                          alt="External link"
                        />
                      </a>
                    </td>
                  </tr>
                  <tr className="border-b-[1px] border-origin-bg-dgrey h-[80px] text-origin-white">
                    <td scope="row" className="px-6 py-4 whitespace-nowrap">
                      04.04.2023
                    </td>
                    <td className="px-6 py-4">Yield</td>
                    <td className="px-6 py-4">0.00167366</td>
                    <td className="px-6 py-4">8.46%</td>
                    <td className="px-6 py-4">14.82942836</td>
                    <td className="px-6 py-4 text-right">
                      <a href="#" className="font-medium hover:underline">
                        <Image
                          src="/icons/rightupdiagonal.png"
                          height={12}
                          width={12}
                          alt="External link"
                        />
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionHistory;
