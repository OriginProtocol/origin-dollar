import React from "react";
import Image from "next/image";
import { Section } from "../../components";
import { Typography } from "@originprotocol/origin-storybook";
import { assetRootPath } from "../../utils/image";
import { Button } from "@originprotocol/origin-storybook";

const TopExchanges = () => {
  return (
    <Section
      className="bg-origin-bg-grey"
      innerDivClassName="w-full flex flex-col items-center"
    >
      <Typography.H3 className="md:text-6xl mt-28 px-[24px] sm:px-0 text-center">
        Listed on top exchanges
      </Typography.H3>
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-0.5 md:gap-3 w-full">
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://curve.fi/#/ethereum/pools/factory-crypto-205/swap"
        >
          <div className="bg-origin-bg-black relative cursor-pointer flex justify-center items-center h-[88px] md:h-52 rounded-tl-lg md:rounded-tl-3xl hover:bg-hover">
            <Image
              src={assetRootPath("/images/curve.svg")}
              width="200"
              height="200"
              className="mx-8 w-28 md:w-36 lg:w-48"
              alt="Curve logo"
            />
          </div>
        </a>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://www.kucoin.com/trade/OGV-USDT"
        >
          <div className="bg-origin-bg-black relative cursor-pointer rounded-tr-lg md:rounded-none flex justify-center items-center h-[88px] md:h-52 hover:bg-hover">
            <Image
              src={assetRootPath("/images/kucoin.svg")}
              width="200"
              height="200"
              className="mx-8 w-28 md:w-36 lg:w-48"
              alt="Kucoin logo"
            />
          </div>
        </a>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://www.huobi.com/en-in/exchange/ogv_usdt"
        >
          <div className="bg-origin-bg-black cursor-pointer flex justify-center items-center h-[88px] md:h-52 rounded-tr-lg md:rounded-none hover:bg-hover">
            <Image
              src={assetRootPath("/images/huobi.svg")}
              width="200"
              height="200"
              className="mx-8 w-28 md:w-36 lg:w-48"
              alt="Huobi logo"
            />
          </div>
        </a>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://www.mexc.com/exchange/OGV_USDT"
        >
          <div className="bg-origin-bg-black cursor-pointer flex justify-center items-center h-[88px] md:h-52 rounded-none md:rounded-tr-3xl hover:bg-hover">
            <Image
              src={assetRootPath("/images/mexc-global.svg")}
              width="200"
              height="200"
              className="mx-8 w-28 md:w-36 lg:w-48"
              alt="MEXC global logo"
            />
          </div>
        </a>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-0.5 md:gap-3 w-full mt-0.5 md:mt-3 md:mb-12">
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://www.gate.io/trade/OGV_USDT"
        >
          <div className="bg-origin-bg-black cursor-pointer flex justify-center items-center h-[88px] md:h-52 rounded-none md:rounded-bl-3xl hover:bg-hover">
            <Image
              src={assetRootPath("/images/gate.io.svg")}
              width="200"
              height="200"
              className="mx-8 w-28 md:w-36 lg:w-48"
              alt="Gate.io logo"
            />
          </div>
        </a>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://app.uniswap.org/#/swap?outputCurrency=0x9c354503C38481a7A7a51629142963F98eCC12D0&chain=mainnet"
        >
          <div className="bg-origin-bg-black cursor-pointer flex justify-center items-center h-[88px] md:h-52 hover:bg-hover">
            <Image
              src={assetRootPath("/images/uniswap.svg")}
              width="200"
              height="200"
              className="mx-8 w-28 md:w-36 lg:w-48"
              alt="Uniswap logo"
            />
          </div>
        </a>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://www.bitget.com/spot/OGVUSDT_SPBL"
        >
          <div className="bg-origin-bg-black cursor-pointer hidden md:flex justify-center items-center h-[88px] md:h-52 rounded-br-lg hover:bg-hover">
            <Image
              src={assetRootPath("/images/bitget.svg")}
              width="200"
              height="200"
              className="mx-8 w-28 md:w-36 lg:w-48"
              alt="Bitget logo"
            />
          </div>
        </a>
      </div>
      <div className="grid md:hidden grid-cols-1 gap-0.5 w-full mb-12">
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://www.bitget.com/spot/OGVUSDT_SPBL"
        >
          <div className="bg-origin-bg-black cursor-pointer flex justify-center items-center h-[88px] md:h-52 rounded-b-lg hover:bg-hover">
            <Image
              src={assetRootPath("/images/bitget.svg")}
              width="200"
              height="200"
              className="mx-8 w-28 md:w-36 lg:w-48"
              alt="Bitget logo"
            />
          </div>
        </a>
      </div>
      <div className="mb-28 flex flex-col md:flex-row w-full md:w-auto">
        <Button
          className="mb-4 md:mr-6 flex items-center justify-center"
          target="_blank"
          rel="noopener noreferrer"
          href="https://www.coingecko.com/coins/origin-dollar-governance#markets"
        >
          View all on CoinGecko{" "}
          <Image
            src={assetRootPath("/images/coingecko-mono.svg")}
            width="25"
            height="25"
            className="inline ml-2 mr-2"
            alt="CoinGecko logo"
          />
        </Button>
        <Button
          className="mb-4 flex items-center justify-center"
          target="_blank"
          rel="noopener noreferrer"
          href="https://coinmarketcap.com/currencies/origin-dollar-governance/markets "
        >
          View all on CoinMarketCap
          <Image
            src={assetRootPath("/images/coinmarketcap.svg")}
            width="25"
            height="25"
            className="inline ml-2 mr-2"
            alt="CoinMarketCap logo"
          />
        </Button>
      </div>
    </Section>
  );
};

export default TopExchanges;
