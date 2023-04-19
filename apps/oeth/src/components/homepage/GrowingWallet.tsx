import moment from 'moment';
import Image from 'next/image';
import { Typography } from '@originprotocol/origin-storybook';
import { useEffect, useState } from 'react';
import { assetRootPath, commifyToDecimalPlaces } from '../../utils';
import { twMerge } from 'tailwind-merge';
import { useInterval } from '../../hooks';

interface Token {
  name: string;
  image: string;
  value: number;
}

const tokens: Token[] = [
  {
    name: 'OETH',
    image: 'oeth',
    value: 1_052_427,
  },
  {
    name: 'ETH',
    image: 'eth',
    value: 2.87,
  },
];

interface GrowingWalletProps {
  className?: string;
}

const GrowingWallet = ({ className }: GrowingWalletProps) => {
  const [time, setTime] = useState(1680278400000 + 3600000);
  const [oethAmount, setOethAmount] = useState(tokens[0].value);

  useInterval(125, () => setTime((time) => time + 3600000));

  useEffect(() => {
    // Checks if time is divisible by 12 hours
    if (time % (3600000 * 12) !== 4 * 3600000) return;

    setOethAmount((oethAmount) => oethAmount + Math.random() * 1000);
  }, [time]);

  const price =
    oethAmount +
    tokens.reduce<number>(
      (accum, curr) => accum + curr.value,
      0 - tokens[0].value
    );

  return (
    <div
      className={twMerge(
        'w-[290px] sm:w-[356px] min-w-[290px] sm:min-w-[356px] bg-white rounded-t-lg z-10',
        className
      )}
    >
      {/* Phone Header */}
      <div className="px-6 flex justify-between items-center">
        <Typography.Body3 className="text-sm text-black">
          {moment(time).format('HH:mm')}
        </Typography.Body3>
        <div className="flex">
          <Image
            src={assetRootPath('/images/cellular.svg')}
            width={16}
            height={16}
            alt="cellular"
            className="mr-2"
          />
          <Image
            src={assetRootPath('/images/wifi.svg')}
            width={16}
            height={16}
            alt="wifi"
            className="mr-2"
          />
          <Image
            src={assetRootPath('/images/battery.svg')}
            width={16}
            height={16}
            alt="battery"
          />
        </div>
      </div>

      {/* Wallet Header */}
      <div className="mt-6 px-4 flex justify-between">
        <div className="flex">
          <Image
            src={assetRootPath('/images/wallet-prof.svg')}
            width={32}
            height={32}
            alt="profile"
          />
          <div className="ml-3">
            <Typography.Body2 className="text-black leading-0 text-sm">
              Wallet
            </Typography.Body2>
            <Typography.Body2 className="text-eth-grey leading-0 text-sm">
              eth:0x265c...31ad
            </Typography.Body2>
          </div>
        </div>
        <Image
          src={assetRootPath('/images/wallet-dropdown.svg')}
          width={16}
          height={16}
          alt="dropdown"
        />
      </div>

      <div className="bg-a-grey mt-2">
        <Typography.Body3 className="text-xs text-black text-center font-medium py-1">
          Ethereum
        </Typography.Body3>
      </div>

      <Typography.H7 className="text-black font-medium font-sans text-center mt-3">
        {commifyToDecimalPlaces(price, 2)} ETH
      </Typography.H7>

      <Image
        src={assetRootPath('/images/buttons-and-tabs.svg')}
        width={356}
        height={356}
        alt="buttons and tabs"
        className="mt-5"
      />

      {/* Wallet tokens */}
      {tokens.map((token) => (
        <div
          className="flex justify-between py-4 px-5 border-b border-a-grey"
          key={token.name}
        >
          <div className="flex items-center">
            <Image
              src={assetRootPath(`/images/${token.image}.svg`)}
              width={24}
              height={24}
              alt={`${token.name} logo`}
              className="mr-1"
            />
            <Typography.Body3 className="text-sm text-black mr-1">
              {token.name}
            </Typography.Body3>
            <Image
              src={assetRootPath(`/images/link.svg`)}
              width={12}
              height={12}
              alt={`link`}
            />
          </div>
          <Typography.Body2 className="text-black">
            {commifyToDecimalPlaces(
              token.name === 'OETH' ? oethAmount : token.value,
              2
            )}
          </Typography.Body2>
        </div>
      ))}
    </div>
  );
};

export default GrowingWallet;
