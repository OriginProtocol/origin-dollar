import { Typography } from "@originprotocol/origin-storybook";
import React, { RefObject } from "react";
import { Section } from "../../components";
import { LitePaperData } from "../types";

interface ContentProps {
  data: LitePaperData[];
  headingRefs: RefObject<HTMLDivElement>[];
}

const Content = ({ data, headingRefs }: ContentProps) => {
  return (
    <div className="w-screen bg-origin-bg-grey">
      <Section className="pt-16 pb-[120px] bg-origin-bg-grey">
        {" "}
        {data?.map((s, i) => (
          //  key={i} ok since array will not be reordered
          <div className="lg:w-[793px] mx-auto" key={i}>
            <div id={i.toString()} ref={headingRefs[i]} className="scroll-mt-6">
              {s.isSubtitle ? (
                <Typography.Body2 className="my-6 font-bold">
                  {s.title}
                </Typography.Body2>
              ) : (
                <Typography.H6 className="mb-6 mt-12">{s.title}</Typography.H6>
              )}
            </div>
            {/* HTML comes from CMS which we control */}
            <div dangerouslySetInnerHTML={{ __html: s.text }} />
          </div>
        ))}
      </Section>
    </div>
  );
};

export default Content;
