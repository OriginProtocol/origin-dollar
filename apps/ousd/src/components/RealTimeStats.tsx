import { useEffect, useState } from "react";
import { useFeeData } from "wagmi";
import { ethers } from "ethers";
import Image from "next/image";
import { Typography } from "@originprotocol/origin-storybook";
import { formatCurrency } from "../utils/math";

const RealTimeStats = () => {
  const [ogv, setOgv] = useState(0);
  const { data, isError, isLoading } = useFeeData();

  const gwei =
    !isLoading && !isError
      ? parseFloat(
          ethers.utils.formatUnits(data?.formatted?.gasPrice || 0, "gwei")
        )?.toFixed(2)
      : 0;

  // useEffect(() => {
  //   (async function () {
  //     try {
  //       const data = await fetch(
  //         "https://api.coingecko.com/api/v3/simple/price?ids=origin-dollar-governance&vs_currencies=usd&include_market_cap=true&include_24hr_change=true&precision=full"
  //       ).then((res) => res.json());
  //       console.log(data);
  //     } catch (e) {
  //       console.log(e);
  //     }
  //   })();
  // }, []);

  const ousd = "$1.0001";
  // const ogv = "$0.0055";

  return (
    <div className="flex flex-row lg:justify-end w-full h-[44px] space-x-2 ">
      <div className="flex items-center max-w-[120px] w-full h-full rounded-md px-2 bg-origin-bg-grey text-origin-white">
        <div className="flex flex-row items-center justify-center space-x-2 w-full h-full">
          <Image
            src="/images/gas.svg"
            height={18}
            width={18}
            alt="Gas station icon"
          />
          <Typography.Caption className="text-subheading">
            {gwei}
          </Typography.Caption>
        </div>
      </div>
      {/*<div className="flex items-center w-full h-full rounded-md px-4 bg-origin-bg-grey text-origin-white">*/}
      {/*  <div className="flex flex-row items-center justify-center space-x-2 w-full h-full">*/}
      {/*    <Image*/}
      {/*      src="/images/ousd.svg"*/}
      {/*      height={18}*/}
      {/*      width={18}*/}
      {/*      alt="OUSD icon"*/}
      {/*    />*/}
      {/*    <Typography.Caption className="text-subheading">*/}
      {/*      {ousd}*/}
      {/*    </Typography.Caption>*/}
      {/*  </div>*/}
      {/*</div>*/}
      {/*<div className="flex items-center w-full h-full rounded-md px-4 bg-origin-bg-grey text-origin-white">*/}
      {/*  <div className="flex flex-row items-center justify-center space-x-2 w-full h-full">*/}
      {/*    <Image src="/images/ogv.svg" height={18} width={18} alt="OGV icon" />*/}
      {/*    <Typography.Caption className="text-subheading">*/}
      {/*      {formatCurrency(ogv, 2)}*/}
      {/*    </Typography.Caption>*/}
      {/*  </div>*/}
      {/*</div>*/}
    </div>
  );
};

export default RealTimeStats;
