import React, { PropsWithChildren } from "react";
import Image from "next/image";
import { Gradient2Button } from "../../components";
import { useViewWidth } from "../../hooks";
import { lgSize } from "../../constants";
import { assetRootPath } from "../../utils/image";

interface ChartDetailsButtonProps {
  onClick: () => void;
}

const ChartDetailsButton = ({
  onClick,
  children,
}: PropsWithChildren<ChartDetailsButtonProps>) => {
  const width = useViewWidth();

  return (
    <>
      {width >= lgSize ? (
        <Gradient2Button
          onClick={onClick}
          className="bg-origin-bg-grey w-full group-hover:bg-[#1b1a1abb] text-sm"
        >
          <span>{children}</span>
          <Image
            src={assetRootPath("/images/arrow-right.svg")}
            width="20"
            height="20"
            alt="arrow-right"
            className="pl-3 inline translate-y-[-1px]"
          />
        </Gradient2Button>
      ) : (
        <button
          onClick={onClick}
          className="w-3 mx-0 flex justify-end items-center"
        >
          <Image
            width="7"
            height="7"
            src={assetRootPath("/images/arrow.svg")}
            alt="arrow"
          />
        </button>
      )}
    </>
  );
};

export default ChartDetailsButton;
