import React from "react";
import { fetchAPI } from "../lib/api";
import Article from "../src/components/Article";
import transformLinks from "../src/utils/transformLinks";
import Error404 from "./404";

const FallbackRenderer = ({ article, navLinks }) => {
  if (!article || !article?.length) return <Error404 navLinks={navLinks} />;
  return <Article article={article} navLinks={navLinks} />;
};

export async function getStaticPaths() {
  const { data } = await fetchAPI("/ousd/blog/slugs");
  return {
    paths: (data || []).map((slug) => ({
      params: { slug },
      // TODO: Should all locales be pre-generated?
      locale: "en",
    })),
    fallback: "blocking",
  };
}

export async function getStaticProps({ params, locale }) {
  // TODO: Do something for rate-limit
  const { data } = await fetchAPI(`/ousd/blog/${locale}/${params.slug}`);
  const navRes = await fetchAPI("/ousd-nav-links", {
    populate: {
      links: {
        populate: "*",
      },
    },
  });

  const navLinks = transformLinks(navRes.data);

  if (!data) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      article: data,
      navLinks,
    },
    revalidate: 5 * 60, // Cache response for 5m
  };
}

export default FallbackRenderer;
