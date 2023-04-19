import { Typography } from "@originprotocol/origin-storybook";
import { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

interface HeroInfoProps {
  title: string;
  subtitle: string;
  className?: string;
}

const HeroInfo = ({
  title,
  subtitle,
  className,
  children,
}: PropsWithChildren<HeroInfoProps>) => {
  return (
    <div className={twMerge("p-10 text-center", className)}>
      <Typography.H7 className="text-white">{title}</Typography.H7>
      <Typography.Body3 className="text-sm mt-4 text-subheading">
        {subtitle}
      </Typography.Body3>
      <div className="mt-6">{children}</div>
    </div>
  );
};

export default HeroInfo;
