import Head from "next/head";
import transformLinks from "../src/utils/transformLinks";
import Footer from "../src/components/Footer";
import moment from "moment";
import { useRef } from "react";
import { Link } from "../src/types";
import { Header } from "@originprotocol/origin-storybook";
import { fetchAPI } from "../lib/api";
import { ContentIntro, Title, Content } from "../src/litepaper/sections";
import { LitePaperData } from "../src/litepaper/types";
import { useRefs, useViewWidth } from "../src/hooks";
import { TableOfContents } from "../src/litepaper/components";
import { xlSize } from "../src/constants";

interface LitePaper {
  lastUpdated: number;
  data: LitePaperData[];
}

interface LitepaperProps {
  navLinks: Link[];
  litePaper: LitePaper;
}

const Litepaper = ({ navLinks, litePaper }: LitepaperProps) => {
  const { lastUpdated, data } = litePaper;

  const width = useViewWidth();
  const headingRefs = useRefs<HTMLDivElement>(data?.length);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={contentRef}>
      <Head>
        <title>Litepaper</title>
      </Head>
      <Header mappedLinks={navLinks} webProperty="ousd" />

      {/* Page title */}
      <Title lastUpdated={lastUpdated} />

      {width > xlSize ? (
        <div className="mt-12 grid grid-cols-[calc((100%-793px)/2)1fr]">
          <TableOfContents
            data={data}
            headingRefs={headingRefs}
            className="sticky self-start top-12 z-30"
          />
          {/* Table of contents and Litepaper image */}
          <ContentIntro data={data} headingRefs={headingRefs} />
          <Content data={data} headingRefs={headingRefs} />
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center">
          <ContentIntro data={data} headingRefs={headingRefs} />
          <Content data={data} headingRefs={headingRefs} />
        </div>
      )}
      <Footer />
    </div>
  );
};

export const getStaticProps = async (): Promise<{
  props: LitepaperProps;
  revalidate: number;
}> => {
  const navRes = await fetchAPI("/ousd-nav-links", {
    populate: {
      links: {
        populate: "*",
      },
    },
  });

  const litePaperReq: {
    data: {
      id: number;
      attributes: {
        createdAt: string;
        updatedAt: string;
        publishedAt: string;
        title: string;
        text: string;
        isSubtitle: boolean;
      };
    }[];
  } = await fetchAPI("/ousd-litepapers");

  let lastUpdate = moment(0);
  let sectionCount = 0;

  const litePaperData = litePaperReq.data
    ?.map(({ id, attributes }) => {
      const updatedAt = moment(attributes.updatedAt);
      if (!attributes.isSubtitle) sectionCount++;

      if (updatedAt.isAfter(lastUpdate)) lastUpdate = updatedAt;

      return {
        id,
        title: attributes.title,
        text: attributes.text,
        isSubtitle: attributes.isSubtitle,
        sectionNumber: sectionCount,
      };
    })
    .sort((a, b) => a.id - b.id);

  const litePaper = {
    lastUpdated: lastUpdate.valueOf(),
    data: litePaperData || null,
  };

  const navLinks: Link[] = transformLinks(navRes.data) as Link[];
  return {
    props: {
      navLinks,
      litePaper,
    },
    revalidate: 300,
  };
};

export default Litepaper;
