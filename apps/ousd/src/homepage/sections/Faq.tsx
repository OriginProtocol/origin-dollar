import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Typography } from "@originprotocol/origin-storybook";
import { assetRootPath } from "../../utils/image";

const Faq = ({ faq }) => {
  const [open, setOpen] = useState({});

  return (
    <>
      <section className="bg-origin-bg-grey">
        <div className="pb-[58px] md:pb-[124px]">
          <div className="px-8 md:px-16 lg:px-[134px]">
            <div className="max-w-[1432px] mx-auto pt-[56px] md:pt-[120px]">
              <Typography.H2
                as="h1"
                className="text-[40px] text-center leading-[40px] md:text-[64px] md:leading-[72px]"
                style={{ fontWeight: 500 }}
              >
                Frequently Asked Questions
              </Typography.H2>
            </div>
          </div>
          <div className="px-4 md:px-16 lg:px-[134px]">
            <div className="max-w-[1432px] mx-auto mt-[20px] md:mt-16">
              <div className="mt-[40px] md:mt-20 space-y-4 md:space-y-6">
                {faq?.map((q, i) => {
                  return (
                    <div
                      className="max-w-[959px] rounded-xl bg-origin-bg-black text-[#fafbfb] mx-auto"
                      key={i}
                    >
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          setOpen({
                            ...open,
                            [i]: !open[i],
                          });
                        }}
                        className="flex p-[16px] md:p-8 flex-row justify-between cursor-pointer"
                      >
                        <Typography.H7
                          className="text-base md:text-xl"
                          style={{ fontWeight: 700 }}
                        >
                          {q.attributes.question}
                        </Typography.H7>
                        <Image
                          src={assetRootPath(`/images/caret.svg`)}
                          width="23"
                          height="14"
                          className={`shrink-0 w-4 md:w-6 ml-[16px] md:ml-8 mb-2 inline ${
                            open[i] ? "rotate-180" : ""
                          }`}
                          alt="caret"
                        />
                      </div>
                      <div className={`${open[i] ? "" : "hidden"}`}>
                        <div
                          className="mx-[16px] md:mx-8 pb-[16px] md:pb-8 mr-12 md:mr-24"
                          dangerouslySetInnerHTML={{
                            __html: q.attributes.answer,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="max-w-[959px] pt-[4px] md:pt-8 mx-auto text-left">
                  <Typography.H5
                    className="text-[20px] md:text-[32px] inline-block"
                    style={{ fontWeight: 700 }}
                  >
                    {"Still have questions?"}
                    <br />
                    {"Join the community on "}
                    <Link
                      href="https://originprotocol.com/discord"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {"Discord"}
                    </Link>
                    <div className="h-1 w-[72px] md:w-[116px] mr-0 ml-auto mt-[4px] bg-gradient-to-r from-[#8c66fc] to-[#0274f1] rounded-full"></div>
                  </Typography.H5>
                </div>
              </div>
            </div>
          </div>
          <div className="px-8 md:px-16 lg:px-[134px]"></div>
        </div>
      </section>
    </>
  );
};

export default Faq;
