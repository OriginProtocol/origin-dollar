import Head from "next/head";
import React from "react";
import transformLinks from "../src/utils/transformLinks";
import Footer from "../src/components/Footer";
import {
  GovernanceIntro,
  GovernanceProcess,
  StepByStep,
  Calculator,
} from "../src/governance/sections";
import { Header } from "@originprotocol/origin-storybook";
import { fetchAPI } from "../lib/api";
import { Link } from "../src/types";
import {
  fetchContributorsFromRepos,
  fetchImprovementProposals,
  fetchVoterCount,
} from "../src/governance/utils";

const overrideCss = "px-4 sm:px-4 md:px-10 lg:px-10 bg-origin-bg-grey";

interface GovernanceProps {
  navLinks: Link[];
  holderCount: number;
  contributorCount: number;
  improvementProposalCount: number;
}

const GovernanceInfo = ({
  navLinks,
  holderCount,
  contributorCount,

  improvementProposalCount,
}: GovernanceProps) => {
  return (
    <>
      <Head>
        <title>Governance</title>
      </Head>

      <Header
        className={overrideCss}
        mappedLinks={navLinks}
        webProperty="ousd"
      />

      {/* Introduction */}
      <GovernanceIntro
        sectionOverrideCss={overrideCss}
        holderCount={holderCount}
        contributorCount={contributorCount}
        improvementProposalCount={improvementProposalCount}
      />

      {/* Governance Process */}
      <GovernanceProcess sectionOverrideCss={overrideCss} />

      {/* Step by step instructions on governance */}
      <StepByStep sectionOverrideCss={overrideCss} />

      {/* OGV to veOGV Calculator */}
      <Calculator sectionOverrideCss={overrideCss} />

      <Footer />
    </>
  );
};

export const getStaticProps = async (): Promise<{
  props: GovernanceProps;
  revalidate: number;
}> => {
  const navResPromise = fetchAPI("/ousd-nav-links", {
    populate: {
      links: {
        populate: "*",
      },
    },
  });

  const holderCountPromise = fetchVoterCount();
  const contributorsPromise = fetchContributorsFromRepos();
  const improvementProposalCountPromise = fetchImprovementProposals();

  const [navRes, holderCount, contributors, improvementProposalCount] =
    await Promise.all([
      navResPromise,
      holderCountPromise,
      contributorsPromise,
      improvementProposalCountPromise,
    ]);

  const navLinks: Link[] = transformLinks(navRes.data) as Link[];

  return {
    props: {
      navLinks,
      holderCount,
      contributorCount: contributors.length,
      improvementProposalCount,
    },
    revalidate: 300,
  };
};

export default GovernanceInfo;
