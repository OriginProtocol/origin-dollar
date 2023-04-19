import { Typography } from "@originprotocol/origin-storybook";
import React, { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

interface SecurityFeatureProps {
  title: string;
  subtitle: string;
  className?: string;
}

const SecurityFeature = ({
  title,
  subtitle,
  className,
  children,
}: PropsWithChildren<SecurityFeatureProps>) => {
  return (
    <div
      className={twMerge(
        "py-8 md:py-10 px-4 md:px-16 max-w-[1134px] mx-auto rounded-xl bg-[#1e1f25]",
        className
      )}
    >
      <Typography.Body className="text-origin-white">{title}</Typography.Body>
      <Typography.Body3 className="text-sm mt-4 mb-10 text-subheading">
        {subtitle}
      </Typography.Body3>
      {children}
    </div>
  );
};

export default SecurityFeature;
