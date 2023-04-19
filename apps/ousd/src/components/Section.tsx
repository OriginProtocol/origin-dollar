import React, { PropsWithChildren, forwardRef, ForwardedRef } from "react";
import { twMerge } from "tailwind-merge";

interface SectionProps {
  className?: string;
  innerDivClassName?: string;
  onClick?: () => void;
}

const Section = forwardRef(
  (
    {
      className,
      innerDivClassName,
      onClick,
      children,
    }: PropsWithChildren<SectionProps>,
    ref: ForwardedRef<HTMLElement>
  ) => {
    return (
      <section
        className={twMerge(
          "px-4 sm:px-8 md:px-16 lg:px-[8.375rem] bg-origin-bg-black",
          className
        )}
        onClick={onClick}
        ref={ref}
      >
        <div className={twMerge("max-w-[89.5rem] mx-auto", innerDivClassName)}>
          {children}
        </div>
      </section>
    );
  }
);

Section.displayName = "Section";
export default Section;
