import { DefaultSeo } from 'next-seo';

const seoConfigs = {
  oeth: {
    baseURL: 'https://app.oeth.com/',
    defaultTitle: 'OETH',
    description: '',
    openGraph: ({ route }) => ({
      type: 'website',
      locale: 'en_EN',
      url: `https://app.oeth.com/${route}`,
      site_name: 'OETH',
      title: 'OETH',
      description: '',
      images: [],
    }),
    twitter: {
      handle: '@',
      cardType: 'summary_large_image',
    },
  },
};

const SEO = ({ appId, route }) => {
  const config = seoConfigs[appId];
  return config ? (
    <DefaultSeo
      defaultTitle={config.defaultTitle}
      titleTemplate={`%s | ${config.defaultTitle}`}
      description={config.description}
      openGraph={config.openGraph({ route })}
      twitter={config.twitter}
    />
  ) : null;
};

export default SEO;
