import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Typography } from "@originprotocol/origin-storybook";
import { assetRootPath } from "../../utils/image";
import { Audit } from "../types";
import { Section } from "../../components";
import { twMerge } from "tailwind-merge";
import { SecurityFeature } from "../components";

interface SecurityProps {
  audits: Audit[];
  sectionOverrideCss?: string;
}
{
  /* <section className="home black">
<div className="px-[16px] md:px-[64px] lg:px-[200px] py-14 md:py-[120px] text-center"> */
}
const Security = ({ audits, sectionOverrideCss }: SecurityProps) => {
  return (
    <Section
      className={twMerge("bg-origin-bg-black", sectionOverrideCss)}
      innerDivClassName="py-14 md:py-[120px] text-center"
    >
      <Typography.H6
        className="text-[32px] md:text-[56px] leading-[36px] md:leading-[64px]"
        style={{ fontWeight: 500 }}
      >
        Security first
      </Typography.H6>
      <Typography.Body3
        className="md:max-w-[943px] mt-[16px] mx-auto leading-[28px] text-subheading"
        style={{ fontDisplay: "swap" }}
      >
        Rigorous processes and safeguards have been implemented to protect OUSD.
      </Typography.Body3>
      <SecurityFeature
        title="Audited by world-class experts"
        subtitle="Changes to the protocol are reviewed by internal and external auditors on an ongoing basis."
        className="mt-10 md:mt-20"
      >
        <div className="grid grid-rows-2 grid-cols-2 gap-y-10 lg:flex lg:flex-row lg:justify-between mx-auto">
          {audits.map((audit, i) => {
            return (
              <Link
                className="mx-auto"
                href={audit.attributes.auditUrl}
                target="_blank"
                rel="noopener noreferrer"
                key={i}
              >
                <div className="relative rounded-full w-[140px] h-[140px] md:w-[200px] md:h-[200px] lg:w-[130px] lg:h-[130px] xl:w-[170px] xl:h-[170px] 2xl:w-[200px] 2xl:h-[200px] bg-[#141519]">
                  <div className="h-[56px] md:h-[80px] lg:h-[56px] 2xl:h-[80px] absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <Image
                      src={assetRootPath(
                        `/images/${audit.attributes.name
                          .replace(/ /g, "-")
                          .toLowerCase()}.svg`
                      )}
                      width={
                        audit.attributes.name === "Trail of Bits" ? 84 : 56
                      }
                      height={56}
                      sizes="(max-width: 768px) 56px, (max-width: 1024px) 80px, (max-width: 1536px) 56px, 80px"
                      alt={audit.attributes.name}
                    />
                  </div>
                </div>
                <Typography.Body className="mt-[8px] md:mt-6 opacity-75">
                  {audit.attributes.name}
                </Typography.Body>
              </Link>
            );
          })}
        </div>
      </SecurityFeature>
      <div className="flex flex-col md:flex-row relative mb-10 md:mb-20 max-w-[1134px] mx-auto">
        <SecurityFeature
          title="48-hour timelock"
          subtitle="If a malicious vote were to ever pass, users are given 48 hours to withdraw their funds before any new code is implemented."
          className="mt-6 w-full md:w-1/2 md:mr-6"
        >
          <div className="w-full flex justify-center">
            <Image
              src={assetRootPath("/images/lock.svg")}
              width="96"
              height="96"
              alt="lock"
            />
          </div>
        </SecurityFeature>
        <SecurityFeature
          title="Bug bounties"
          subtitle="A $250,000 reward is offered through Immunefi, Web3's leading bug bounty platform. In over two years, no major vulnerability has been identified in OUSD's open-source code."
          className="mt-6 w-full md:w-1/2"
        >
          <div className="w-full flex justify-center">
            <Image
              src={assetRootPath("/images/immunefi.svg")}
              width="180"
              height="180"
              alt="lock"
            />
          </div>
        </SecurityFeature>
      </div>
      <Link
        href="https://docs.ousd.com/security-and-risks/audits"
        target="_blank"
        rel="noopener noreferrer"
        className="bttn gradient2"
      >
        <Typography.H7 className="font-normal" style={{ fontDisplay: "swap" }}>
          Review audits
        </Typography.H7>
      </Link>
    </Section>
  );
};

export default Security;
