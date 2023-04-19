import Head from "next/head";
import React from "react";
import transformLinks from "../../src/utils/transformLinks";
import Error from "../404";
import { useRouter } from "next/router";
import { Header } from "@originprotocol/origin-storybook";
import {
  DayBasicData,
  DayDripperBanner,
  DayOtherSources,
  DayStrategyPerformance,
  DayTotal,
} from "../../src/proof-of-yield/sections";
import { YieldOnDayProps } from "../../src/proof-of-yield/types";
import { GetServerSideProps } from "next";
import { fetchAPI } from "../../lib/api";
import Footer from "../../src/components/Footer";

const overrideCss = "px-8 md:px-10 lg:px-10 xl:px-[8.375rem]";

const YieldOnDay = ({ navLinks }: YieldOnDayProps) => {
  const router = useRouter();
  let { timestamp } = router.query;

  const timestampNumber = Number(timestamp as any);

  if (Number.isNaN(timestampNumber)) return <Error navLinks={navLinks} />;

  return (
    <>
      <Head>
        <title>Proof of Yield</title>
      </Head>
      <Header
        className={overrideCss}
        mappedLinks={navLinks}
        webProperty="ousd"
      />

      <DayBasicData
        sectionOverrideCss={overrideCss}
        timestamp={timestampNumber}
      />

      <DayDripperBanner sectionOverrideCss={overrideCss} />

      <DayStrategyPerformance sectionOverrideCss={overrideCss} />

      <DayOtherSources sectionOverrideCss={overrideCss} />

      <DayTotal sectionOverrideCss={overrideCss} />

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (): Promise<{
  props: YieldOnDayProps;
}> => {
  const navRes = await fetchAPI("/ousd-nav-links", {
    populate: {
      links: {
        populate: "*",
      },
    },
  });

  const navLinks = transformLinks(navRes.data);
  return {
    props: {
      navLinks,
    },
  };
};

export default YieldOnDay;
