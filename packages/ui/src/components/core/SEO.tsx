import { DefaultSeo, DefaultSeoProps } from 'next-seo';
import { OpenGraph } from 'next-seo/lib/types';

type OpenGraphProps = {
  route: string;
};

type SEOConfig = {
  [key: string]: DefaultSeoProps & {
    baseURL: string;
    openGraph: (a: OpenGraphProps) => OpenGraph;
  };
};

const seoConfigs: SEOConfig = {
  ousd: {
    baseURL: 'https://app.ousd.com/',
    defaultTitle: 'OUSD',
    description: '',
    openGraph: ({ route }: OpenGraphProps): OpenGraph => ({
      type: 'website',
      locale: 'en_EN',
      url: `https://app.ousd.com/${route}`,
      site_name: 'OUSD',
      title: 'OUSD',
      description: '',
      images: [],
    }),
    twitter: {
      handle: '@',
      cardType: 'summary_large_image',
    },
  },
  oeth: {
    baseURL: 'https://app.oeth.com/',
    defaultTitle: 'OETH',
    description: '',
    openGraph: ({ route }: OpenGraphProps): OpenGraph => ({
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

type SEOProps = {
  appId: string;
  route: string;
};

const SEO = ({ appId, route }: SEOProps) => {
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
