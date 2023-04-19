import React from "react";
import Head from "next/head";
import transformLinks from "../../src/utils/transformLinks";
import { Header } from "@originprotocol/origin-storybook";
import { GetServerSideProps } from "next";
import { fetchAPI } from "../../lib/api";
import { DripperProps } from "../../src/proof-of-yield/types";
import {
  DripperFunds,
  DripperTop,
  DripperYieldData,
} from "../../src/proof-of-yield/sections";
import Footer from "../../src/components/Footer";
import { DripperBasicStats } from "../../src/proof-of-yield/sections";

const sectionOverrideCss = "px-4 md:px-10 lg:px-24 xl:px-[8.375rem]";

const Dripper = ({ navLinks }: DripperProps) => {
  return (
    <>
      <Head>Proof of Yield Dripper</Head>

      <Header
        className={sectionOverrideCss}
        mappedLinks={navLinks}
        webProperty="ousd"
      />

      <DripperTop overrideCss={sectionOverrideCss} />

      <DripperBasicStats overrideCss={sectionOverrideCss} />

      <DripperYieldData overrideCss={sectionOverrideCss} />

      <DripperFunds overrideCss={sectionOverrideCss} />

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (): Promise<{
  props: DripperProps;
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

export default Dripper;
