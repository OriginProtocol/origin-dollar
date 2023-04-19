import React, { RefObject } from "react";
import { Section } from "../../components";
import { assetRootPath } from "../../utils/image";
import { TableOfContents } from "../components";
import { LitePaperData } from "../types";

interface ContentIntroProps {
  data: LitePaperData[];
  headingRefs: RefObject<HTMLDivElement>[];
}

const ContentIntro = ({ data, headingRefs }: ContentIntroProps) => {
  return (
    <div className="px-4 sm:px-8 md:px-16 lg:px-0 relative z-20 w-full lg:w-[793px]">
      <img
        src={assetRootPath("/images/litepaper-bg.svg")}
        alt="litepaper-bg"
        className="w-full z-20"
      />
      <div className="block bg-origin-bg-grey -translate-x-[calc((100%-793px)/2)] absolute bottom-0 w-[200vw] h-1/2 z-[-1]" />
    </div>
  );
};
export default ContentIntro;
