import React, { useRef } from "react";
import Head from "next/head";
import { Typography, Header } from "@originprotocol/origin-storybook";
import News from "../src/components/News";
import { useRouter } from "next/router";
import Footer from "../src/components/Footer";
import { fetchAPI } from "../lib/api";
import Seo from "../src/components/strapi/seo";
import formatSeo from "../src/utils/seo";
import transformLinks from "../src/utils/transformLinks";
import { capitalize } from "lodash";

const Blog = ({
  locale,
  onLocale,
  articles,
  meta,
  categories,
  seo,
  navLinks,
}) => {
  const { pathname } = useRouter();
  const active = capitalize(pathname.slice(1));
  const pageRef = useRef(null);

  return (
    <div ref={pageRef}>
      <Head>
        <title>Blog</title>
      </Head>
      <Seo seo={seo} />
      <Header mappedLinks={navLinks} webProperty="ousd" active={active} />
      <section className="bg-[#141519] px-8 md:px-16 lg:px-[8.375rem]">
        <div className="max-w-[89.5rem] mx-auto mt-5 md:mt-16 pb-[56px] md:pb-[120px]">
          <Typography.H2
            as="h1"
            className="text-[40px] leading-[40px] md:text-[64px] md:leading-[72px]"
            style={{ fontWeight: 500 }}
          >
            Latest news
          </Typography.H2>
        </div>
      </section>
      <section className="bg-[#1e1f25] px-4 md:px-16 lg:px-[134px]">
        <div className="max-w-[1432px] mx-auto py-12 md:pt-20 md:pb-[120px]">
          {!articles?.length ? null : (
            <News
              articles={articles}
              meta={meta}
              categories={categories}
              pageRef={pageRef}
            />
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export async function getStaticProps() {
  // Run API calls in parallel
  const articlesRes = await fetchAPI("/ousd/blog/en", {
    pagination: {
      pageSize: 1000,
    },
  });

  const categories = {};
  articlesRes?.data?.forEach((article) => {
    if (article && article.category) {
      categories[article.category.slug] = article.category;
    }
  });

  const seoRes = await fetchAPI("/ousd/page/en/%2Fblog");
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
      articles: articlesRes?.data || null,
      meta: articlesRes?.meta || null,
      categories: Object.values(categories),
      seo: formatSeo(seoRes?.data),
      navLinks,
    },
    revalidate: 5 * 60, // Cache response for 5m
  };
}

export default Blog;
