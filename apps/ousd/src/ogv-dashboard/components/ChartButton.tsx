import React, { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

interface ChartButtonProps {
  selectCondition: boolean;
  onClick?: () => void;
  className?: string;
}

const ChartButton = ({
  selectCondition,
  onClick,
  className,
  children,
}: PropsWithChildren<ChartButtonProps>) => {
  return (
    <button
      onClick={onClick}
      className={twMerge(
        `w-20 md:w-24 h-10 sm:h-14 lg:w-26 text-sm py-4 mr-2 rounded-full flex items-center justify-center ${
          selectCondition
            ? "bg-origin-blue/50 border border-origin-blue font-bold"
            : "bg-origin-bg-grey border-2 border-origin-border"
        }`,
        className
      )}
    >
      {children}
    </button>
  );
};

export default ChartButton;
