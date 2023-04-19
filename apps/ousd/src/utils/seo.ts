const formatSeo = (seoRes) => {
  if (!seoRes) return {};

  const seo = {
    metaTitle: seoRes.metaTitle || null,
    metaDescription: seoRes.metaDescription || null,
    shareImage: seoRes.metaImage || null,
    structuredData: null,
    metaViewport: null,
    canonicalURL: null,
    metaSocial: null,
  };

  if (seoRes.structuredData) {
    seo.structuredData = JSON.stringify(seoRes.structuredData);
  }

  if (seoRes.metaViewport) {
    seo.metaViewport = seoRes.metaViewport;
  }

  if (seoRes.canonicalURL) {
    seo.canonicalURL = seoRes.canonicalURL;
  }

  if (seoRes.metaSocial) {
    const metaSocial = {};
    seoRes.metaSocial.forEach((metaSoc) => {
      metaSocial[metaSoc.socialNetwork.toLowerCase()] = metaSoc;
    });
    seo.metaSocial = metaSocial;
  }

  return seo;
};

export default formatSeo;
