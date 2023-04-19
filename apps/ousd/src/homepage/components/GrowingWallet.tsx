import moment from "moment";
import Image from "next/image";
import { Typography } from "@originprotocol/origin-storybook";
import { useEffect, useState } from "react";
import { assetRootPath } from "../../utils/image";
import { commify } from "ethers/lib/utils";
import { twMerge } from "tailwind-merge";

const tokens = [
  {
    name: "OUSD",
    image: "ousd",
    value: 1_052_427,
  },

  {
    name: "DAI",
    image: "dai-logo",
    value: 1_000_000,
  },

  {
    name: "ETH",
    image: "eth-grey-back",
    value: 0,
  },
];

interface GrowingWalletProps {
  className?: string;
}

const GrowingWallet = ({ className }: GrowingWalletProps) => {
  const [time, setTime] = useState(1680278400000 + 3600000);
  const [ousdAmount, setOusdAmount] = useState(tokens[0].value);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTime((time) => time + 3600000);

      // Checks if time is divisible by 12 hours
      if (time % (3600000 * 12) !== 4 * 3600000) return;

      setOusdAmount(
        (ousdAmount) => ousdAmount + Math.floor(Math.random() * 1000)
      );
    }, 125);

    return () => clearInterval(intervalId);
  });

  const price = ousdAmount + tokens[1].value + tokens[2].value;

  return (
    <div
      className={twMerge(
        "w-[290px] sm:w-[356px] min-w-[290px] sm:min-w-[356px] bg-white rounded-t-lg z-10",
        className
      )}
    >
      {/* Phone Header */}
      <div className="px-6 flex justify-between items-center">
        <Typography.Body3 className="text-sm text-black">
          {moment(time).format("HH:mm")}
        </Typography.Body3>
        <div className="flex">
          <Image
            src={assetRootPath("/images/cellular.svg")}
            width={16}
            height={16}
            alt="cellular"
            className="mr-2"
          />
          <Image
            src={assetRootPath("/images/wifi.svg")}
            width={16}
            height={16}
            alt="wifi"
            className="mr-2"
          />
          <Image
            src={assetRootPath("/images/battery.svg")}
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
            src={assetRootPath("/images/wallet-prof.svg")}
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
          src={assetRootPath("/images/wallet-dropdown.svg")}
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
        {commify(price)} USD
      </Typography.H7>

      <Image
        src={assetRootPath("/images/buttons-and-tabs.svg")}
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
            {commify(token.name === "OUSD" ? ousdAmount : token.value)}
          </Typography.Body2>
        </div>
      ))}
    </div>
  );
};

export default GrowingWallet;
