import Head from "next/head";
import { useContext } from "react";
import { GlobalContext } from "../../../pages/_app";

const Seo = ({ seo }) => {
  const { defaultSeo, siteName } = useContext(GlobalContext);
  const seoWithDefaults = {
    ...defaultSeo,
    ...seo,
  };
  const fullSeo = {
    ...seoWithDefaults,
    // Add title suffix
    metaTitle: seoWithDefaults.article
      ? `${seoWithDefaults.metaTitle} | ${siteName}`
      : `${seoWithDefaults.metaTitle}`,
    // Get full image URL
    shareImage: seo.shareImage?.url,
  };

  return (
    <Head>
      {fullSeo.metaTitle && <title>{fullSeo.metaTitle}</title>}
      {fullSeo.metaDescription && (
        <meta name="description" content={fullSeo.metaDescription} />
      )}
      {fullSeo.shareImage && <meta name="image" content={fullSeo.shareImage} />}
      {fullSeo.metaViewport && (
        <meta name="viewport" content={fullSeo.metaViewport} />
      )}
      {fullSeo.metaRobots && (
        <meta name="robots" content={fullSeo.metaRobots} />
      )}
      {fullSeo.canonicalURL && (
        <link rel="canonical" href={fullSeo.canonicalURL} />
      )}
      {fullSeo.structuredData && (
        <script type="application/ld+json">{fullSeo.structuredData}</script>
      )}

      <meta name="og:type" content={fullSeo.article ? "article" : "website"} />
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

      <meta property="twitter:card" content="summary_large_image" />
      {fullSeo.metaSocial?.twitter ? (
        <>
          <meta
            property="twitter:title"
            content={fullSeo.metaSocial.twitter.title}
          />
          <meta
            property="twitter:description"
            content={fullSeo.metaSocial.twitter.description}
          />
          <meta
            property="twitter:image"
            content={fullSeo.metaSocial.twitter.image.url}
          />
        </>
      ) : (
        <>
          <meta property="twitter:title" content={fullSeo.metaTitle} />
          <meta
            property="twitter:description"
            content={fullSeo.metaDescription}
          />
          <meta property="twitter:image" content={fullSeo.shareImage} />
        </>
      )}
      <meta name="twitter:card" content="summary_large_image" />
    </Head>
  );
};

export default Seo;
