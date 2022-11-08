import Head from 'next/head'
import { useContext } from 'react'
import { GlobalContext } from '../../../pages/_app'
import { getStrapiMedia } from '../../../lib/media'

const Seo = ({ seo }) => {
  const { defaultSeo, siteName } = useContext(GlobalContext)
  const seoWithDefaults = {
    ...defaultSeo,
    ...seo,
  }
  const fullSeo = {
    ...seoWithDefaults,
    // Add title suffix
    metaTitle: seoWithDefaults.article
      ? `${seoWithDefaults.metaTitle} | ${siteName}`
      : `${seoWithDefaults.metaTitle}`,
    // Get full image URL
    shareImage: seo.shareImage?.url,
  }

  return (
    <Head>
      {fullSeo.metaTitle && <title>{fullSeo.metaTitle}</title>}
      {fullSeo.metaDescription && (
        <meta name="description" content={fullSeo.metaDescription} />
      )}
      {fullSeo.shareImage && <meta name="image" content={fullSeo.shareImage} />}
      {fullSeo.article && <meta property="og:type" content="article" />}
      {fullSeo.metaViewport && (
        <meta name="viewport" content={fullSeo.metaViewport} />
      )}
      {fullSeo.metaRobots && (
        <meta name="robots" content={fullSeo.metaRobots} />
      )}
      {fullSeo.canonicalUrl && (
        <link rel="canonical" href={fullSeo.canonicalUrl} />
      )}
      {fullSeo.structuredData && (
        <script type="application/ld+json">{fullSeo.structuredData}</script>
      )}

      {fullSeo.metaSocial?.facebook ? (
        <>
          <meta
            property="og:title"
            content={fullSeo.metaSocial.facebook.title}
          />
          <meta
            property="og:description"
            content={fullSeo.metaSocial.facebook.description}
          />
          <meta
            property="og:image"
            content={fullSeo.metaSocial.facebook.image.url}
          />
        </>
      ) : (
        <>
          <meta property="og:title" content={fullSeo.metaTitle} />
          <meta property="og:description" content={fullSeo.metaDescription} />
          <meta property="og:image" content={fullSeo.shareImage} />
        </>
      )}

      {fullSeo.metaSocial?.twitter ? (
        <>
          <meta
            name="twitter:title"
            content={fullSeo.metaSocial.twitter.title}
          />
          <meta
            name="twitter:description"
            content={fullSeo.metaSocial.twitter.description}
          />
          <meta
            name="twitter:image"
            content={fullSeo.metaSocial.twitter.image.url}
          />
        </>
      ) : (
        <>
          <meta name="twitter:title" content={fullSeo.metaTitle} />
          <meta name="twitter:description" content={fullSeo.metaDescription} />
          <meta name="twitter:image" content={fullSeo.shareImage} />
        </>
      )}
      <meta name="twitter:card" content="summary_large_image" />
    </Head>
  )
}

export default Seo
