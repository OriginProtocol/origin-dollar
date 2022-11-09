const formatSeo = (seoRes) => {
  if (!seoRes) return {}

  const seo = {
    metaTitle: seoRes.metaTitle,
    metaDescription: seoRes.metaDescription,
    shareImage: seoRes.metaImage || null,
  }

  if (seoRes.structuredData) {
    seo.structuredData = JSON.stringify(seoRes.structuredData)
  }

  if (seoRes.metaViewport) {
    seo.metaViewport = seoRes.metaViewport
  }

  if (seoRes.metaSocial) {
    const metaSocial = {}
    seoRes.metaSocial.forEach((metaSoc) => {
      metaSocial[metaSoc.socialNetwork.toLowerCase()] = metaSoc
    })
    seo.metaSocial = metaSocial
  }

  return seo
}

export default formatSeo
