import React, { Dispatch, PropsWithChildren, SetStateAction } from "react";
import { Typography } from "@originprotocol/origin-storybook";
import { twMerge } from "tailwind-merge";
import { ActiveSmall } from "../types";
import Image from "next/image";
import { assetRootPath } from "../../utils/image";

type Setter<T> = Dispatch<SetStateAction<T>>;

interface StepButtonProps {
  number: string;
  title: string;
  active: number | ActiveSmall;
  setActive: Setter<number> | Setter<ActiveSmall>;
  large?: boolean;
  className?: string;
}

const StepButton = ({
  number,
  title,
  active,
  setActive,
  className,
  children,
}: PropsWithChildren<StepButtonProps>) => {
  return (
    <div
      className={twMerge(
        `bg-origin-bg-grey w-[294px] py-[22px] pl-6 rounded-lg cursor-pointer mt-2 hover:opacity-100 ${
          active === parseInt(number) ? "opacity-100" : "opacity-50"
        }`,
        className
      )}
      onClick={
        typeof active === "number"
          ? () => (setActive as Setter<number>)(parseInt(number))
          : () =>
              (setActive as Setter<ActiveSmall>)((prev) => ({
                ...prev,
                [parseInt(number)]: !prev[parseInt(number)],
              }))
      }
    >
      <Typography.Body2 className="inline text-blurry">
        {number}
      </Typography.Body2>
      <Typography.Body2 className="ml-2 inline text-blurry">
        {title}
      </Typography.Body2>
      {children}
    </div>
  );
};

export default StepButton;
