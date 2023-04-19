import React from "react";
import Image from "next/image";
import { Section } from "../../components";
import { assetRootPath } from "../../utils/image";
import { Typography } from "@originprotocol/origin-storybook";
import { Gradient2Button } from "../../components";
import { twMerge } from "tailwind-merge";
import { useRouter } from "next/router";
import { useGetPreviousRoute } from "../../hooks";
import moment from "moment";

interface DripperTopProps {
  overrideCss?: string;
}

const DripperTop = ({ overrideCss }: DripperTopProps) => {
  const router = useRouter();
  const prev = useGetPreviousRoute();

  const handleClick = () => {
    // Redirect to proof-of-yield home page if previous page was external
    if (prev === null) router.push("/proof-of-yield");
    else router.back();
  };

  return (
    <Section className={twMerge("", overrideCss)}>
      {/* Back button */}
      <div className="cursor-pointer" onClick={handleClick}>
        <Image
          src={assetRootPath("/images/arrow-left.svg")}
          width="12"
          height="12"
          alt="left-arrow"
          className="inline w-[8px] h-[8px] md:w-[12px] md:h-[12px] "
        />
        <Typography.Body2 className="text-xs inline ml-3">
          Back{" "}
          {prev !== null && (
            <span>
              to{" "}
              {moment
                .utc(parseInt(prev?.split("/")[prev.split("/").length - 1]))
                .format("MMM DD, YYYY")}
            </span>
          )}
        </Typography.Body2>
      </div>

      {/* Title */}
      <Typography.H3 className="mt-6 md:mt-14 font-bold">
        OUSD yield dripper
      </Typography.H3>

      <Gradient2Button outerDivClassName="mt-7 md:mt-12">
        <a
          target="_blank"
          href="https://etherscan.io/token/0x9c354503C38481a7A7a51629142963F98eCC12D0"
          rel="noreferrer noopener"
        >
          <span className="text-xs md:text-sm">View dripper contract</span>
          <Image
            src={assetRootPath("/images/ext-link.svg")}
            width="10"
            height="10"
            alt="ext-link"
            className="inline ml-3"
          />
        </a>
      </Gradient2Button>
    </Section>
  );
};

export default DripperTop;
