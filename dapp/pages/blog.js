import { Header, Typography } from '@originprotocol/origin-storybook'
import News from 'components/News'
import Layout from 'components/layout'
import Head from 'next/head'
import React from 'react'
import { fetchAPI } from '../lib/api'
import Seo from '../src/components/strapi/seo'
import formatSeo from '../src/utils/seo'
import transformLinks from '../src/utils/transformLinks'

const Blog = ({
  locale,
  onLocale,
  articles,
  meta,
  categories,
  seo,
  navLinks,
}) => {
  return (
    <>
      <Head>
        <title>Blog</title>
      </Head>
      <Seo seo={seo} />
      <Layout locale={locale}>
        <Head>
          <title>Blog</title>
        </Head>
        <Seo seo={seo} />
        <section className="intro black pb-12">
          <Header mappedLinks={navLinks} webProperty="ousd" />
          <div className="max-w-screen-xl mx-auto px-6 mb-6">
            <Typography.H2>Latest news</Typography.H2>
          </div>
          {!articles?.length ? null : (
            <News articles={articles} meta={meta} categories={categories} />
          )}
        </section>
      </Layout>
    </>
  )
}

export async function getStaticProps() {
  // Run API calls in parallel
  const articlesRes = await fetchAPI('/ousd/blog/en')

  const categories = {}
  articlesRes?.data?.forEach((article) => {
    if (article && article.category) {
      categories[article.category.slug] = article.category
    }
  })

  const seoRes = await fetchAPI('/ousd/page/en/%2Fblog')
  const navRes = await fetchAPI('/ousd-nav-links', {
    populate: {
      links: {
        populate: '*',
      },
    },
  })

  const navLinks = transformLinks(navRes.data)

  return {
    props: {
      articles: articlesRes?.data || null,
      meta: articlesRes?.meta || null,
      categories: Object.values(categories),
      seo: formatSeo(seoRes.data),
      navLinks,
    },
    revalidate: 5 * 60, // Cache response for 5m
  }
}

export default Blog
