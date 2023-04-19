import React, { useEffect, useRef } from "react";
import Image from "next/image";
import { Typography } from "@originprotocol/origin-storybook";
import { commify } from "ethers/lib/utils";
import { twMerge } from "tailwind-merge";
import { Section } from "../../components";
import { assetRootPath } from "../../utils/image";
import { DripperGraph } from "../components";
import { Chart } from "chart.js";
import { forwardMouseEvent } from "../utils";

interface DripperYieldDataProps {
  overrideCss?: string;
}

const DripperYieldData = ({ overrideCss }: DripperYieldDataProps) => {
  const graphRef1 = useRef<Chart<"bar">>();
  const graphRef2 = useRef<Chart<"bar">>();

  useEffect(() => {
    const mouseOut1 = (event) =>
      forwardMouseEvent(graphRef2.current.canvas, event);
    const mouseOut2 = (event) =>
      forwardMouseEvent(graphRef1.current.canvas, event);

    graphRef1.current.canvas.onmouseout = mouseOut1;
    graphRef2.current.canvas.onmouseout = mouseOut2;

    return () => {
      graphRef1.current?.canvas.removeEventListener("mouseout", mouseOut1);
      graphRef2.current?.canvas.removeEventListener("mouseout", mouseOut2);
    };
  }, []);

  return (
    <Section
      className={twMerge("bg-origin-bg-grey mt-14 md:mt-20", overrideCss)}
    >
      <Typography.H5 className="pt-14 md:pt-20 text-center">
        Yield in, Yield out
      </Typography.H5>
      <Typography.Body3 className="text-center text-sm text-table-title mt-3">
        View the amount of yield the protocol earns vs what is distributed after
        it&apos;s processed by the dripper
      </Typography.Body3>

      <div className="relative">
        <DripperGraph
          ref={graphRef1}
          className="mt-8 md:mt-14 mb-3"
          graphId={1}
          title="Yield earned"
          extraOptions={{
            onHover(event) {
              if (!event.native.isTrusted) return;

              forwardMouseEvent(graphRef2.current.canvas, event);
            },
          }}
          extraData={[
            { title: "APY", value: "4.37%" },
            { title: "Supply", value: commify("57615375") },
          ]}
        />
      </div>

      <div className="flex justify-center">
        <Image
          src={assetRootPath("/images/blue-down-arrow.svg")}
          width={24}
          height={24}
          alt="arrow down"
          className="w-[14px] h-[14px] md:w-[24px] md:h-[24px]"
        />
      </div>

      <div className="flex justify-center mt-3">
        <div className="py-4 px-16 bg-origin-bg-black rounded-lg text-xs md:text-base w-full md:w-auto h-[40px] md:h-[56px] flex justify-center items-center">
          OUSD Dripper
        </div>
      </div>

      <div className="flex justify-center mt-3">
        <Image
          src={assetRootPath("/images/blue-down-arrow.svg")}
          width={24}
          height={24}
          alt="arrow down"
          className="w-[14px] h-[14px] md:w-[24px] md:h-[24px]"
        />
      </div>

      <div className="relative pb-14 md:pb-20">
        <DripperGraph
          ref={graphRef2}
          className="mt-3"
          graphId={2}
          title="Yield distributed"
          extraOptions={{
            onHover(event) {
              if (!event.native.isTrusted) return;

              forwardMouseEvent(graphRef1.current.canvas, event);
            },
          }}
          extraData={[
            { title: "APY", value: "4.37%" },
            { title: "Supply", value: commify("57615375") },
          ]}
          setTime={false}
        />
      </div>
    </Section>
  );
};

export default DripperYieldData;
