import React from "react";
import Image from "next/image";
import { utils } from "ethers";
import { assetRootPath } from "../../utils/image";
import { TitleWithInfo } from "../components";
import { Typography } from "@originprotocol/origin-storybook";

const { commify } = utils;

const YieldBoostMultiplier = () => {
  return (
    <div className="w-full lg:w-1/3 h-min rounded-lg bg-origin-bg-grey text-blurry">
      <div className="flex justify-center items-center w-fit mx-4 md:mx-8 mt-8 pt-6 md:pt-8 lg:pt-0">
        <Typography.Body className="inline mr-2">
          Yield boost multiplier
        </Typography.Body>
        <Image
          src={assetRootPath("/images/info-white.svg")}
          width="16"
          height="16"
          alt="info"
          className="inline ml-1"
        />
      </div>
      <div className="border md:border-2 mx-4 md:mx-8 border-origin-bg-black px-4 md:px-6 py-4 mt-6 rounded-t-lg flex flex-col 2xl:flex-row 2xl:justify-between 2xl:items-center">
        <div>
          <Typography.Body className="inline mr-1">{1.16}%</Typography.Body>
          <Typography.Body2 className="inline">APY</Typography.Body2>
        </div>
        <div>
          <Typography.Body3 className="text-table-title text-sm">
            Raw yield generated
          </Typography.Body3>
        </div>
      </div>
      <div className="border-x md:border-x-2 mx-4 md:mx-8 border-t-0 border-origin-bg-black px-4 md:px-6 py-4 flex flex-col 2xl:flex-row 2xl:justify-between 2xl:items-center">
        <div>
          <Typography.Body className="inline mr-3">x</Typography.Body>
          <Typography.Body className="inline mr-1">2.63</Typography.Body>
          <Typography.Body2 className="inline">Boost</Typography.Body2>
        </div>
        <div className="max-w-[60%]">
          <Typography.Body3 className="text-table-title text-sm text-left 2xl:text-right">
            OUSD total supply ÷ Rebasing OUSD supply
          </Typography.Body3>
        </div>
      </div>
      <div className="border md:border-2 mx-4 md:mx-8 border-origin-bg-black px-4 md:px-6 py-4 flex flex-col 2xl:flex-row 2xl:justify-between 2xl:items-center rounded-b-lg">
        <div>
          <Typography.Body className="inline mr-3">=</Typography.Body>
          <Typography.Body className="inline mr-1">{3.08}%</Typography.Body>
          <Typography.Body2 className="inline">APY</Typography.Body2>
        </div>
        <div>
          <Typography.Body3 className="text-table-title text-sm text-left 2xl:text-right">
            Distributed APY
          </Typography.Body3>
        </div>
      </div>
      <div className="mt-8 flex flex-col xl:flex-row border-t md:border-t-2 border-origin-bg-black">
        <div className="w-full xl:w-1/2 py-6 px-6 border-b md:border-b-2 xl:border-b-0 xl:border-r-2 border-origin-bg-black">
          <TitleWithInfo className="mb-1" textClassName="text-xs md:text-xs">
            Non-Rebasing supply
          </TitleWithInfo>
          <Typography.Body className="text-left w-full inline">
            {" "}
            {commify(30397664)}
          </Typography.Body>
        </div>

        <div className="flex xl:justify-center items-center my-6">
          <div className="px-6 whitespace-nowrap">
            <TitleWithInfo className="mb-1" textClassName="text-xs md:text-xs">
              Rebasing supply
            </TitleWithInfo>
            <Typography.Body className="text-left w-full inline">
              {" "}
              {commify(18666254)}
            </Typography.Body>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YieldBoostMultiplier;
