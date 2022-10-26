const formatSeo = (seoRes) => {
  if (!seoRes || !seoRes.data) return {}

  const seo = {
    metaTitle: seoRes.data.metaTitle,
    metaDescription: seoRes.data.metaDescription,
    shareImage: seoRes.data.metaImage.url,
  }

  if (seoRes.data.structuredData) {
    seo.structuredData = JSON.stringify(seoRes.data.structuredData);
  }

  if (seoRes.data.metaViewport) {
    seo.metaViewport = seoRes.data.metaViewport;
  }

  if (seoRes.data.metaSocial) {
    const metaSocial = {};
    seoRes.data.metaSocial.forEach((metaSoc) => {
      metaSocial[metaSoc.socialNetwork.toLowerCase()] = metaSoc;
    })
    seo.metaSocial = metaSocial;
  }

  return seo
}

export default formatSeo;