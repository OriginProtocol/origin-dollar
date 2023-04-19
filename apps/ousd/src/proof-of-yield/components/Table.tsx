import React, { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

interface TableProps {
  className?: string;
}

const Table = ({ className, children }: PropsWithChildren<TableProps>) => {
  return (
    <table
      className={twMerge(
        "relative w-full bg-origin-bg-grey rounded md:rounded-lg border-spacing-0",
        className
      )}
    >
      {children}
    </table>
  );
};

export default Table;
