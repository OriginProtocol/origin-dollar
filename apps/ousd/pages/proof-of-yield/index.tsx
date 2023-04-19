import Head from "next/head";
import React from "react";
import transformLinks from "../../src/utils/transformLinks";
import { Header } from "@originprotocol/origin-storybook";
import { GetServerSideProps } from "next";
import { ProofOfYieldProps } from "../../src/proof-of-yield/types";
import { fetchAPI } from "../../lib/api";
import { Heading, DailyYield } from "../../src/proof-of-yield/sections";
import Footer from "../../src/components/Footer";

const ProofOfYield = ({ navLinks }: ProofOfYieldProps) => {
  return (
    <>
      <Head>
        <title>Proof of Yield</title>
      </Head>
      <Header mappedLinks={navLinks} webProperty="ousd" />

      {/* Heading */}
      <Heading />

      <DailyYield />

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (): Promise<{
  props: ProofOfYieldProps;
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
export default ProofOfYield;
