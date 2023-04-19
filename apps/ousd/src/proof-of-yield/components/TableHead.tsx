import { Typography } from "@originprotocol/origin-storybook";
import { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";
import TitleWithInfo from "./TitleWithInfo";

interface TableHeadProps {
  info?: boolean;
  align?: "left" | "right" | "center" | "justify" | "char";
  className?: string;
}

const TableHead = ({
  info = false,
  align,
  className,
  children,
}: PropsWithChildren<TableHeadProps>) => {
  return (
    <th
      align={`${align || "right"}`}
      className={twMerge(`py-6 w-[1%] whitespace-nowrap`, className)}
    >
      {info ? (
        <TitleWithInfo>{children}</TitleWithInfo>
      ) : (
        <Typography.Body2 className="text-xs md:text-base text-table-title">
          {children}
        </Typography.Body2>
      )}
    </th>
  );
};

export default TableHead;
