import React from "react";
import Link from "next/link";
import Head from "next/head";
import { Typography, Header } from "@originprotocol/origin-storybook";
import Footer from "../src/components/Footer";
import { fetchAPI } from "../lib/api";
import transformLinks from "../src/utils/transformLinks";

const Error404 = ({ navLinks }) => {
  return (
    <>
      <Head>
        <title>Origin Dollar | 404</title>
      </Head>
      <section className="error bg-[#1e1e1e]">
        <Header mappedLinks={navLinks} webProperty="ousd" />
        <div className="px-8 md:px-16 lg:px-[134px] pb-[136px] md:pb-[294px]">
          <div className="max-w-[1432px] mx-auto">
            <div className="mt-5 md:mt-16">
              <Typography.H2
                as="h1"
                className="text-[36px] leading-[40px] md:text-[72px] md:leading-[84px] text-gradient2"
                style={{ fontWeight: 700 }}
              >
                {"Ooops..."}
              </Typography.H2>
            </div>
            <div className="max-w-[541px] mt-[20px] md:mt-[36px]">
              <Typography.H3
                className="text-[32px] leading-[56px] md:text-[56px] md:leading-[64px]"
                style={{ fontWeight: 400 }}
              >
                {"Sorry, we can’t seem to find that page"}
              </Typography.H3>
            </div>
            <Link href="/" className="bttn !mt-10 md:mt-20 !ml-0 gradient2">
              <Typography.H7
                className="font-normal"
                style={{ fontDisplay: "swap" }}
              >
                Go back home
              </Typography.H7>
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
};

export async function getStaticProps() {
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
    revalidate: 5 * 60, // Cache response for 5m
  };
}

export default Error404;
